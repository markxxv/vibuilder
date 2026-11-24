<?php

declare(strict_types=1);

namespace Vibuilder\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Gate;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Vibuilder\Media\ChunkStore;
use Vibuilder\Media\ImageInspector;
use Vibuilder\Media\UploadException;
use Vibuilder\Models\Document;

class MediaController extends Controller
{
    /** Library of ALL builder images across all documents. */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAccess();
        $perPage = (int) config('vibuilder.media.per_page', 24);
        $page = max(1, (int) $request->query('page', 1));
        $search = trim((string) $request->query('search', ''));

        $rows = Media::query()
            ->where('collection_name', config('vibuilder.media.collection'))
            ->when($search !== '', fn ($q) => $q->where('name', 'like', '%'.addcslashes($search, '%_\\').'%'))
            ->orderByDesc('id')
            ->skip(($page - 1) * $perPage)
            ->take($perPage + 1)
            ->get();

        return response()->json([
            'items' => $rows->take($perPage)->map(fn (Media $m) => $this->item($m))->values(),
            'hasMore' => $rows->count() > $perPage,
        ]);
    }

    public function show(Media $media): JsonResponse
    {
        $this->authorizeAccess();
        abort_unless($media->collection_name === config('vibuilder.media.collection'), 404);

        return response()->json(['item' => $this->item($media)]);
    }

    public function status(Document $document, string $uploadId): JsonResponse
    {
        $this->authorizeAccess($document);

        return $this->guard(fn () => response()->json(['received' => $this->chunks()->received($uploadId)]));
    }

    public function chunk(Request $request, Document $document, string $uploadId, int $index): JsonResponse
    {
        $this->authorizeAccess($document);

        return $this->guard(fn () => response()->json([
            'received' => $this->chunks()->put(
                $uploadId,
                $index,
                rawurldecode((string) $request->header('X-Upload-Name', 'image')),
                (int) $request->header('X-Upload-Size', 0),
                $request->getContent(),
            ),
        ]));
    }

    public function finalize(Document $document, string $uploadId): JsonResponse
    {
        $this->authorizeAccess($document);

        return $this->guard(function () use ($document, $uploadId) {
            $chunks = $this->chunks();
            $file = $chunks->assemble($uploadId);
            try {
                $info = (new ImageInspector((int) config('vibuilder.media.max_side'), (int) config('vibuilder.media.max_pixels')))->inspect($file['path']);
                $base = pathinfo($file['name'], PATHINFO_FILENAME) ?: 'image';
                $media = $document->addMedia($file['path'])
                    ->usingName($base)
                    ->usingFileName($base.'-'.substr($uploadId, 0, 8).'.'.$info['extension'])
                    ->withCustomProperties(['width' => $info['width'], 'height' => $info['height']])
                    ->toMediaCollection(config('vibuilder.media.collection'), config('vibuilder.media.disk') ?: '');
            } finally {
                $chunks->forget($uploadId);
            }

            return response()->json(['item' => $this->item($media)], 201);
        });
    }

    /** @return array<string, mixed> */
    private function item(Media $m): array
    {
        $ready = $m->hasGeneratedConversion('thumb');

        return [
            'id' => $m->id,
            'name' => $m->name,
            'thumbUrl' => $ready ? $m->getUrl('thumb') : null, // 1:1 WebP
            'width' => $m->getCustomProperty('width'),
            'height' => $m->getCustomProperty('height'),
            'ready' => $ready,
        ];
    }

    private function chunks(): ChunkStore
    {
        return new ChunkStore(
            config('vibuilder.media.chunks_directory') ?: storage_path('app/vibuilder/chunks'),
            (int) config('vibuilder.media.chunk_size'),
            (int) config('vibuilder.media.max_bytes'),
        );
    }

    private function guard(\Closure $fn): JsonResponse
    {
        try {
            return $fn();
        } catch (UploadException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    private function authorizeAccess(?Document $document = null): void
    {
        if ($ability = config('vibuilder.authorize')) {
            Gate::authorize($ability, $document);
        }
    }
}
