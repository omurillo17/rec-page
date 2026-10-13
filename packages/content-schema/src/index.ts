import { z } from 'zod';

/**
 * Content contracts for Seventeen Training Kit.
 *
 * Every application owns its own content (manifest + tours + media). These schemas
 * only describe that content; they are NOT an authorization mechanism. The host
 * application decides what a user may see and serves only that.
 */

export const SCHEMA_VERSION = 1 as const;

export const IdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'Usa minúsculas, números y guiones (máx. 64)');

export const SemverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'Usa versión semántica MAJOR.MINOR.PATCH');

/**
 * Asset path: relative ("videos/a.mp4"), root-absolute ("/media/a.mp4") or https URL.
 * Any other scheme (javascript:, data:, http:, file:) is rejected.
 */
export const AssetPathSchema = z
  .string()
  .min(1)
  .refine((p) => !/^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('https://'), {
    message: 'Solo rutas relativas, absolutas (/...) o URLs https://',
  })
  .refine((p) => !/(^|\/)\.\.(\/|$)/.test(p), { message: 'No se permite ".." en rutas de recursos' });

export const StatusSchema = z.enum(['draft', 'review', 'published', 'archived']);

/** Informational only. The host app must enforce permissions on its own server. */
export const RolesSchema = z.array(z.string().min(1)).min(1).optional();

export const ModuleSchema = z.strictObject({
  id: IdSchema,
  title: z.string().min(1),
  description: z.string().optional(),
});

export const CaptionTrackSchema = z.strictObject({
  src: AssetPathSchema,
  srclang: z.string().min(2).max(10),
  label: z.string().min(1),
  kind: z.enum(['captions', 'subtitles']).default('captions'),
  default: z.boolean().optional(),
});

export const ChapterSchema = z.strictObject({
  startSec: z.number().min(0),
  title: z.string().min(1),
});

export const VideoSchema = z.strictObject({
  src: AssetPathSchema,
  type: z.literal('video/mp4').default('video/mp4'),
  poster: AssetPathSchema.optional(),
  durationSec: z.number().positive(),
  captions: z.array(CaptionTrackSchema).default([]),
  chapters: z.array(ChapterSchema).default([]),
});

export const TutorialSchema = z.strictObject({
  id: IdSchema,
  module: IdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  status: StatusSchema,
  roles: RolesSchema,
  /** "protected": media must be served from an authenticated route of the host app. */
  access: z.enum(['public', 'protected']).default('public'),
  video: VideoSchema,
  /** Optional interactive tour that complements this video. */
  tourId: IdSchema.optional(),
  /** Accessibility notes shown next to the player (e.g. "Sin audio relevante: los subtítulos cubren todo"). */
  accessibilityNotes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const TourRefSchema = z.strictObject({
  id: IdSchema,
  module: IdSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  status: StatusSchema,
  roles: RolesSchema,
  /** Path to the tour JSON file, relative to the manifest. */
  src: AssetPathSchema,
});

export const ManifestSchema = z.strictObject({
  $schema: z.string().optional(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  appId: IdSchema,
  contentVersion: SemverSchema,
  status: StatusSchema,
  /** UI versions this content was written for: minVersion <= appVersion < maxVersion. */
  ui: z
    .strictObject({ minVersion: SemverSchema, maxVersion: SemverSchema.optional() })
    .optional(),
  /** Base for relative asset paths. Defaults to the manifest's own directory. */
  assetsBase: AssetPathSchema.optional(),
  modules: z.array(ModuleSchema).min(1),
  tutorials: z.array(TutorialSchema).default([]),
  tours: z.array(TourRefSchema).default([]),
});

/**
 * Tour step, mapped 1:1 onto Driver.js `DriveStep` ({ element, popover: { title, description, side, align } }).
 * Steps have no "action" fields on purpose: tours explain, they never click, submit or delete.
 */
export const TourStepSchema = z.strictObject({
  /** CSS selector. Prefer [data-training='...'] attributes, they survive redesigns. Omit for a centered message. */
  element: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  side: z.enum(['top', 'right', 'bottom', 'left', 'over']).optional(),
  align: z.enum(['start', 'center', 'end']).optional(),
  /** Skip the step (instead of stopping the tour) when the element is missing. */
  optional: z.boolean().default(false),
  /** How long to wait for the element to appear (dynamic pages). */
  waitForMs: z.number().int().min(0).max(30_000).default(3000),
});

export const TourSchema = z.strictObject({
  $schema: z.string().optional(),
  id: IdSchema,
  module: IdSchema,
  title: z.string().min(1),
  steps: z.array(TourStepSchema).min(1),
});

// ---------------------------------------------------------------------------
// Video script (input for the renderer)
// ---------------------------------------------------------------------------

const unit = z.number().min(0).max(1);

/** Highlight rectangle in fractions (0..1) of the screenshot size. */
export const HighlightSchema = z.strictObject({
  x: unit,
  y: unit,
  width: unit,
  height: unit,
  label: z.string().optional(),
});

/**
 * Highlight by name: the rectangle is read from `regions.json` next to the screenshot
 * (`{ "<screenshot name>": { "<region>": {x,y,width,height} } }`), as written by a capture script.
 * Re-capturing the app updates the highlights without editing the script.
 */
export const HighlightRefSchema = z.strictObject({
  region: z.string().min(1),
  label: z.string().optional(),
});

const highlights = z.array(z.union([HighlightSchema, HighlightRefSchema])).default([]);

export const NarrationSchema = z.strictObject({
  /** Subtitle text. Split into sentences and spread over the scene duration. */
  text: z.string().min(1),
  /** Optional voice-over (wav/mp3) relative to the script file. `training narrate` generates it. */
  audio: AssetPathSchema.optional(),
  /** Length of `audio` in seconds. Subtitles are spread over it instead of the whole scene. */
  durationSec: z.number().positive().optional(),
});

const sceneBase = {
  durationSec: z.number().min(1).max(120),
  title: z.string().min(1),
  /** Chapter name in the player; defaults to `title`. */
  chapter: z.string().min(1).optional(),
  narration: NarrationSchema.optional(),
};

export const SceneSchema = z.discriminatedUnion('template', [
  z.strictObject({ template: z.literal('intro'), ...sceneBase, objective: z.string().min(1) }),
  z.strictObject({
    template: z.literal('demo'),
    ...sceneBase,
    screenshot: AssetPathSchema,
    highlights,
  }),
  z.strictObject({
    template: z.literal('steps'),
    ...sceneBase,
    steps: z.array(z.string().min(1)).min(1).max(8),
    screenshot: AssetPathSchema.optional(),
    highlights,
  }),
  z.strictObject({
    template: z.literal('result'),
    ...sceneBase,
    description: z.string().min(1),
    screenshot: AssetPathSchema,
    highlights,
  }),
  z.strictObject({
    template: z.literal('outro'),
    ...sceneBase,
    mistakes: z.array(z.string().min(1)).max(6).default([]),
    conclusion: z.string().min(1),
  }),
]);

// ---------------------------------------------------------------------------
// Capture steps: how to reproduce the procedure in the real app to take screenshots.
// Selectors: CSS ("#id"), visible text ("text=Guardar") or a JS expression that returns
// an element ("js=document.querySelector('x').closest('aside')").
// ---------------------------------------------------------------------------

const Selector = z.string().min(1);
const ms = z.number().int().min(0).max(120_000);

export const CaptureStepSchema = z.union([
  /** Navigate to a path (relative to baseUrl) or absolute URL, then wait `wait` ms. */
  z.strictObject({ goto: z.string().min(1), wait: ms.optional() }),
  /** Type into an input/textarea like a user (works with React controlled inputs). */
  z.strictObject({ fill: Selector, value: z.string() }),
  /** `real: true` sends real mouse events (for widgets that ignore synthetic clicks). */
  z.strictObject({ click: Selector, real: z.boolean().optional() }),
  z.strictObject({ waitFor: Selector, timeout: ms.optional() }),
  z.strictObject({ sleep: ms }),
  /** JavaScript run in the page (e.g. close toasts). */
  z.strictObject({ eval: z.string().min(1) }),
  /** Shell command run on this machine, in the project folder (e.g. change demo data). */
  z.strictObject({ run: z.string().min(1) }),
  /** Insert the steps of a macro defined in training.config.json (e.g. "login"). */
  z.strictObject({ use: z.string().min(1) }),
  /** Screenshot → captures/<shot>.png, plus the measured rectangle of each region. */
  z.strictObject({ shot: z.string().regex(/^[a-z0-9][a-z0-9-]*$/), regions: z.record(z.string(), Selector).default({}) }),
]);

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const VideoScriptSchema = z.strictObject({
  $schema: z.string().optional(),
  id: IdSchema,
  title: z.string().min(1),
  lang: z.string().default('es'),
  /**
   * "draft" renders a visible BORRADOR watermark. Switch to "verified" only after a person
   * has checked the procedure against the real application.
   */
  status: z.enum(['draft', 'verified']).default('draft'),
  format: z
    .strictObject({
      orientation: z.enum(['landscape', 'portrait']).default('landscape'),
      /** Long side in px. 1920 → 1920x1080 / 1080x1920. */
      size: z.number().int().min(320).max(3840).default(1280),
      fps: z.number().int().min(10).max(60).default(30),
    })
    .default({ orientation: 'landscape', size: 1280, fps: 30 }),
  theme: z
    .strictObject({ primary: hexColor.default('#2563eb'), background: hexColor.default('#0f172a') })
    .default({ primary: '#2563eb', background: '#0f172a' }),
  music: z.strictObject({ src: AssetPathSchema, volume: z.number().min(0).max(1).default(0.15) }).optional(),
  /**
   * Burn subtitles into the pixels. Off by default: the player shows the generated WebVTT track,
   * which users can toggle and screen readers can use. Turn on for videos shared outside the player.
   */
  burnCaptions: z.boolean().default(false),
  /** Steps that reproduce the procedure in the app and take the screenshots (`training build`). */
  capture: z.array(CaptureStepSchema).optional(),
  scenes: z.array(SceneSchema).min(1),
});

/**
 * training.config.json: one per application. Describes how to run the app with demo data,
 * shared capture macros, narration and where the generated videos go.
 * Relative paths and shell commands are relative to the config file's folder.
 */
export const ProjectConfigSchema = z.strictObject({
  $schema: z.string().optional(),
  /** Where the app runs with DEMO data, e.g. http://127.0.0.1:3101 */
  baseUrl: z.string().regex(/^https?:\/\//),
  viewport: z
    .strictObject({
      width: z.number().int().min(320).default(1366),
      height: z.number().int().min(320).default(768),
      /** Device pixel ratio of the screenshots (1.5 → crisp text in 1080p videos). */
      scale: z.number().min(1).max(3).default(1.5),
    })
    .default({ width: 1366, height: 768, scale: 1.5 }),
  /** CSS selectors hidden in every capture (dev overlays, chat widgets…). */
  hide: z.array(z.string()).default([]),
  /** Browser locale for captures: date inputs, number formats, Accept-Language. */
  locale: z.string().default('es-MX'),
  /** Run once before anything else (e.g. start the demo database). */
  setup: z.string().optional(),
  /** Started by `training build` when `readyUrl` does not answer, stopped at the end. */
  server: z.strictObject({ command: z.string(), readyUrl: z.string(), timeoutSec: z.number().int().default(120) }).optional(),
  /** Run before each lesson's capture (e.g. reset the demo database so every take starts equal). */
  beforeLesson: z.string().optional(),
  macros: z.record(z.string(), z.array(CaptureStepSchema)).default({}),
  narration: z
    .strictObject({ voice: z.string().optional(), rate: z.number().int().min(-10).max(10).default(0) })
    .default({ rate: 0 }),
  /** Output folder for <id>.mp4 / .vtt / .jpg. */
  outDir: z.string(),
  /** URL path under which the app serves outDir, e.g. "/capacitacion/videos/". */
  publicPath: z.string(),
  /** JSON written by `training build` with every video's URLs, duration and chapters, for the app to import. */
  dataFile: z.string(),
  /** Fraction of changed pixels below which a new screenshot counts as unchanged (clocks, relative times). */
  changeThreshold: z.number().min(0).max(1).default(0.004),
});

export type Status = z.infer<typeof StatusSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type CaptionTrack = z.infer<typeof CaptionTrackSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Video = z.infer<typeof VideoSchema>;
export type Tutorial = z.infer<typeof TutorialSchema>;
export type TourRef = z.infer<typeof TourRefSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestInput = z.input<typeof ManifestSchema>;
export type TourStep = z.infer<typeof TourStepSchema>;
export type Tour = z.infer<typeof TourSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type HighlightRef = z.infer<typeof HighlightRefSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type VideoScript = z.infer<typeof VideoScriptSchema>;
export type VideoScriptInput = z.input<typeof VideoScriptSchema>;
export type CaptureStep = z.infer<typeof CaptureStepSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/** Human-readable list of issues: "tutorials.0.video.src: mensaje". */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`);
}
