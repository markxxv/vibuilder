# Модель документа (v1)

```
Document
└─ Section            (id, anchor, classes[], variant)
   ├─ heading         H2 (в hero H1)
   ├─ lead            подзаголовок / lead text
   ├─ button          кнопка или ссылка
   └─ grid            (columns: desktop/tablet/mobile)
      └─ Cell         колонка сетки
         ├─ heading   H3–H6
         ├─ text      Tiptap rich text
         ├─ image     ссылка на медиатеку
         ├─ icon      Lucide
         └─ button    кнопка или ссылка
```

Элементы внутри секции стоят **на одном уровне** и свободно переставляются. Готовые карточки (templates) — это
заготовки, которые вставляют в ячейку набор элементов; отдельного типа «карточка» в JSON нет.

## Секция

| Поле | Тип | Правила |
| --- | --- | --- |
| `id` | uuid | уникален в документе |
| `type` | `"section"` | |
| `anchor` | string | авто (`section-xxxxxxxx`), можно править; `^[a-z][a-z0-9-]{0,63}$`, уникален в документе |
| `classes` | string[] | tags input, до 10; `^[a-z][a-z0-9_-]{0,47}$`; семантические имена, не утилиты |
| `variant` | `default` \| `hero` | в `hero` заголовок секции — H1 |
| `children` | element[] | `heading`, `lead`, `button`, `grid`; до 50 |

Схема требует H1 только в `hero`-секции и H2 в остальных. Что на странице один H1, проверяет рендерер, а не схема.

## Grid

| Поле | Правила |
| --- | --- |
| `columns.desktop` | 1, 2, 3, 4, 6 |
| `columns.tablet` | 1, 2, 3, 4 |
| `columns.mobile` | 1, 2, 3 |
| `classes` | как у секции |
| `cells` | до 24 ячеек, каждая `{id, children[]}`, в ячейке до 20 элементов |

Колонки задаются независимо для трёх устройств; мобильное значение не связано с desktop.

## Элементы

| `type` | Где | Поля |
| --- | --- | --- |
| `heading` | секция: level 2 (1 в hero); ячейка: 3–6 | `level`, `text` ≤ 255 |
| `lead` | секция | `text` ≤ 500 |
| `text` | ячейка | `content` — Tiptap JSON |
| `image` | ячейка | `mediaId` (id из медиатеки или `null`), `alt` ≤ 255 |
| `icon` | ячейка | `name` — имя Lucide в kebab-case или `""` |
| `button` | секция, ячейка | `label` ≤ 120, `url`, `variant` (`primary`/`secondary`/`link`), `newTab` |

### Tiptap

Узлы: `doc`, `paragraph`, `text`, `bulletList`, `orderedList`, `listItem`, `hardBreak`. Метки: `bold`, `italic`,
`strike`, `underline`, `link`. Глубина до 12. HTML не хранится.

### URL

Разрешены: `http(s)://`, путь с одним начальным `/`, `#fragment`, `mailto:`, `tel:`. Запрещены: `//host`, пробелы,
обратный слэш, управляющие символы, `javascript:`, `data:`. Длина до 2048.

## Лимиты

Версия 1, до 100 секций, id уникальны во всём документе, JSON до 1 МиБ.

## Пример

```json
{
  "version": 1,
  "sections": [{
    "id": "8aa9d7bf-f34c-4c19-9c84-5bca5929cbc4",
    "type": "section",
    "anchor": "section-a1b2c3d4",
    "classes": ["services"],
    "variant": "default",
    "children": [
      {"id": "11111111-1111-4111-8111-111111111111", "type": "heading", "level": 2, "text": "Наши услуги"},
      {"id": "22222222-2222-4222-8222-222222222222", "type": "lead", "text": "Коротко о главном"},
      {"id": "33333333-3333-4333-8333-333333333333", "type": "grid",
       "columns": {"desktop": 3, "tablet": 2, "mobile": 1}, "classes": [],
       "cells": [{"id": "44444444-4444-4444-8444-444444444444", "children": [
         {"id": "55555555-5555-4555-8555-555555555555", "type": "icon", "name": "file-text"},
         {"id": "66666666-6666-4666-8666-666666666666", "type": "heading", "level": 3, "text": "Документы"}
       ]}]}
    ]
  }]
}
```
