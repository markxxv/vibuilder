import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uploadImage, UploadError } from '../../resources/js/upload.ts';

const CHUNK = 4;

/** Minimal in-memory server mirroring the PHP ChunkStore contract. */
function fakeServer(options: { failFirstPut?: number; preReceived?: number[] } = {}) {
    const received = new Map<number, number>((options.preReceived ?? []).map(i => [i, CHUNK]));
    const log: string[] = [];
    let failures = options.failFirstPut ?? 0;
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

    const fetchImpl = (async (url: string, init: RequestInit) => {
        const path = new URL(url, 'http://x').pathname;
        log.push(`${init.method} ${path.split('/uploads/')[1]}`);
        if (init.method === 'GET') return json({ received: [...received.keys()].sort() });
        if (path.endsWith('/finalize')) return json({ item: { id: 1, name: 'a', thumbUrl: null, width: 1, height: 1, ready: false } }, 201);
        if (failures > 0) { failures--; return new Response('Bad gateway', { status: 502 }); }
        const index = Number(path.split('/').pop());
        const body = init.body as Blob;
        received.set(index, body.size);
        return json({ received: [...received.keys()].sort() });
    }) as unknown as typeof fetch;

    return { fetchImpl, received, log };
}

const file = (size: number) => Object.assign(new Blob([new Uint8Array(size)]), { name: 'photo.png' });
const base = { uploadsUrl: '/admin/vibuilder/documents/1/uploads', chunkSize: CHUNK, sleep: async () => {} };

test('slices into chunks, reports progress and finalizes', async () => {
    const server = fakeServer();
    const progress: number[] = [];
    const item = await uploadImage(file(10), { ...base, fetch: server.fetchImpl, onProgress: loaded => progress.push(loaded) });
    assert.equal(item.id, 1);
    assert.deepEqual([...server.received.entries()], [[0, 4], [1, 4], [2, 2]]);
    assert.equal(progress.at(-1), 10);
});

test('resumes: skips chunks the server already has', async () => {
    const server = fakeServer({ preReceived: [0, 1] });
    await uploadImage(file(10), { ...base, fetch: server.fetchImpl });
    assert.equal(server.log.filter(l => l.startsWith('PUT')).length, 1);
});

test('retries transient 5xx errors', async () => {
    const server = fakeServer({ failFirstPut: 2 });
    await uploadImage(file(4), { ...base, fetch: server.fetchImpl });
    assert.equal(server.received.size, 1);
});

test('gives up after the retry limit with a readable error', async () => {
    const server = fakeServer({ failFirstPut: 99 });
    await assert.rejects(uploadImage(file(4), { ...base, retries: 1, fetch: server.fetchImpl }), (e: unknown) => e instanceof UploadError && e.status === 502);
});

test('maps 413 and 419 to clear messages without retrying', async () => {
    for (const [status, text] of [[413, /too large/], [419, /Session expired/]] as const) {
        let calls = 0;
        const fetchImpl = (async (_u: string, init: RequestInit) => {
            if (init.method === 'GET') return new Response(JSON.stringify({ received: [] }));
            calls++;
            return new Response('<html>nginx</html>', { status });
        }) as unknown as typeof fetch;
        await assert.rejects(uploadImage(file(4), { ...base, fetch: fetchImpl }), (e: unknown) => e instanceof UploadError && text.test(e.message));
        assert.equal(calls, 1);
    }
});

test('stops when aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(uploadImage(file(4), { ...base, fetch: fakeServer().fetchImpl, signal: controller.signal }), UploadError);
});
