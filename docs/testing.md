# Testing in a real Laravel + Filament app

A throwaway host app to try the package end to end, and a one-command way to pull every new commit.
Needs PHP 8.3 with `gd` (WebP support), Composer, Node 20+.

> The PHP side (controllers, routes, views, media) has been verified only by lint and unit tests so far.
> This is the first live run, so please report anything odd (see "Reporting problems").

## 1. Fresh host (once)

```bash
composer create-project laravel/laravel vb-host && cd vb-host
composer require filament/filament
php artisan filament:install --panels
php artisan make:filament-user
```

In `.env` set `QUEUE_CONNECTION=sync` (so the `big` image conversion runs immediately; with a real queue run `php artisan queue:work`).

```bash
php artisan migrate && php artisan storage:link
```

## 2. Connect the package (once)

Pick one. Both give you the same one-command update later.

**A. Local clone (recommended on a dev machine; edits and `git pull` show up instantly)**

```bash
git clone https://github.com/markxxv/vibuilder ../vibuilder
composer config repositories.vibuilder path ../vibuilder
composer require markxxv/vibuilder:@dev mallardduck/blade-lucide-icons
```

**B. Straight from GitHub (use on a server)**

```bash
composer config repositories.vibuilder vcs https://github.com/markxxv/vibuilder
composer require markxxv/vibuilder:dev-main mallardduck/blade-lucide-icons
```

Then the Media Library tables and the package tables:

```bash
php artisan vendor:publish --provider="Spatie\MediaLibrary\MediaLibraryServiceProvider" --tag=medialibrary-migrations
php artisan migrate
```

Add the public styles to `resources/css/app.css` (Tailwind 4, below `@import "tailwindcss";`):

```css
@import "../../vendor/markxxv/vibuilder/resources/css/vibuilder.css";
```

```bash
npm install && npm run build
```

## 3. Demo page model + Filament button (once)

```bash
php artisan make:model Page -m
```

In the migration add `$table->string('title');`, then:

```php
// app/Models/Page.php
use Vibuilder\Concerns\HasVibuilder;

class Page extends Model
{
    use HasVibuilder;
    protected $fillable = ['title'];
}
```

```bash
php artisan migrate
php artisan make:filament-resource Page --generate
```

In the generated resource's table, add a row action (Filament 4/5 unified actions):

```php
use Filament\Actions\Action;

->recordActions([
    // ...existing EditAction etc.
    Action::make('builder')
        ->label('Page builder')
        ->icon('heroicon-o-squares-2x2')
        ->url(fn (\App\Models\Page $record) => route('vibuilder.editor', [
            'document' => $record->ensureVibuilder(),
            'title' => $record->title,
            'back' => '/admin/pages',
        ])),
])
```

A public page to check the real output:

```php
// routes/web.php
Route::get('/p/{page}', fn (\App\Models\Page $page) => view('page', ['doc' => $page->ensureVibuilder()]));
```

```blade
{{-- resources/views/page.blade.php --}}
<!doctype html><html><head>@vite('resources/css/app.css')</head>
<body><x-vibuilder::document :content="$doc" /></body></html>
```

## 4. One command to pull updates (the loop)

Add to the host's `composer.json`:

```json
"scripts": {
    "vb": [
        "@php -r \"passthru(is_dir('../vibuilder/.git') ? 'git -C ../vibuilder pull --ff-only' : 'composer update markxxv/vibuilder --no-interaction');\"",
        "@php artisan vendor:publish --provider=\"Spatie\\\\MediaLibrary\\\\MediaLibraryServiceProvider\" --tag=medialibrary-migrations --force",
        "@php artisan migrate --force",
        "@php artisan optimize:clear",
        "npm run build"
    ]
}
```

From then on, after each push of mine:

```bash
composer vb
```

The editor bundle is prebuilt in the package's `dist/`, so no Node build of the package is needed. `npm run build`
in the host only rebuilds your site CSS (needed when `vibuilder.css` changes; harmless otherwise).
The `--force` publish line only matters if a later package version ships new Media Library migrations; remove it if
you prefer to run it by hand.

## 5. Smoke test checklist

Open **Admin → Pages → create a page → Page builder**.

- [ ] Editor opens full-screen; toolbar shows the page title; **Back** returns to the admin.
- [ ] **Add section**; hover the section, click **+**, add Heading, Lead, Grid (3 empty columns appear).
- [ ] Click into the heading and type; page does not jump or scroll. Undo (Ctrl/Cmd+Z) reverts a typing burst in one step.
- [ ] In a column add Icon, Heading, Text, Image, Button. Select the grid → **Columns**: set desktop 3 / tablet 2 / mobile 1; switch the device buttons and watch it change.
- [ ] Text block: click, select words, bubble menu (bold, link).
- [ ] Icon: click, search "house", pick. Image: click → **Upload** a 5–10 MB JPEG: progress bar, thumbnail appears; pick it. Network tab should show about 13–25 small `PUT .../chunks/N` requests.
- [ ] Drag a section/column by its handle to reorder; drag an element into another column.
- [ ] **Save**, reload: everything is still there. Open the same page in two tabs, save in one, then the other: you get a clear "changed in another tab" message and nothing is overwritten.
- [ ] Open `/p/1`: same layout as the editor, icons render, resizing the window changes columns, no placeholders or empty boxes.

## 6. Testing a new feature after an update

1. `composer vb`
2. Read **Unreleased** in `CHANGELOG.md` for what changed.
3. Repeat the matching items above, plus anything the changelog calls out.

## Reporting problems

Send me: what you did, the browser console errors, the failing request from the Network tab (URL, status, response),
and the last lines of `storage/logs/laravel.log`. Useful checks:

| Symptom | Check |
| --- | --- |
| 404 on the editor or media API | `php artisan route:list --path=vibuilder`, then `php artisan optimize:clear` |
| Editor page is blank | Browser console; make sure `/admin/vibuilder/assets/vibuilder-editor.js` loads (200) |
| Image stays "processing" | `QUEUE_CONNECTION=sync` or run `php artisan queue:work`; PHP `gd` must support WebP |
| 413 on upload | Proxy body limit below 400 KB (nginx `client_max_body_size`) |
| 419 on save/upload | Session expired; reload |
| Icons missing on the public page | `composer require mallardduck/blade-lucide-icons`, then `php artisan optimize:clear` |
| Public page unstyled | The `@import` line in `app.css` and `npm run build` |

## Package-side checks (for development)

```bash
composer test          # PHP unit tests
npm run typecheck && npm run test:js   # editor logic
npm run test:e2e       # real-Chrome editor test
npm run build          # rebuild dist/ and commit it
```
