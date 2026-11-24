# Media and uploads

## Media library

- Dependency: `spatie/laravel-medialibrary`.
- `Vibuilder\Models\Document` implements `HasMedia`; collection `vibuilder`.
- The media browser lists **images from all documents**, not just the current one (search, 24 per page, newest first).
- The JSON stores `mediaId`, never a URL: URLs are always built by the server.

### Conversions (kept light on purpose)

| Conversion | Size | Format | Generated |
| --- | --- | --- | --- |
| `thumb` | **200×200, 1:1 crop** (`media.thumb.size`) | WebP, quality 75 | immediately (`nonQueued`), tiny and fast |
| `big` | up to 1600×1600, keeps aspect ratio | WebP, quality 85 | on the queue, so the upload request stays short |

The media browser only ever loads `thumb` images (`loading="lazy"` in the editor), so a grid of 24 items is about
24 small WebP files and never decodes the originals. Until `big` exists the renderer falls back to the original file.

## API

All routes live under `config('vibuilder.routes.prefix')` (default `admin/vibuilder`), use the configured middleware
and, if `vibuilder.authorize` is set, a Gate ability.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `media?search=&page=` | Library: `{items, hasMore}` |
| GET | `media/{id}` | One item, used to poll until `ready` (thumb exists) |
| GET | `documents/{document}/uploads/{uploadId}` | `{received: [0, 1, …]}` for resuming |
| PUT | `documents/{document}/uploads/{uploadId}/chunks/{index}` | Raw body, one chunk |
| POST | `documents/{document}/uploads/{uploadId}/finalize` | Assemble, validate, add to Media Library → `{item}` |

Item: `{id, name, thumbUrl, width, height, ready}`.

## Chunked upload (400 KB)

Goal: upload files up to 10 MB when `post_max_size` / `client_max_body_size` is about 2 MB and timeouts are short.

1. `resources/js/upload.ts` slices the file into 400 KB chunks and sends them **sequentially** as raw `PUT` bodies
   with `X-Upload-Name` and `X-Upload-Size` headers (no multipart overhead).
2. Before sending, the client asks which chunks the server already has, so an interrupted upload resumes.
3. Transient failures (network, 5xx, 408, 429) are retried with exponential backoff. 413, 419 and 403 map to clear messages and are not retried; HTML proxy error pages are never parsed as JSON.
4. `finalize` assembles the file, checks the **real** MIME type and pixel dimensions, adds it to the Media Library and removes the temp chunks.
5. The client polls `media/{id}` until the thumbnail is ready (`waitForThumb`).

Server rules (`Vibuilder\Media\ChunkStore`):

- Every chunk must be exactly `chunk_size` bytes except the last, which must be the exact remainder, so the declared size cannot be bypassed.
- Size limit (`media.max_bytes`, default 12 MiB) is enforced from the first chunk; pixel limits (`max_side` 5000, `max_pixels` 16 MP) on the assembled file.
- Upload ids are validated (`[A-Za-z0-9_-]{16,64}`), file names are sanitized, an id cannot be reused for a different size.
- Chunk requests are throttled by `routes.chunk_throttle` (default 600/min: a 10 MB file is about 25 requests).
- Schedule the cleanup of abandoned uploads: `$schedule->command('vibuilder:purge-uploads')->daily();`
- JPEG, PNG and WebP only; the original is kept.

Keep `media.chunk_size` and `CHUNK_SIZE` in `upload.ts` identical.
