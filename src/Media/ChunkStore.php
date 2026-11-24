<?php

declare(strict_types=1);

namespace Vibuilder\Media;

/**
 * Stores fixed-size upload chunks on disk and assembles them.
 * Framework-free. See docs/media-and-uploads.md.
 *
 * Every chunk must be exactly $chunkSize bytes, except the last one which must be the remainder,
 * so the declared total size cannot be bypassed by sending more or fewer bytes.
 */
final class ChunkStore
{
    private const ID = '/^[A-Za-z0-9_-]{16,64}$/';

    public function __construct(
        private readonly string $directory,
        private readonly int $chunkSize = 400 * 1024,
        private readonly int $maxBytes = 12 * 1024 * 1024,
    ) {
    }

    /** @return list<int> indexes received so far (sorted) */
    public function put(string $uploadId, int $index, string $name, int $size, string $bytes): array
    {
        $dir = $this->dir($uploadId);
        if ($size < 1 || $size > $this->maxBytes) {
            throw new UploadException('File size is outside the allowed range.');
        }
        $total = (int) ceil($size / $this->chunkSize);
        if ($index < 0 || $index >= $total) {
            throw new UploadException('Chunk index is out of range.');
        }
        $expected = $index === $total - 1 ? $size - $this->chunkSize * ($total - 1) : $this->chunkSize;
        if (strlen($bytes) !== $expected) {
            throw new UploadException("Chunk $index must be exactly $expected bytes.");
        }

        if (! is_dir($dir) && ! @mkdir($dir, 0775, true) && ! is_dir($dir)) {
            throw new UploadException('Cannot create upload directory.');
        }
        $meta = ['name' => $this->cleanName($name), 'size' => $size, 'total' => $total];
        $metaPath = $dir.'/meta.json';
        if (is_file($metaPath)) {
            $existing = json_decode((string) file_get_contents($metaPath), true);
            if (($existing['size'] ?? null) !== $size) {
                throw new UploadException('Upload id is already used for a different file.');
            }
        } else {
            file_put_contents($metaPath, json_encode($meta));
        }
        file_put_contents($this->part($dir, $index), $bytes, LOCK_EX);

        return $this->received($uploadId);
    }

    /** @return list<int> */
    public function received(string $uploadId): array
    {
        $dir = $this->dir($uploadId);
        $out = [];
        foreach (glob($dir.'/*.part') ?: [] as $file) {
            $out[] = (int) basename($file, '.part');
        }
        sort($out);

        return $out;
    }

    /** @return array{path: string, name: string, size: int} the assembled file; caller must move or delete it */
    public function assemble(string $uploadId): array
    {
        $dir = $this->dir($uploadId);
        $meta = is_file($dir.'/meta.json') ? json_decode((string) file_get_contents($dir.'/meta.json'), true) : null;
        if (! is_array($meta)) {
            throw new UploadException('Unknown upload.');
        }
        $missing = array_diff(range(0, $meta['total'] - 1), $this->received($uploadId));
        if ($missing) {
            throw new UploadException('Missing chunks: '.implode(',', $missing));
        }

        $target = $dir.'/assembled';
        $out = fopen($target, 'wb');
        for ($i = 0; $i < $meta['total']; $i++) {
            fwrite($out, (string) file_get_contents($this->part($dir, $i)));
        }
        fclose($out);
        if (filesize($target) !== $meta['size']) {
            @unlink($target);
            throw new UploadException('Assembled size does not match the declared size.');
        }

        return ['path' => $target, 'name' => $meta['name'], 'size' => $meta['size']];
    }

    public function forget(string $uploadId): void
    {
        $dir = $this->dir($uploadId);
        foreach (glob($dir.'/*') ?: [] as $file) {
            @unlink($file);
        }
        @rmdir($dir);
    }

    /** Removes abandoned uploads whose directory was last modified more than $seconds ago. */
    public function purgeOlderThan(int $seconds, ?int $now = null): int
    {
        $now ??= time();
        $removed = 0;
        foreach (glob($this->directory.'/*', GLOB_ONLYDIR) ?: [] as $dir) {
            $latest = filemtime($dir);
            foreach (glob($dir.'/*') ?: [] as $file) {
                $latest = max($latest, (int) filemtime($file));
            }
            if ($now - $latest > $seconds) {
                $this->forget(basename($dir));
                $removed++;
            }
        }

        return $removed;
    }

    private function dir(string $uploadId): string
    {
        if (! preg_match(self::ID, $uploadId)) {
            throw new UploadException('Invalid upload id.');
        }

        return rtrim($this->directory, '/').'/'.$uploadId;
    }

    private function part(string $dir, int $index): string
    {
        return sprintf('%s/%05d.part', $dir, $index);
    }

    private function cleanName(string $name): string
    {
        $name = preg_replace('/[^\p{L}\p{N}._ -]+/u', '', basename(str_replace('\\', '/', $name))) ?? '';
        $name = trim($name, '. ');

        return mb_substr($name === '' ? 'image' : $name, 0, 120);
    }
}
