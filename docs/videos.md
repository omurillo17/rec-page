# Generación de videos
[English](en/videos.md) · **Español**

Este flujo convierte un **guion JSON** y **capturas reales** en un borrador MP4 con subtítulos
WebVTT sincronizados, miniatura y capítulos. Usa Remotion (React → fotogramas en Chrome
Headless Shell) y el FFmpeg que Remotion incluye. No llama a ningún servicio externo ni
necesita claves.

## Pipeline automático: `training build` (recomendado)

Cada app tiene una carpeta de capacitación con un `training.config.json` y una subcarpeta por
lección con su `<id>.script.json`. El guion contiene **los pasos para reproducir el procedimiento**
(`capture`) y **las escenas del video** (`scenes`). Un comando hace todo:

```bash
training build --input capacitacion-videos [--only id1,id2] [--force] [--no-capture]
```

```
setup + server ─► por lección: beforeLesson ─► capture (Chrome headless, app real con datos demo)
   ─► ¿la captura cambió? (comparación de píxeles; bajo changeThreshold se conserva la anterior)
   ─► narrate (solo escenas con texto nuevo) ─► validate ─► render solo si cambió el hash de entradas
   ─► dataFile (JSON que la app importa: URL, miniatura, subtítulos, duración, capítulos)
```

`training.config.json`:

```json
{
  "baseUrl": "http://127.0.0.1:3101",
  "viewport": { "width": 1366, "height": 768, "scale": 1.5 },
  "hide": ["nextjs-portal"],
  "setup": "docker compose -f demo/docker-compose.yml up -d",
  "server": { "command": "node demo/dev.mjs", "readyUrl": "http://127.0.0.1:3101/login" },
  "beforeLesson": "node demo/reset.mjs",
  "macros": { "login": [{ "goto": "/login" }, { "fill": "input[type=text]", "value": "demo" }, { "click": "button[type=submit]" }] },
  "narration": { "rate": 1 },
  "outDir": "../frontend/public/capacitacion/videos",
  "publicPath": "/capacitacion/videos/",
  "dataFile": "../frontend/src/lib/capacitacion-videos.json"
}
```

Pasos de `capture`:

| Paso | Qué hace |
|---|---|
| `{ "goto": "/ruta", "wait": 3000 }` | Navega (relativo a `baseUrl`) y espera. |
| `{ "fill": "<selector>", "value": "…" }` | Escribe como un usuario (compatible con React). |
| `{ "click": "<selector>" }`, `{ "waitFor": "<selector>", "timeout": 15000 }`, `{ "sleep": 1000 }` | Interacción y esperas. |
| `{ "eval": "js" }` | JavaScript en la página (por ejemplo, cerrar avisos). |
| `{ "run": "comando" }` | Comando en la máquina, desde la carpeta del config (por ejemplo, SQL en la base demo). |
| `{ "use": "macro" }` | Inserta una macro de `training.config.json`. |
| `{ "shot": "01-inicio", "regions": { "guardar": "text=Guardar" } }` | Captura `captures/01-inicio.png` y mide cada región. |

Selectores: CSS (`#id`, `[aria-label="…"]`), texto visible (`text=Guardar`) o una expresión JS
que devuelve un elemento (`js=document.querySelector('#x').closest('aside')`).

Incremental:
- **Capturas:** si menos de `changeThreshold` (0,4 %) de los píxeles cambia (relojes, "hace 5 min"),
  se conserva la imagen anterior.
- **Voz:** se regenera solo la escena cuyo texto, voz o velocidad cambió (`audio/narration.json`).
- **Video:** se re-renderiza solo si cambia el hash de guion + capturas + audio + plantillas. Si no,
  se informa «sin cambios».
- **Archivo de datos:** sus claves se ordenan para que git solo muestre cambios reales.

La app importa el `dataFile` y completa sus lecciones con él (por ejemplo, una función que busca
cada lección por su `slug` y le agrega `src`, `poster`, subtítulos y capítulos).

## Flujo manual (comandos sueltos)

```
1. Capturas reales ──► 2. Guion JSON ──► 3. training validate ──► 4. training preview / render
                                                                          │
                     MP4 + .vtt + .jpg + bloque "video" para el manifiesto ◄┘
5. Una persona revisa el procedimiento en la app real ──► status: "verified" ──► render final
```

1. **Capturas.** Tómalas de la app real con datos ficticios. La demo incluye
   `apps/demo-html/scripts/capture.mjs`: abre la app en Chrome Headless, ejecuta el
   procedimiento, guarda PNG y escribe `captures/regions.json` con la posición medida de cada
   `[data-training]`. Esas coordenadas se usan como resaltados.
2. **Guion.** Guárdalo en una carpeta que no se publique, junto con sus capturas
   (`training-src/<id>/<id>.script.json`).
3. **Validación.** `pnpm training validate --input training-src/registrar-cliente/registrar-cliente.script.json`
   comprueba el esquema y que existan todas las capturas y los audios.
4. **Previsualización:** `pnpm training preview --input …` abre Remotion Studio.
   **Render:** `pnpm training render --input … --out public/training/videos`. Con
   `--size 640` se obtiene un borrador rápido.
5. Copia el bloque `video` que imprime `render` al manifiesto y ejecuta `training validate`
   sobre la carpeta de la app.

## Guion

```json
{
  "$schema": "../../../../packages/content-schema/schema/video-script.schema.json",
  "id": "registrar-cliente",
  "title": "Cómo registrar un cliente",
  "lang": "es",
  "status": "draft",
  "format": { "orientation": "landscape", "size": 1280, "fps": 30 },
  "theme": { "primary": "#2563eb", "background": "#0f172a" },
  "music": { "src": "audio/fondo.mp3", "volume": 0.15 },
  "burnCaptions": false,
  "scenes": [
    { "template": "intro", "durationSec": 5, "title": "Cómo registrar un cliente", "objective": "Dar de alta un cliente.",
      "narration": { "text": "En este video aprenderás…", "audio": "audio/01.wav" } },
    { "template": "demo", "durationSec": 6, "title": "Abre el formulario", "screenshot": "captures/01-listado.png",
      "highlights": [{ "x": 0.825, "y": 0.15, "width": 0.117, "height": 0.057, "label": "Nuevo cliente" }],
      "narration": { "text": "Pulsa Nuevo cliente." } },
    { "template": "steps", "durationSec": 10, "title": "Captura los datos", "steps": ["Nombre", "RFC", "Correo"], "screenshot": "captures/02-formulario.png" },
    { "template": "result", "durationSec": 6, "title": "Cliente registrado", "description": "Aparece al inicio del listado.", "screenshot": "captures/03-resultado.png" },
    { "template": "outro", "durationSec": 7, "title": "Antes de terminar", "mistakes": ["RFC con espacios."], "conclusion": "Inicia el recorrido guiado si tienes dudas." }
  ]
}
```

| Plantilla | Uso | Campos propios |
|---|---|---|
| `intro` | Introducción y objetivo | `objective` |
| `demo` | Demostración sobre una captura | `screenshot` (obligatoria), `highlights` |
| `steps` | Explicación paso a paso, con captura opcional | `steps` (1–8), `screenshot`, `highlights` |
| `result` | Resultado esperado | `description`, `screenshot` (obligatoria), `highlights` |
| `outro` | Errores frecuentes y conclusión | `mistakes` (0–6), `conclusion` |

- **Resolución y orientación:** `format.size` es el lado largo (1280 → 1280×720, o 720×1280
  en vertical). Las dimensiones se redondean a pares (requisito de H.264). Para video vertical,
  usa capturas de la vista móvil: una captura de escritorio queda pequeña.
- **Resaltados:** `x`, `y`, `width` y `height` son fracciones (0–1) de la captura. Aparecen uno
  tras otro; el activo oscurece el resto y pulsa suavemente.
- **Narración opcional:** `narration.text` genera los subtítulos. `narration.audio` agrega
  una voz grabada (WAV o MP3) en la escena. La escena debe durar al menos lo que dura el audio.
  En Windows, `training narrate` la genera con la voz local (ver abajo).
- **Voz local (Windows):** `training narrate --input <guion.json> [--voice "Microsoft Sabina Desktop"] [--rate -10..10]` genera un WAV por escena con las voces de Windows (SAPI, sin internet ni costo). Escribe `narration.audio` y `narration.durationSec`, y alarga `durationSec` de la escena para que quepa la voz. Los subtítulos siguen la duración real del audio. En Linux o macOS, graba el audio y usa `narration.audio`.
- **Resaltados por nombre:** en lugar de coordenadas, usa `{ "region": "guardar", "label": "Guardar" }`. El rectángulo se lee de `regions.json` junto a la captura (`{ "<captura>": { "<región>": {x,y,width,height} } }`), que escribe el script de captura. Si vuelves a capturar, los resaltados se actualizan sin tocar el guion. Las regiones se recortan al área visible.
- **Subtítulos sincronizados:** cada narración se divide en frases (máx. 84 caracteres) y se
  reparte en la escena según su longitud. El mismo cálculo produce el `.vtt` y los subtítulos
  quemados (`burnCaptions: true`), así que siempre coinciden. Por defecto no se queman: el
  reproductor muestra la pista WebVTT, que el usuario puede desactivar y que la transcripción
  reutiliza.
- **Música opcional:** `music.src` y `music.volume` (0–1). Se repite durante todo el video.
- **Animaciones discretas:** entradas con `spring` de 0,6 s y barra de progreso. Con
  `prefers-reduced-motion`, Remotion renderiza igual; el reproductor del kit respeta la
  preferencia en los recorridos.
- **Honestidad:** el renderer no genera interfaces. Las escenas `demo` y `result` exigen una
  captura real, y la CLI falla si falta un archivo. Mientras `status` sea `draft`, el video
  lleva la marca «BORRADOR · procedimiento no verificado». Cámbialo a `verified` solo cuando
  una persona haya ejecutado el procedimiento en la app real.

## Requisitos

| Requisito | Detalle |
|---|---|
| Node.js ≥ 20 | Probado con Node 24.16 en Windows 11. |
| Chrome Headless Shell | Remotion lo descarga la primera vez (~120 MB) en `node_modules/.remotion`. Ejecuta los comandos desde la raíz del repositorio para reutilizar una sola copia. |
| FFmpeg | No hace falta instalarlo: viene en `@remotion/compositor-<plataforma>`. |
| Linux sin entorno gráfico | Instala las bibliotecas de Chrome (`libnss3`, `libatk-bridge2.0-0`, `libgbm1`, fuentes…). Ver la guía de Remotion sobre Linux. |
| Tiempo | 40 s de video a 1280×720 tardan ~1,5 min en un equipo de escritorio. |

## Licencias de las dependencias de renderizado

> Resumen técnico, no asesoría legal. Revísalo con el área legal antes de usarlo en producción.

| Dependencia | Licencia | Impacto |
|---|---|---|
| **Remotion** (`remotion`, `@remotion/*` 4.0.535) | Remotion License (source-available) | **Gratuita** para personas, empresas con fines de lucro de **hasta 3 empleados** y organizaciones sin fines de lucro. **Una empresa más grande necesita una Company License** (remotion.pro). Revisa en remotion.dev/license si tu organización califica para la licencia gratuita. La versión 5.0 anuncia cambios en la licencia. |
| **FFmpeg 7.1** incluido por Remotion | GPL (compilado con `--enable-gpl`, libx264 y libx265) e incluye libfdk-aac | Usarlo internamente para producir videos no obliga a publicar código. **Redistribuir** ese binario sí tiene obligaciones GPL, y libfdk-aac tiene una licencia no compatible con GPL para redistribución. No incluyas `node_modules` en instaladores para terceros. H.264 y AAC son formatos con patentes; la distribución comercial de videos suele estar cubierta, pero confírmalo con el área legal. |
| Chrome Headless Shell | Licencias de Chromium (BSD y otras) y términos de Google | Se descarga de Google en la primera ejecución. |
| React, Zod, Driver.js, Vite, Vitest | MIT | Sin restricciones relevantes. |
| TypeScript | Apache-2.0 | Sin restricciones relevantes. |

El kit que llega al navegador (`seventeen-training.js`) **no incluye** Remotion ni FFmpeg:
solo Zod y Driver.js (MIT). La licencia de Remotion afecta únicamente a quien genera videos.

**Alternativa sin Remotion** (si la licencia no es viable): las plantillas son React y CSS. Se
pueden capturar los fotogramas con Playwright y unirlos con un FFmpeg LGPL (`libopenh264`).
Ese camino no está implementado en este MVP.
