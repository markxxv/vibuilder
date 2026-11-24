<?php

use Illuminate\Support\Facades\Route;
use Vibuilder\Http\Controllers\EditorController;
use Vibuilder\Http\Controllers\MediaController;

Route::middleware(config('vibuilder.routes.middleware', ['web', 'auth']))
    ->prefix(config('vibuilder.routes.prefix', 'admin/vibuilder'))
    ->name('vibuilder.')
    ->group(function () {
        Route::get('documents/{document}', [EditorController::class, 'show'])->name('editor');
        Route::post('documents/{document}', [EditorController::class, 'save'])->name('save');
        Route::get('assets/{file}', [EditorController::class, 'asset'])->where('file', '[A-Za-z0-9._-]+')->name('asset');

        Route::get('media', [MediaController::class, 'index'])->name('media.index');
        Route::get('media/{media}', [MediaController::class, 'show'])->whereNumber('media')->name('media.show');

        Route::prefix('documents/{document}/uploads/{uploadId}')->group(function () {
            Route::get('/', [MediaController::class, 'status'])->name('uploads.status');
            Route::put('chunks/{index}', [MediaController::class, 'chunk'])
                ->whereNumber('index')
                ->middleware('throttle:'.config('vibuilder.routes.chunk_throttle', '600,1'))
                ->name('uploads.chunk');
            Route::post('finalize', [MediaController::class, 'finalize'])->name('uploads.finalize');
        });
    });
