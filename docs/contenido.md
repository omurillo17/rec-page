# Formato del contenido

Cada aplicación guarda su capacitación en una carpeta propia, versionada con su código:

```
training/                      # servida por la app (pública o protegida)
  manifest.json
  tours/registrar-cliente.json
  videos/registrar-cliente.mp4
  videos/registrar-cliente.es.vtt
  videos/registrar-cliente.jpg
training-src/                  # NO se sirve: guiones y capturas para generar videos
  registrar-cliente/registrar-cliente.script.json
  registrar-cliente/captures/*.png
```

Los esquemas JSON para autocompletar en el editor están en
`packages/content-schema/schema/*.schema.json` (se generan desde Zod con `pnpm build`).
Agrégalos con `"$schema": "<ruta>/manifest.schema.json"`.

Todas las rutas de recursos aceptan tres formas: relativa (`videos/a.mp4`), absoluta
(`/media/a.mp4`) o `https://`. Se rechazan `javascript:`, `data:`, `http:` y los segmentos `..`.

## Manifiesto

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

| Campo | Notas |
|---|---|
| `schemaVersion` | Versión del formato. Hoy es `1`. Cambia solo con cambios incompatibles (ver [actualizacion.md](actualizacion.md)). |
| `appId` | Identificador de la app: minúsculas, números y guiones. |
| `contentVersion` | SemVer del contenido. Súbela al cambiar el contenido. |
| `status` | `draft`, `review`, `published` o `archived`. Si el manifiesto no está `published`, no se muestra nada (salvo con `include-drafts`). |
| `ui` | Versiones de la UI de la app para las que se escribieron los recorridos: `minVersion <= app-version < maxVersion`. Fuera del rango, los recorridos se ocultan y los videos siguen visibles. |
| `assetsBase` | Base de las rutas relativas. Por defecto, la carpeta del manifiesto. |
| `roles` | **Informativo.** Indica a quién va dirigido el contenido. La app filtra en su servidor (ver [seguridad.md](seguridad.md)). |
| `access` | `public` o `protected`. La CLI advierte si contenido `protected` está en `public/`, `static/` o en una URL https. |
| `video.durationSec` | Duración en segundos. La CLI comprueba que subtítulos y capítulos no la excedan. |
| `video.chapters` | En orden creciente. `training render` imprime el bloque `video` completo, con capítulos. |

Los objetos son estrictos: un campo desconocido (por ejemplo, `token`) es un error.

## Recorrido

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

| Campo | Valor por defecto | Uso |
|---|---|---|
| `element` | (ninguno) | Selector CSS. Usa atributos `data-training`: sobreviven a cambios de diseño, y la CLI advierte si no los usas. |
| `side` / `align` | Driver.js decide | `top`, `right`, `bottom`, `left` u `over` / `start`, `center` o `end`. |
| `optional` | `false` | `true`: omite el paso si el elemento no existe (por ejemplo, botones que solo ve un rol). |
| `waitForMs` | `3000` | Tiempo de espera para que el elemento aparezca (formularios que se abren, listas que cargan). Máximo 30 000. |

Marca el HTML de la app con `data-training`:

```html
<button data-training="client-create">+ Nuevo cliente</button>
```

## Guion de video

Ver [videos.md](videos.md).
