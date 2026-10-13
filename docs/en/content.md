# Content format

**English** · [Español](../contenido.md)

Each application keeps its training in its own folder, versioned alongside its code:

```
training/                      # served by the app (public or protected)
  manifest.json
  tours/registrar-cliente.json
  videos/registrar-cliente.mp4
  videos/registrar-cliente.es.vtt
  videos/registrar-cliente.jpg
training-src/                  # NOT served: scripts and captures used to generate videos
  registrar-cliente/registrar-cliente.script.json
  registrar-cliente/captures/*.png
```

The JSON schemas for editor autocompletion are in
`packages/content-schema/schema/*.schema.json` (generated from Zod with `pnpm build`).
Add them with `"$schema": "<path>/manifest.schema.json"`.

All resource paths accept three forms: relative (`videos/a.mp4`), absolute
(`/media/a.mp4`) or `https://`. `javascript:`, `data:`, `http:` and `..` segments are rejected.

## Manifest

```json
{
  "schemaVersion": 1,
  "appId": "demo-crm",
  "contentVersion": "1.0.0",
  "status": "published",
  "ui": { "minVersion": "1.0.0", "maxVersion": "2.0.0" },
  "assetsBase": "/training/files/",
  "modules": [{ "id": "clientes", "title": "Clientes", "description": "Alta y consulta." }],
  "tutorials": [
    {
      "id": "registrar-cliente",
      "module": "clientes",
      "title": "Cómo registrar un cliente",
      "description": "Da de alta un cliente con sus datos fiscales.",
      "status": "published",
      "roles": ["ventas", "admin"],
      "access": "protected",
      "tourId": "registrar-cliente",
      "tags": ["alta"],
      "accessibilityNotes": "Sin audio: los subtítulos contienen toda la explicación.",
      "video": {
        "src": "videos/registrar-cliente.mp4",
        "type": "video/mp4",
        "poster": "videos/registrar-cliente.jpg",
        "durationSec": 40,
        "captions": [{ "src": "videos/registrar-cliente.es.vtt", "srclang": "es", "label": "Español", "default": true }],
        "chapters": [{ "startSec": 0, "title": "Introducción" }, { "startSec": 5, "title": "Abre el formulario" }]
      }
    }
  ],
  "tours": [
    { "id": "registrar-cliente", "module": "clientes", "title": "Registrar un cliente", "status": "published", "src": "tours/registrar-cliente.json" }
  ]
}
```

| Field | Notes |
|---|---|
| `schemaVersion` | Format version. Currently `1`. Changes only with incompatible changes (see [upgrading.md](upgrading.md)). |
| `appId` | App identifier: lowercase letters, numbers and hyphens. |
| `contentVersion` | SemVer of the content. Bump it when the content changes. |
| `status` | `draft`, `review`, `published` or `archived`. If the manifest is not `published`, nothing is shown (except with `include-drafts`). |
| `ui` | Versions of the app UI the tours were written for: `minVersion <= app-version < maxVersion`. Outside the range, tours are hidden and videos remain visible. |
| `assetsBase` | Base for relative paths. Defaults to the manifest's folder. |
| `roles` | **Informational.** Indicates who the content is intended for. The app filters on its server (see [security.md](security.md)). |
| `access` | `public` or `protected`. The CLI warns if `protected` content is in `public/`, `static/` or at an https URL. |
| `video.durationSec` | Duration in seconds. The CLI checks that captions and chapters do not exceed it. |
| `video.chapters` | In ascending order. `training render` prints the full `video` block, with chapters. |

Objects are strict: an unknown field (for example, `token`) is an error.

## Tour

```json
{
  "id": "registrar-cliente",
  "module": "clientes",
  "title": "Cómo registrar un cliente",
  "steps": [
    { "title": "Registrar un cliente", "description": "Paso centrado: no lleva element." },
    { "element": "[data-training='client-create']", "title": "Abre el formulario", "description": "Haz clic en «Nuevo cliente» y después en «Siguiente».", "side": "bottom", "align": "end" },
    { "element": "[data-training='client-name']", "title": "Nombre", "description": "…", "side": "left", "waitForMs": 8000 },
    { "element": "[data-training='client-import']", "title": "Importar", "description": "Solo para administradores.", "optional": true, "waitForMs": 0 }
  ]
}
```

| Field | Default value | Use |
|---|---|---|
| `element` | (none) | CSS selector. Use `data-training` attributes: they survive design changes, and the CLI warns if you don't use them. |
| `side` / `align` | Driver.js decides | `top`, `right`, `bottom`, `left` or `over` / `start`, `center` or `end`. |
| `optional` | `false` | `true`: skips the step if the element does not exist (for example, buttons only one role can see). |
| `waitForMs` | `3000` | Time to wait for the element to appear (forms that open, lists that load). Maximum 30,000. |

Mark up the app's HTML with `data-training`:

```html
<button data-training="client-create">+ Nuevo cliente</button>
```

## Video script

See [videos.md](videos.md).
