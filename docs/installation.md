# Installation (local, unpublished)

In the consuming project:

```json
{
  "repositories": [
    { "type": "path", "url": "../vibuilder", "options": { "symlink": true } }
  ],
  "require": { "markxxv/vibuilder": "@dev" }
}
```

```bash
composer require markxxv/vibuilder:@dev
php artisan vendor:publish --tag=vibuilder-config
php artisan migrate
```

Because of `symlink`, every change to the package is visible in the project immediately. Later, replace `path` with a `vcs` repository pointing at git.

## Usage

Give a model a builder document:

```php
use Vibuilder\Concerns\HasVibuilder;

class Page extends Model { use HasVibuilder; }
```

Open the full-screen editor from your admin (Filament example):

```php
Action::make('builder')
    ->label('Page builder')
    ->url(fn (Page $record) => route('vibuilder.editor', [
        'document' => $record->ensureVibuilder(),
        'title' => $record->title,
        'back' => '/admin/pages',
    ]));
```

Render on the public site:

```blade
<x-vibuilder::document :content="$page->ensureVibuilder()" />
```

Set `vibuilder.authorize` to a Gate ability to restrict who can edit (receives the `Document`), and add the
stylesheet to your Tailwind entry (see [css-conventions.md](css-conventions.md)).

## Developing the package

```bash
composer update && composer test   # PHP
npm ci && npm run typecheck && npm run test:js   # editor logic (Node 22.6+)
npm run test:e2e                   # real-browser editor test (Chrome required)
npm run build                      # rebuild dist/ (commit the result)
```

Schedule `vibuilder:purge-uploads` daily (see [media-and-uploads.md](media-and-uploads.md)).
