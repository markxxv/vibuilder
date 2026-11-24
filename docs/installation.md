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

## Developing the package

```bash
composer update && composer test   # PHP
npm run test:js                    # upload client (Node 22.6+)
```

Schedule `vibuilder:purge-uploads` daily (see [media-and-uploads.md](media-and-uploads.md)).
