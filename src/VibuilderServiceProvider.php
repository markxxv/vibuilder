<?php

declare(strict_types=1);

namespace Vibuilder;

use Illuminate\Support\ServiceProvider;

class VibuilderServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/vibuilder.php', 'vibuilder');
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../database/migrations');

        if ($this->app->runningInConsole()) {
            $this->publishes([__DIR__.'/../config/vibuilder.php' => config_path('vibuilder.php')], 'vibuilder-config');
        }
    }
}
