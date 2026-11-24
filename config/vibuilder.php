<?php

return [
    // Database table prefix for package tables.
    'table_prefix' => 'vb_',

    // Optional gate ability checked on every media request (receives the Document where one is bound).
    // null = only the route middleware below protects the API.
    'authorize' => null,

    'media' => [
        'collection' => 'vibuilder',
        'disk' => null, // null = default disk from the medialibrary config
        'chunk_size' => 400 * 1024, // must match the client (resources/js/upload.ts)
        'max_bytes' => 12 * 1024 * 1024,
        'max_side' => 5000,
        'max_pixels' => 16_000_000,
        'per_page' => 24,
        'chunks_directory' => null, // null = storage_path('app/vibuilder/chunks')
        'purge_after_hours' => 24,
        // Library thumbnails: small square WebP so the media browser stays light.
        'thumb' => ['size' => 200, 'quality' => 75],
    ],

    // Admin routes (editor page, media API).
    'routes' => [
        'prefix' => 'admin/vibuilder',
        'middleware' => ['web', 'auth'],
        'chunk_throttle' => '600,1', // a 10 MB file is ~25 requests
    ],
];
