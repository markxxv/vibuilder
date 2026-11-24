<?php

declare(strict_types=1);

namespace Vibuilder\Concerns;

use Illuminate\Database\Eloquent\Relations\MorphOne;
use Vibuilder\Models\Document;
use Vibuilder\Schema\DocumentValidator;

/**
 * Add to any Eloquent model that owns a builder document (a page, a post, ...).
 *
 *   $page->vibuilder                       // the Document or null
 *   $page->ensureVibuilder()               // creates an empty one on first use
 *   route('vibuilder.editor', $page->ensureVibuilder())   // full-screen editor URL
 */
trait HasVibuilder
{
    public function vibuilder(): MorphOne
    {
        return $this->morphOne(Document::class, 'documentable')->where('key', 'default');
    }

    public function ensureVibuilder(): Document
    {
        $existing = $this->vibuilder()->first();
        if ($existing) {
            return $existing;
        }
        $content = ['version' => DocumentValidator::VERSION, 'sections' => []];

        return $this->vibuilder()->create(['key' => 'default', 'content' => $content, 'revision' => Document::revisionOf($content)]);
    }
}
