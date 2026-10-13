# Video generation

**English** · [Español](../videos.md)

This workflow turns a **JSON script** and **real screenshots** into a draft MP4 with synchronized
WebVTT captions, a thumbnail and chapters. It uses Remotion (React → frames in Chrome
Headless Shell) and the FFmpeg bundled with Remotion. It does not call any external service or
need any keys.

## Automated pipeline: `training build` (recommended)

Each app has a training folder with a `training.config.json` and one subfolder per
lesson with its `<id>.script.json`. The script contains **the steps to reproduce the procedure**
(`capture`) and **the video scenes** (`scenes`). One command does everything:

```bash
training build --input capacitacion-videos [--only id1,id2] [--force] [--no-capture]
```

```
setup + server ─► per lesson: beforeLesson ─► capture (headless Chrome, real app with demo data)
   ─► did the screenshot change? (pixel comparison; below changeThreshold the previous one is kept)
   ─► narrate (only scenes with new text) ─► validate ─► render only if the input hash changed
   ─► dataFile (JSON the app imports: URL, thumbnail, captions, duration, chapters)
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

`capture` steps:

| Step | What it does |
|---|---|
| `{ "goto": "/ruta", "wait": 3000 }` | Navigates (relative to `baseUrl`) and waits. |
| `{ "fill": "<selector>", "value": "…" }` | Types like a user (React-compatible). |
| `{ "click": "<selector>" }`, `{ "waitFor": "<selector>", "timeout": 15000 }`, `{ "sleep": 1000 }` | Interaction and waits. |
| `{ "eval": "js" }` | JavaScript in the page (for example, to dismiss notices). |
| `{ "run": "comando" }` | Command on the machine, run from the config folder (for example, SQL against the demo database). |
| `{ "use": "macro" }` | Inserts a macro from `training.config.json`. |
| `{ "shot": "01-inicio", "regions": { "guardar": "text=Guardar" } }` | Captures `captures/01-inicio.png` and measures each region. |

Selectors: CSS (`#id`, `[aria-label="…"]`), visible text (`text=Guardar`) or a JS expression
that returns an element (`js=document.querySelector('#x').closest('aside')`).

Incremental:
- **Screenshots:** if fewer than `changeThreshold` (0.4%) of the pixels change (clocks, "5 min ago"),
  the previous image is kept.
- **Voice:** only scenes whose text, voice or rate changed are regenerated (`audio/narration.json`).
- **Video:** re-rendered only if the hash of script + screenshots + audio + templates changes. Otherwise,
  it reports "unchanged".
- **Data file:** its keys are sorted so git only shows real changes.

The app imports the `dataFile` and fills in its lessons with it (for example, a function that looks up
each lesson by its `slug` and adds `src`, `poster`, captions and chapters to it).

## Manual workflow (individual commands)

```
1. Real screenshots ──► 2. JSON script ──► 3. training validate ──► 4. training preview / render
                                                                          │
                     MP4 + .vtt + .jpg + "video" block for the manifest ◄┘
5. A person reviews the procedure in the real app ──► status: "verified" ──► final render
```

1. **Screenshots.** Take them from the real app with fictitious data. The demo includes
   `apps/demo-html/scripts/capture.mjs`: it opens the app in Chrome Headless, runs the
   procedure, saves PNGs and writes `captures/regions.json` with the measured position of each
   `[data-training]`. Those coordinates are used as highlights.
2. **Script.** Save it in a folder that is not published, together with its screenshots
   (`training-src/<id>/<id>.script.json`).
3. **Validation.** `pnpm training validate --input training-src/registrar-cliente/registrar-cliente.script.json`
   checks the schema and that all screenshots and audio files exist.
4. **Preview:** `pnpm training preview --input …` opens Remotion Studio.
   **Render:** `pnpm training render --input … --out public/training/videos`. With
   `--size 640` you get a quick draft.
5. Copy the `video` block printed by `render` into the manifest and run `training validate`
   on the app's folder.

## Script

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

| Template | Use | Own fields |
|---|---|---|
| `intro` | Introduction and objective | `objective` |
| `demo` | Demonstration on a screenshot | `screenshot` (required), `highlights` |
| `steps` | Step-by-step explanation, with optional screenshot | `steps` (1–8), `screenshot`, `highlights` |
| `result` | Expected result | `description`, `screenshot` (required), `highlights` |
| `outro` | Common mistakes and conclusion | `mistakes` (0–6), `conclusion` |

- **Resolution and orientation:** `format.size` is the long side (1280 → 1280×720, or 720×1280
  in portrait). Dimensions are rounded to even numbers (an H.264 requirement). For portrait video,
  use screenshots of the mobile view: a desktop screenshot ends up too small.
- **Highlights:** `x`, `y`, `width` and `height` are fractions (0–1) of the screenshot. They appear one
  after another; the active one dims the rest and pulses gently.
- **Optional narration:** `narration.text` generates the captions. `narration.audio` adds
  a recorded voice (WAV or MP3) to the scene. The scene must last at least as long as the audio.
  On Windows, `training narrate` generates it with the local voice (see below).
- **Local voice (Windows):** `training narrate --input <guion.json> [--voice "Microsoft Sabina Desktop"] [--rate -10..10]` generates one WAV per scene with the Windows voices (SAPI, no internet, no cost). It writes `narration.audio` and `narration.durationSec`, and extends the scene's `durationSec` so the voice fits. Captions follow the actual audio duration. On Linux or macOS, record the audio and use `narration.audio`.
- **Highlights by name:** instead of coordinates, use `{ "region": "guardar", "label": "Guardar" }`. The rectangle is read from `regions.json` next to the screenshot (`{ "<captura>": { "<región>": {x,y,width,height} } }`), which the capture script writes. If you capture again, the highlights update without touching the script. Regions are clipped to the visible area.
- **Synchronized captions:** each narration is split into sentences (max. 84 characters) and
  distributed across the scene according to their length. The same calculation produces the `.vtt` and the burned-in
  captions (`burnCaptions: true`), so they always match. By default they are not burned in: the
  player shows the WebVTT track, which the user can turn off and which the transcript
  reuses.
- **Optional music:** `music.src` and `music.volume` (0–1). It loops for the whole video.
- **Subtle animations:** 0.6 s `spring` entrances and a progress bar. With
  `prefers-reduced-motion`, Remotion renders the same; the kit's player respects the
  preference in tours.
- **Honesty:** the renderer does not generate interfaces. `demo` and `result` scenes require a
  real screenshot, and the CLI fails if a file is missing. While `status` is `draft`, the video
  carries the watermark "BORRADOR · procedimiento no verificado" (draft · procedure not verified). Change it to `verified` only when
  a person has run the procedure in the real app.

## Requirements

| Requirement | Detail |
|---|---|
| Node.js ≥ 20 | Tested with Node 24.16 on Windows 11. |
| Chrome Headless Shell | Remotion downloads it the first time (~120 MB) into `node_modules/.remotion`. Run the commands from the repository root to reuse a single copy. |
| FFmpeg | No need to install it: it ships in `@remotion/compositor-<platform>`. |
| Linux without a graphical environment | Install Chrome's libraries (`libnss3`, `libatk-bridge2.0-0`, `libgbm1`, fonts…). See Remotion's Linux guide. |
| Time | 40 s of video at 1280×720 takes ~1.5 min on a desktop machine. |

## Rendering dependency licenses

> Technical summary, not legal advice. Review it with your legal team before using it in production.

| Dependency | License | Impact |
|---|---|---|
| **Remotion** (`remotion`, `@remotion/*` 4.0.535) | Remotion License (source-available) | **Free** for individuals, for-profit companies with **up to 3 employees** and non-profit organizations. **A larger company needs a Company License** (remotion.pro). Check remotion.dev/license to see whether your organization qualifies for the free license. Version 5.0 announces license changes. |
| **FFmpeg 7.1** bundled by Remotion | GPL (built with `--enable-gpl`, libx264 and libx265) and includes libfdk-aac | Using it internally to produce videos does not require publishing code. **Redistributing** that binary does carry GPL obligations, and libfdk-aac has a license that is not GPL-compatible for redistribution. Do not include `node_modules` in installers for third parties. H.264 and AAC are patented formats; commercial distribution of videos is usually covered, but confirm it with your legal team. |
| Chrome Headless Shell | Chromium licenses (BSD and others) and Google's terms | Downloaded from Google on the first run. |
| React, Zod, Driver.js, Vite, Vitest | MIT | No relevant restrictions. |
| TypeScript | Apache-2.0 | No relevant restrictions. |

The kit that reaches the browser (`seventeen-training.js`) **does not include** Remotion or FFmpeg:
only Zod and Driver.js (MIT). The Remotion license only affects whoever generates videos.

**Alternative without Remotion** (if the license is not viable): the templates are React and CSS. The
frames can be captured with Playwright and joined with an LGPL FFmpeg (`libopenh264`).
That path is not implemented in this MVP.
