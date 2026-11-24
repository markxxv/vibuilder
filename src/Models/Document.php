<?php

declare(strict_types=1);

namespace Vibuilder\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class Document extends Model implements HasMedia
{
    use InteractsWithMedia;

    protected $guarded = [];

    protected $casts = ['content' => 'array'];

    public function getTable(): string
    {
        return config('vibuilder.table_prefix', 'vb_').'documents';
    }

    public function documentable(): MorphTo
    {
        return $this->morphTo();
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection(config('vibuilder.media.collection', 'vibuilder'))
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $thumb = (int) config('vibuilder.media.thumb.size', 200);

        // Small 1:1 WebP, generated immediately so the media browser is never blocked or heavy.
        $this->addMediaConversion('thumb')
            ->fit(\Spatie\Image\Enums\Fit::Crop, $thumb, $thumb)
            ->format('webp')
            ->quality((int) config('vibuilder.media.thumb.quality', 75))
            ->nonQueued();

        // Public image: heavier, generated on the queue so the upload request stays short.
        $this->addMediaConversion('big')
            ->fit(\Spatie\Image\Enums\Fit::Max, 1600, 1600)
            ->format('webp')
            ->quality(85)
            ->queued();
    }

    public static function revisionOf(array $content): string
    {
        return hash('sha256', json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}
