<?php

declare(strict_types=1);

namespace Vibuilder\View\Components;

use Illuminate\Support\HtmlString;
use Illuminate\View\Component;
use Vibuilder\Models\Document as DocumentModel;
use Vibuilder\Render\Renderer;

/** Usage: <x-vibuilder::document :content="$document" /> (model or decoded JSON array). */
class Document extends Component
{
    public function __construct(public DocumentModel|array|null $content = null)
    {
    }

    public function render(): \Closure
    {
        return function () {
            $data = $this->content instanceof DocumentModel ? $this->content->content : $this->content;
            $html = is_array($data) ? app(Renderer::class)->render($data) : '';

            return (string) new HtmlString($html);
        };
    }
}
