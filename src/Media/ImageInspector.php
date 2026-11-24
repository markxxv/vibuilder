<?php

declare(strict_types=1);

namespace Vibuilder\Media;

/** Validates an assembled image by its real content, never by its file name. */
final class ImageInspector
{
    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function __construct(
        private readonly int $maxSide = 5000,
        private readonly int $maxPixels = 16_000_000,
    ) {
    }

    /** @return array{mime: string, extension: string, width: int, height: int} */
    public function inspect(string $path): array
    {
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        if (! isset(self::TYPES[$mime])) {
            throw new UploadException('Only JPEG, PNG and WebP images are allowed.');
        }
        $info = @getimagesize($path);
        if (! $info || $info[0] < 1 || $info[1] < 1) {
            throw new UploadException('The file is not a readable image.');
        }
        [$w, $h] = $info;
        if ($w > $this->maxSide || $h > $this->maxSide || $w * $h > $this->maxPixels) {
            throw new UploadException("Image is too large ({$w}×{$h}px). Max {$this->maxSide}px per side and ".number_format($this->maxPixels / 1_000_000, 0).' MP.');
        }

        return ['mime' => $mime, 'extension' => self::TYPES[$mime], 'width' => $w, 'height' => $h];
    }
}
