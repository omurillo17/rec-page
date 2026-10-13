# rec-page · Seventeen Training Kit

**English** · [Español](README.es.md)

Record videos of your web app from a JSON script. The kit opens the real app in headless Chrome,
follows the steps (clicks, forms, navigation), takes screenshots, measures the elements to highlight,
adds voice-over, captions and chapters, and renders an MP4. When the UI changes, `training build`
re-records only what changed.

Use it for:

- **Training:** a **Help** button in every module with video tutorials and interactive tours (Driver.js).
- **Sales demos and presentations** of your product that stay in sync with the UI.
- **Release-notes videos** (what changed in this version) and **onboarding** for new users.
- **Documentation screenshots**, with the coordinates of every element measured.

With [Claude Code](#claude-code-plugin-any-project), an agent sets up a demo database with fictitious data,
explores the app, writes the scripts and generates the videos.

- **Not an LMS.** Each app keeps its own authentication, permissions and content
  (manifest, tours, videos), versioned alongside its code.
- **A Web Component** (`<seventeen-training>`) works in plain HTML, Django, React/Next.js and any
  other framework. The React adapter only wraps it.
- **Videos built from a JSON script and real screenshots** with Remotion + FFmpeg, with no API keys
  or paid services. Output: MP4, synchronized WebVTT captions, thumbnail and chapters.
- **`training` CLI** to validate content (schemas, references, MP4, WebVTT, secrets)
  and to generate or preview videos.

```html
<script type="module" src="/static/training-kit/seventeen-training.js"></script>
<seventeen-training manifest="/training/manifest.json" module="clientes"></seventeen-training>
```

> The detailed docs in [`docs/`](docs) and the demo content are in Spanish. Schemas, code and the CLI are
> language-neutral; set `lang` and `locale` in your scripts and config.

## Status

**Beta (0.x).** Tested (unit tests, a real 12-lesson production app), but formats and commands may still
change before 1.0. Read [SECURITY.md](SECURITY.md) before running `training build` on a project you did not write:
its config runs shell commands.

## Quick start

Requirements: Node.js ≥ 20 and pnpm 10. Python ≥ 3.10 only for the Django example.
Automatic voice-over uses the Windows voices (SAPI); on macOS or Linux, record the audio and set `narration.audio`.

```bash
pnpm install
```

```bash
pnpm test
```

`pnpm test` builds every package and runs the automated tests.

```bash
pnpm dev:html
```

Open http://localhost:5173. Click **Ayuda del módulo** (module help), play a video or start a tour.
The React demo starts with `pnpm dev:react` (http://localhost:5174).

## Layout

| Path | Responsibility |
|---|---|
| [packages/content-schema](packages/content-schema) | Zod schemas and types: manifest, tours, video script and project config. Emits JSON Schema for editors. |
| [packages/core](packages/core) | DOM-free logic: manifest loading and validation, filtering by module/status/role, version compatibility, recommendations, WebVTT parser. |
| [packages/web-component](packages/web-component) | `<seventeen-training>`: button, dialog, HTML5 player (chapters, speed, transcript, captions) and Driver.js tours. One ES file. |
| [packages/react](packages/react) | `<TrainingHelp>` for React and Next.js (SSR-safe). |
| [packages/video-renderer](packages/video-renderer) | Remotion templates (intro, demo, steps, result, mistakes, outro) and the Node render API. |
| [tools/training-cli](tools/training-cli) | `training validate \| list \| render \| preview \| narrate \| build`. |
| [apps/demo-html](apps/demo-html) | Plain HTML/JS demo: a Clients module, training content and video scripts. |
| [apps/demo-react](apps/demo-react) | React demo with its own content. |
| [examples/django-integration](examples/django-integration) | Django project: manifest filtered by groups and protected files (Range and X-Accel-Redirect). |
| [skills/videos-capacitacion](skills/videos-capacitacion) | Claude Code skill that applies the kit to any app. |
| [docs](docs) | Architecture, content format, integration, security, videos and upgrades (Spanish). |

## Claude Code plugin (any project)

`skills/videos-capacitacion/` holds the skill that applies this kit to **any app**: it sets up a demo database
with fictitious data, explores the screens, writes the lessons (capture steps + scenes) and runs
`training build`.

**As a plugin (any machine).** This repo is also a Claude Code marketplace. In Claude Code:

```
/plugin install rec-page --marketplace omurillo17/rec-page
```

On first use, the skill builds the kit (`pnpm install --frozen-lockfile && pnpm build`) inside the plugin folder.

**From this checkout.** Copy the skill to your user skills folder (run it again after updating):

```bash
pnpm skills:install
```

Then, in any project, ask Claude Code: *"generate the training videos for this app"*.
With other agents, tell them to follow `skills/videos-capacitacion/SKILL.md`.

## Commands

| Command | What it does |
|---|---|
| `pnpm build` | Builds packages and the CLI. |
| `pnpm test` | Builds and runs the tests (Vitest). |
| `pnpm typecheck` | Type-checks every package. |
| `pnpm training validate --input apps/demo-html/public/training` | Validates an app's content. |
| `pnpm training list --input apps/demo-html/public/training` | Lists modules, tutorials and tours. |
| `pnpm training render --input <script.json> --out <folder>` | Renders MP4, VTT and JPG. |
| `pnpm training preview --input <script.json>` | Opens Remotion Studio with the script. |
| `pnpm training narrate --input <script.json>` | Local Windows voice-over (only scenes whose text changed). |
| `pnpm training build --input <folder>` | **Full incremental pipeline**: demo server, screenshots, voice-over, render and the app's data file. See [docs/videos.md](docs/videos.md). |
| `pnpm --filter demo-html capture` | Takes real screenshots of the running demo, with measured coordinates. |

## License

[MIT](LICENSE) © Seventeen Corp.

Some dependencies have their own licenses. They only affect whoever **generates** videos; the component
shipped to the browser includes only Zod and Driver.js, both MIT:

- **Remotion** is *source-available*: free for individuals, non-profits and companies of up to
  3 employees. Larger companies need a Company License ([remotion.dev/license](https://www.remotion.dev/license)).
- **FFmpeg**, bundled by Remotion, is GPL. Using it to produce videos creates no obligations; do not
  redistribute `node_modules` inside installers.

Details in [docs/videos.md](docs/videos.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and pull requests are welcome in English or Spanish.
