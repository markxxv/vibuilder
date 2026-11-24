<?php

declare(strict_types=1);

namespace Vibuilder\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Vibuilder\Models\Document;
use Vibuilder\Schema\DocumentValidator;

/** Full-screen editor page, saving with revision check, and the editor's static assets. */
class EditorController extends Controller
{
    private const ASSETS = [
        'vibuilder-editor.js' => 'text/javascript',
        'vibuilder-editor.css' => 'text/css',
        'icons.json' => 'application/json',
    ];

    public function show(Request $request, Document $document)
    {
        $this->authorizeEdit($document);
        $content = $document->content ?: ['version' => DocumentValidator::VERSION, 'sections' => []];

        return view('vibuilder::editor', [
            'config' => [
                'documentId' => $document->id,
                'title' => (string) ($request->query('title') ?: config('app.name', 'Page builder')),
                'backUrl' => $this->backUrl($request),
                'csrfToken' => csrf_token(),
                'uploadsUrl' => preg_replace('#/__upload__$#', '', route('vibuilder.uploads.status', ['document' => $document->getKey(), 'uploadId' => '__upload__'], false)),
                'mediaUrl' => route('vibuilder.media.index', [], false),
                'iconsUrl' => route('vibuilder.asset', ['file' => 'icons.json'], false),
                'media' => $this->mediaFor($content),
                'document' => $content,
                'revision' => Document::revisionOf($content),
            ],
            'saveUrl' => route('vibuilder.save', $document, false),
            'version' => substr(md5((string) filemtime(__DIR__.'/../../../dist/vibuilder-editor.js')), 0, 8),
        ]);
    }

    public function save(Request $request, Document $document): JsonResponse
    {
        $this->authorizeEdit($document);
        $content = $request->input('document');
        $revision = (string) $request->input('revision', '');

        if (! is_array($content)) {
            return response()->json(['ok' => false, 'message' => 'Invalid document.'], 422);
        }
        $errors = (new DocumentValidator())->validate($content);
        if ($errors) {
            return response()->json(['ok' => false, 'message' => 'The document is not valid: '.$errors[0]], 422);
        }

        return DB::transaction(function () use ($document, $content, $revision) {
            $locked = Document::query()->whereKey($document->getKey())->lockForUpdate()->firstOrFail();
            $current = $locked->content ?: ['version' => DocumentValidator::VERSION, 'sections' => []];
            if (! hash_equals(Document::revisionOf($current), $revision)) {
                return response()->json(['ok' => false, 'message' => 'This page was changed in another tab or by someone else. Reload to see the latest version; your edits were not saved.'], 409);
            }
            $new = Document::revisionOf($content);
            $locked->forceFill(['content' => $content, 'revision' => $new])->save();

            return response()->json(['ok' => true, 'revision' => $new]);
        });
    }

    public function asset(string $file): BinaryFileResponse
    {
        abort_unless(isset(self::ASSETS[$file]), 404);
        $path = __DIR__.'/../../../dist/'.$file;
        abort_unless(is_file($path), 404);

        return response()->file($path, ['Content-Type' => self::ASSETS[$file], 'Cache-Control' => 'public, max-age=31536000, immutable']);
    }

    /** Preview data (media id => item) for the images already used in the document. */
    private function mediaFor(array $content): array
    {
        $ids = [];
        array_walk_recursive($content, function ($value, $key) use (&$ids) {
            if ($key === 'mediaId' && is_int($value)) {
                $ids[] = $value;
            }
        });
        if (! $ids) {
            return [];
        }
        $out = [];
        foreach (Media::query()->whereIn('id', array_unique($ids))->get() as $m) {
            $thumb = $m->hasGeneratedConversion('thumb');
            $big = $m->hasGeneratedConversion('big');
            $out[$m->id] = [
                'id' => $m->id, 'name' => $m->name, 'ready' => $thumb,
                'thumbUrl' => $thumb ? $m->getUrl('thumb') : null,
                'url' => $big ? $m->getUrl('big') : ($thumb ? $m->getUrl('thumb') : null),
                'width' => $m->getCustomProperty('width'), 'height' => $m->getCustomProperty('height'),
            ];
        }

        return $out;
    }

    /** Only same-site relative back links are honoured (no open redirect). */
    private function backUrl(Request $request): string
    {
        $back = (string) $request->query('back', '');

        return preg_match('#^/(?!/)[^\s\\\\]*$#', $back) ? $back : url('/');
    }

    private function authorizeEdit(Document $document): void
    {
        if ($ability = config('vibuilder.authorize')) {
            Gate::authorize($ability, $document);
        }
    }
}
