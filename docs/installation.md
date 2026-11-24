# Установка (локально, без публикации)

В проекте-потребителе:

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

Из-за `symlink` любая правка пакета сразу видна в проекте. Позже вместо `path` можно указать `vcs` на git-репозиторий.

## Разработка пакета

```bash
composer update
composer test
```
