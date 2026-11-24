/**
 * Chunked image upload client (400 KB chunks) for the vibuilder media API.
 * Sequential, resumable and retrying, so it works behind small nginx/PHP body limits and short timeouts.
 * Contract: docs/media-and-uploads.md. Framework-free; fetch is injectable for tests.
 */

export const CHUNK_SIZE = 400 * 1024; // must match config('vibuilder.media.chunk_size')

export type MediaItem = {
    id: number;
    name: string;
    thumbUrl: string | null;
    width: number | null;
    height: number | null;
    ready: boolean;
};

export type UploadOptions = {
    /** e.g. /admin/vibuilder/documents/12/uploads */
    uploadsUrl: string;
    csrfToken?: string;
    chunkSize?: number;
    retries?: number;
    uploadId?: string;
    signal?: AbortSignal;
    onProgress?: (uploadedBytes: number, totalBytes: number) => void;
    fetch?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
};

export class UploadError extends Error {
    readonly status: number;

    constructor(message: string, status = 0) {
        super(message);
        this.status = status;
    }
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function newUploadId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function uploadImage(file: File | Blob & { name?: string }, options: UploadOptions): Promise<MediaItem> {
    const doFetch = options.fetch ?? fetch.bind(globalThis);
    const chunkSize = options.chunkSize ?? CHUNK_SIZE;
    const retries = options.retries ?? 3;
    const sleep = options.sleep ?? wait;
    const id = options.uploadId ?? newUploadId();
    const base = `${options.uploadsUrl.replace(/\/$/, '')}/${id}`;
    const total = Math.ceil(file.size / chunkSize);
    const name = (file as { name?: string }).name ?? 'image';

    const headers = (extra: Record<string, string> = {}) => ({
        Accept: 'application/json',
        ...(options.csrfToken ? { 'X-CSRF-TOKEN': options.csrfToken } : {}),
        ...extra,
    });

    async function request(url: string, init: RequestInit): Promise<Response> {
        for (let attempt = 0; ; attempt++) {
            if (options.signal?.aborted) throw new UploadError('Upload cancelled.');
            try {
                const response = await doFetch(url, { ...init, signal: options.signal });
                if (response.ok) return response;
                const retryable = response.status >= 500 || response.status === 429 || response.status === 408;
                if (!retryable || attempt >= retries) throw await failure(response);
            } catch (error) {
                if (error instanceof UploadError || options.signal?.aborted || attempt >= retries) {
                    throw error instanceof UploadError ? error : new UploadError('Network error while uploading.');
                }
            }
            await sleep(400 * 2 ** attempt);
        }
    }

    // Resume: ask the server which chunks it already has.
    const status = await request(base, { method: 'GET', headers: headers() });
    const have = new Set<number>(((await status.json()) as { received: number[] }).received);
    let uploaded = Math.min(have.size * chunkSize, file.size);
    options.onProgress?.(uploaded, file.size);

    for (let index = 0; index < total; index++) {
        if (have.has(index)) continue;
        const part = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
        await request(`${base}/chunks/${index}`, {
            method: 'PUT',
            body: part,
            headers: headers({
                'Content-Type': 'application/octet-stream',
                'X-Upload-Name': encodeURIComponent(name),
                'X-Upload-Size': String(file.size),
            }),
        });
        uploaded += part.size;
        options.onProgress?.(Math.min(uploaded, file.size), file.size);
    }

    const done = await request(`${base}/finalize`, { method: 'POST', headers: headers() });
    return ((await done.json()) as { item: MediaItem }).item;
}

async function failure(response: Response): Promise<UploadError> {
    let message = `Upload failed (HTTP ${response.status}).`;
    if (response.status === 413) message = 'The server rejected the upload as too large.';
    else if (response.status === 419) message = 'Session expired. Reload the page and try again.';
    else if (response.status === 403) message = 'You are not allowed to upload images.';
    else {
        try {
            const body = (await response.json()) as { message?: string };
            if (body.message) message = body.message;
        } catch { /* HTML error pages from proxies are not JSON */ }
    }
    return new UploadError(message, response.status);
}

/** Polls until the thumbnail exists (conversions may finish after the upload request). */
export async function waitForThumb(
    mediaUrl: string,
    item: MediaItem,
    options: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; attempts?: number } = {},
): Promise<MediaItem> {
    const doFetch = options.fetch ?? fetch.bind(globalThis);
    const sleep = options.sleep ?? wait;
    let current = item;
    for (let i = 0; i < (options.attempts ?? 20) && !current.ready; i++) {
        await sleep(750);
        const response = await doFetch(`${mediaUrl.replace(/\/$/, '')}/${item.id}`, { headers: { Accept: 'application/json' } });
        if (response.ok) current = ((await response.json()) as { item: MediaItem }).item;
    }
    return current;
}
