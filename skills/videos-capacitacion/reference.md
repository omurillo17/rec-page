# Referencia: videos de capacitación con Seventeen Training Kit

Kit: `<KIT>` (ver `SKILL.md`). Compilar una vez: `pnpm install && pnpm build` en esa carpeta.
CLI: `node <KIT>/tools/training-cli/dist/cli.js <comando>` (abajo, `training`).

| Comando | Para qué |
|---|---|
| `training build --input <carpeta> [--only a,b] [--force] [--no-capture]` | Todo el pipeline incremental |
| `training validate --input <guion.json>` | Esquema y recursos de un guion (falla si aún no hay capturas: normal) |
| `training preview --input <guion.json>` | Remotion Studio para ajustar escenas |
| `training narrate --input <guion.json> [--voice] [--rate]` | Solo la voz (Windows SAPI, Sabina es-MX por defecto) |

Esquemas para el editor: `<KIT>/packages/content-schema/schema/{project-config,video-script}.schema.json`.

## Plantilla `training.config.json`

```json
{
  "$schema": "<ruta relativa al kit>/packages/content-schema/schema/project-config.schema.json",
  "baseUrl": "http://127.0.0.1:3101",
  "viewport": { "width": 1366, "height": 768, "scale": 1.5 },
  "hide": ["nextjs-portal"],
  "locale": "es-MX",
  "setup": "docker compose -f demo/docker-compose.yml up -d",
  "server": { "command": "node demo/dev.mjs", "readyUrl": "http://127.0.0.1:3101/login", "timeoutSec": 180 },
  "beforeLesson": "node demo/reset.mjs",
  "macros": {
    "login": [
      { "goto": "/login" },
      { "fill": "input[type=text]", "value": "usuario.demo" },
      { "fill": "input[type=password]", "value": "<la del seed>" },
      { "click": "button[type=submit]" },
      { "waitFor": "<selector visible solo con sesión>", "timeout": 30000 },
      { "sleep": 1500 }
    ],
    "cerrar-avisos": [
      { "sleep": 4500 },
      { "eval": "document.querySelectorAll('[title=\"Cerrar\"]').forEach((x) => x.click())" },
      { "sleep": 800 }
    ]
  },
  "narration": { "rate": 1 },
  "outDir": "../frontend/public/capacitacion/videos",
  "publicPath": "/capacitacion/videos/",
  "dataFile": "../frontend/src/lib/capacitacion-videos.json",
  "changeThreshold": 0.004
}
```

Las contraseñas de los macros son las del `seed.sql` demo (cuentas ficticias en una base local aislada).

## Plantilla de guion

```json
{
  "$schema": "<ruta>/video-script.schema.json",
  "id": "slug-de-la-leccion",
  "title": "Título de la lección",
  "lang": "es",
  "status": "draft",
  "format": { "orientation": "landscape", "size": 1920, "fps": 30 },
  "theme": { "primary": "#0C66AC", "background": "#0B1E33" },
  "burnCaptions": false,
  "capture": [
    { "use": "login" },
    { "goto": "/modulo", "wait": 4000 },
    { "shot": "01-pantalla", "regions": { "boton": "text=Nuevo", "tabla": "table" } }
  ],
  "scenes": [
    { "template": "intro", "durationSec": 5, "title": "…", "chapter": "Introducción", "objective": "…", "narration": { "text": "…" } },
    { "template": "demo", "durationSec": 8, "title": "…", "screenshot": "captures/01-pantalla.png",
      "highlights": [{ "region": "boton", "label": "Nuevo" }, { "region": "tabla" }], "narration": { "text": "…" } },
    { "template": "steps", "durationSec": 10, "title": "…", "steps": ["…", "…"], "screenshot": "captures/01-pantalla.png", "highlights": [{ "region": "tabla" }], "narration": { "text": "…" } },
    { "template": "result", "durationSec": 6, "title": "…", "description": "…", "screenshot": "captures/01-pantalla.png", "narration": { "text": "…" } },
    { "template": "outro", "durationSec": 7, "title": "Antes de terminar", "mistakes": ["…"], "conclusion": "…", "narration": { "text": "…" } }
  ]
}
```

`durationSec` es un mínimo: la voz alarga la escena si hace falta. Los resaltados aparecen en orden,
uno cada 1,2 s; pon máximo 4 por escena.

## Pasos de captura

| Paso | Notas |
|---|---|
| `{ "goto": "/ruta", "wait": 3000 }` | Relativo a `baseUrl`. |
| `{ "click": "<selector>" }` | `.click()` de DOM. |
| `{ "click": "<selector>", "real": true }` | Clic real de mouse (CDP). Úsalo en widgets que escuchan mousedown: calendarios (react-big-calendar), gráficas (recharts), drag & drop. |
| `{ "fill": "<selector>", "value": "…" }` | Escribe como usuario (compatible con React). |
| `{ "waitFor": "<selector>", "timeout": 15000 }` | Espera a que exista. |
| `{ "sleep": 1000 }` | Pausa. |
| `{ "eval": "js" }` | JS en la página (cerrar avisos, hacer scroll). |
| `{ "run": "comando" }` | En la máquina, desde la carpeta del config: SQL en la demo, encender/apagar un stub. |
| `{ "use": "macro" }` | Inserta un macro. Para cambiar de usuario basta otro macro de login (sobrescribe la cookie). |
| `{ "shot": "01-nombre", "regions": { "clave": "<selector>" } }` | Captura y medidas (solo la parte visible). |

Selectores: CSS (`#id`, `[aria-label="…"]`, `table`), `text=Texto visible` (exacto primero y luego prefijo,
sin distinguir mayúsculas), o `js=<expresión que devuelve un elemento>`.

## Errores comunes (y su arreglo)

| Síntoma | Causa | Arreglo |
|---|---|---|
| `no encontré: x` con `text=` | El texto lleva emoji, número o mayúsculas por CSS (`text-transform`) | `js=[...document.querySelectorAll('*')].find(e => e.childElementCount <= 1 && /patrón/i.test(e.textContent.trim()))` |
| La captura sale con "Cargando…" | `waitFor` encontró el texto en otro lugar (p. ej., la vista previa de la lista) | Espera el texto dentro del contenedor correcto: `js=[...contenedor.querySelectorAll('*')].find(...)` |
| Un aviso (toast) tapa botones | La acción muestra notificaciones | Macro `cerrar-avisos` antes del `shot` |
| Un modal de alerta tapa todas las pantallas | Datos del seed que disparan una alerta global | Que el seed no la active; actívala con un paso `run` solo en la lección que la muestra |
| Clic sin efecto en calendario o gráfica | El widget no escucha `click` sintético | `"real": true` |
| Fechas en formato de EE. UU. | Idioma del navegador | `"locale": "es-MX"` en el config |
| El indicador de Next.js ("N") aparece | Overlay de desarrollo | `"hide": ["nextjs-portal"]` |
| Región más alta que la pantalla | Tablas largas | El kit la recorta a lo visible; mejor resalta un contenedor más chico |
| "Timed out … setting up the headless browser" | Chrome tardó en iniciar | El build reintenta una vez; si persiste, vuelve a correr con `--only` |
| `next build` falla por un archivo `.next/dev/types/...` | Tipos viejos del servidor de desarrollo | Borra `.next/dev` |
| Login demo falla tras el reset | Conexiones viejas al recrear la BD o compilación en frío | `timeout: 30000` en el `waitFor` del macro de login |

## Patrón `demo/dev.mjs` (Next.js; adaptar a otro stack)

- Un `http.createServer` local que imite los servicios externos que la UI consulta al cargar
  (por ejemplo, el estado de WhatsApp) y acepte cualquier envío sin hacer nada. Un archivo bandera
  (`demo/.servicio-caido`) puede cambiar su respuesta para capturar pantallas de error.
- `spawn(next dev -p 3101)` con `env` que **sobrescribe** `DATABASE_URL`, `JWT_SECRET`, claves y URLs de
  servicios (las variables de proceso tienen prioridad sobre `.env.local`).
- Servicios que solo se usan al pulsar botones que no grabarás: apúntalos a `http://127.0.0.1:9`.

Para Django, Rails o PHP aplica la misma idea: settings/env de demo, base aislada y stubs.

## Integración en la app

- Si la app tiene su propio módulo de lecciones: importa el `dataFile` y completa cada lección por `slug`
  (`src`, `poster`, `captions[0].src`, `durationSec`, `chapters`). Reproductor nativo con `<track>` WebVTT,
  capítulos, velocidad y transcripción a partir del mismo `.vtt`.
- Si no tiene: `<seventeen-training manifest="…" module="…">` del kit (ver `<KIT>/docs/integracion.md`).
- Los videos van en una carpeta servida **detrás del login** si la app es interna.

## Licencias y voz

- Remotion: gratis para personas y empresas de hasta 3 empleados; más allá requiere licencia de empresa.
- Voz: Windows SAPI (gratis, local). Si el usuario quiere otra voz, opciones en `<KIT>/docs/videos.md`.
