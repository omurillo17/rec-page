# Architecture

**English** · [Español](../arquitectura.md)

## Principles applied

| Principle | How it is met |
|---|---|
| Each app keeps its own authentication and authorization | The kit has no login, users or roles of its own. It loads the manifest with `credentials: 'same-origin'`: the app's session cookie travels on its own and the kit never sees tokens. |
| Content and media per app | Each app has its own folder (for example, `public/training/` or `training_content/`) with `manifest.json`, `tours/` and `videos/`. It is versioned in the app's repository. |
| No dependencies between apps or databases | The kit has no backend or database. It only reads JSON and media files from URLs that each app chooses. |
| The engine does not access business data | The kit only reads the manifest, tours and media. Tours highlight elements by selector; they do not read values or submit forms. |
| Optional, non-blocking integration | It is a deferred `<script type="module">`. The manifest is downloaded when help is opened. An error shows a notice inside the dialog and emits `training-error`; it never throws exceptions into the app. |
| No new infrastructure | The MVP adds no services, queues or storage. Remotion is only used on the machine that generates videos. |

## Packages and dependencies

```
content-schema  (zod)
      ▲
     core  ──────────────────────────────┐
      ▲                                  │
 web-component (driver.js) ◄── react     video-renderer (remotion) ◄── training-cli
```

- `core` does not depend on the DOM, React, Next.js or Django. It runs in the browser and in Node
  (for example, to filter the manifest in a Next.js route).
- `web-component` is published as **a single ES file** (`dist/seventeen-training.js`,
  ~143 KB, 41 KB gzip). It includes core, zod and driver.js. It is used with a `<script>` tag.
- `react` loads the Web Component with `import()` inside `useEffect`. On the server it
  only produces the HTML tag.
- `video-renderer` and `training-cli` only run in Node, on the content producer's machine
  or in CI. They never reach the browser.

## Contracts

### 1. Manifest (`manifest.json`)

Describes an app's content: modules, tutorials, tour references, statuses,
informational roles and UI version range. It is validated by `ManifestSchema`. The format is
described in [content.md](content.md).

### 2. Web Component

| Attribute | Use |
|---|---|
| `manifest` | Manifest URL (required). It can be a route protected by the app. |
| `module` | Id of the module to display. |
| `app-version` | Host UI version. Outside `manifest.ui`, tours are disabled and videos remain available. |
| `roles` | Comma-separated roles. They only filter the interface and are **not** a security control. |
| `include-drafts` | Shows `draft` or `review` content. Use it only in authoring environments. |
| `label` | Button text. |

Methods: `open()`, `close()`, `openTutorial(id)`, `startTour(id)` and `reload()`.

Events (`bubbles` and `composed`): `training-open`, `training-close`, `training-video-play`,
`training-tour-start`, `training-tour-end` (`{ tourId, completed, invalidSteps }`) and
`training-error` (`{ message }`). They include no user data.

Theme: CSS variables on the host, for example,
`seventeen-training { --st-primary: #0f766e; }`, plus `::part(button)` and `::part(dialog)`.

### 3. Tours

Each JSON file is validated with `TourSchema` before running. Each step maps
1:1 to a Driver.js 1.9 `DriveStep`:

| Schema | Driver.js |
|---|---|
| `element` | `element`: CSS selector; if missing, the popover is centered. |
| `title`, `description`, `side`, `align` | `popover.*` |
| `optional: true` | `skipMissingElement: true`: the step is skipped if the element does not exist. |
| `waitForMs` | `waitForElement`: waits using MutationObserver (dynamic pages). |

Before starting, the kit discards selectors with invalid syntax and reports them in
`invalidSteps`. If a required element does not appear after the wait, the popover is centered
with a notice. The schema has no action fields: a tour **cannot** click,
type or submit forms.

### 4. Video script

Validated by `VideoScriptSchema`. It contains scenes with a template (`intro`, `demo`, `steps`,
`result` and `outro`), duration, optional narration and real screenshots. The renderer receives the
script and the script's folder as `publicDir`. See [videos.md](videos.md).

## Runtime flow

1. The page loads `seventeen-training.js` deferred. The element shows only the button.
2. When the button is pressed, the kit downloads the manifest with the app's cookie and validates it with Zod.
3. `selectContent` filters by module, status, roles (UX only) and UI version.
4. The player uses native `<video>` and a WebVTT `<track>`. The transcript is generated from the
   same VTT file, so subtitles and transcript always match.
5. The tour downloads its JSON, validates it, closes the dialog and runs Driver.js.

## Decisions

- **Native player, not Video.js.** The browser already provides MP4, `<track>`, playback speed,
  fullscreen and keyboard support. What is missing (chapters, transcript, a visible speed selector
  and recommendations) is ~100 lines. Video.js would add a package larger than the whole
  kit without covering anything else in the MVP. Reevaluate it if HLS or DASH, playback analytics or ads are needed.
- **Shadow DOM** so the kit's and the app's styles do not mix. Driver.js popovers
  live in the document, because they highlight app elements.
- **No persistent state.** The kit stores no progress or personal data. If an app
  needs progress, it can listen to `training-tour-end` and save it in its own backend.
