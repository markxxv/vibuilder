<?php

return [
    // Database table prefix for package tables.
    'table_prefix' => 'vb_',

    // Media Library collection and disk used for builder images.
    'media' => [
        'collection' => 'vibuilder',
        'disk' => null, // null = default disk from medialibrary config
        'chunk_size' => 400 * 1024,
        'max_bytes' => 12 * 1024 * 1024,
        'max_side' => 5000,
        'max_pixels' => 16_000_000,
    ],

    // Admin routes (editor page, media API).
    'routes' => [
        'prefix' => 'admin/vibuilder',
        'middleware' => ['web', 'auth'],
    ],
];
