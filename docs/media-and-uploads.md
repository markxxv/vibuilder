# Media and uploads

## Media library

- Dependency: `spatie/laravel-medialibrary`.
- `Vibuilder\Models\Document` implements `HasMedia`; collection `vibuilder`, conversions `thumb` (256×256, crop) and `big` (up to 1600×1600).
- The media browser shows **images from all documents**, not just the current one (search, 24 per page).
- The JSON stores `mediaId`, not a URL: URLs are always built by the server.

## Chunked upload (400 KB)

Goal: upload files up to 10 MB when `post_max_size` / `client_max_body_size` is about 2 MB and timeouts are short.

1. The client slices the file into 400 KB chunks.
2. One `POST` per chunk: `uploadId`, `index`, `total`, `name`, `size`, binary body.
3. The server stores chunks in a temp directory and replies with the list of received indexes (resume after a drop).
4. After the last chunk a separate `finalize` request assembles the file, checks the real MIME type and pixel dimensions, and adds it to the Media Library.
5. Conversions run on the queue and the client polls for status, so the final request never hits a timeout.

Rules:

- Size and pixel checks run on the assembled file, so splitting cannot bypass them.
- Per-chunk retries; rate limiting counts uploads, not requests.
- A scheduled command removes abandoned chunks.
- JPEG, PNG and WebP are accepted; the original is kept and the public URL is the `big` conversion.

Status: design (stage 2).
