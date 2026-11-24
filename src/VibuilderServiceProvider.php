<?php

declare(strict_types=1);

namespace Vibuilder;

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Vibuilder\Render\Renderer;
use Vibuilder\View\Components\Document;

class VibuilderServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/vibuilder.php', 'vibuilder');

        $this->app->singleton(Renderer::class, fn () => new Renderer(
            mediaUrl: static function (int $id): ?string {
                $media = Media::query()->find($id);

                return $media?->hasGeneratedConversion('big') ? $media->getUrl('big') : $media?->getUrl();
            },
            icon: static function (string $name): ?string {
                if (! function_exists('svg')) {
                    return null; // install a Lucide Blade Icons set, see docs/rendering.md
                }
                try {
                    return svg('lucide-'.$name)->toHtml();
                } catch (\Throwable) {
                    return null;
                }
            },
        ));
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../database/migrations');
        Blade::component('vibuilder::document', Document::class);

        if ($this->app->runningInConsole()) {
            $this->publishes([__DIR__.'/../config/vibuilder.php' => config_path('vibuilder.php')], 'vibuilder-config');
            $this->publishes([__DIR__.'/../resources/css/vibuilder.css' => resource_path('css/vendor/vibuilder.css')], 'vibuilder-css');
        }
    }
}
