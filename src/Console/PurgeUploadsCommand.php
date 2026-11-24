<?php

declare(strict_types=1);

namespace Vibuilder\Console;

use Illuminate\Console\Command;
use Vibuilder\Media\ChunkStore;

class PurgeUploadsCommand extends Command
{
    protected $signature = 'vibuilder:purge-uploads {--hours= : Remove uploads older than this many hours}';

    protected $description = 'Remove abandoned chunked uploads';

    public function handle(): int
    {
        $hours = (int) ($this->option('hours') ?: config('vibuilder.media.purge_after_hours', 24));
        $store = new ChunkStore(config('vibuilder.media.chunks_directory') ?: storage_path('app/vibuilder/chunks'));
        $this->info('Removed '.$store->purgeOlderThan($hours * 3600).' abandoned upload(s).');

        return self::SUCCESS;
    }
}
