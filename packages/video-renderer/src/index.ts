import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VideoScriptSchema,
  TrainingContentError,
  formatIssues,
  toVtt,
  type Highlight,
  type Video,
  type VideoScript,
} from '@seventeen-training/core';
import { buildCaptionCues, buildChapters, totalDuration } from './timeline.js';

export * from './timeline.js';

/** Compiled Remotion entry (dist/remotion/index.js). */
export const remotionEntry = fileURLToPath(new URL('./remotion/index.js', import.meta.url));

export interface LoadedScript {
  script: VideoScript;
  /** 1-based scenes whose narration text changed since the voice was generated. */
  staleNarration: number[];
}

/**
 * Parse + validate a script, attach the generated voice (audio/narration.json) and resolve
 * `{ region }` highlights. The author's file is never modified.
 */
export async function loadScript(scriptPath: string): Promise<LoadedScript> {
  const raw = JSON.parse(await readFile(scriptPath, 'utf8'));
  const r = VideoScriptSchema.safeParse(raw);
  if (!r.success) throw new TrainingContentError(`Guion inválido: ${scriptPath}`, formatIssues(r.error));
  const dir = dirname(resolve(scriptPath));
  const staleNarration = await applyNarration(r.data, dir);
  await resolveRegions(r.data, dir);
  return { script: r.data, staleNarration };
}

export async function readScript(scriptPath: string): Promise<VideoScript> {
  return (await loadScript(scriptPath)).script;
}

/** Where `training narrate` keeps the generated voice, relative to the script folder. */
export const NARRATION_CACHE = 'audio/narration.json';

export interface NarrationCache {
  voice: string;
  rate: number;
  /** Keyed by 1-based scene number. */
  scenes: Record<string, { text: string; file: string; durationSec: number }>;
}

/** Scene length that fits a voice of `audioSec`: a short pause, rounded up to 0.5 s. */
export const fitVoice = (audioSec: number) => Math.ceil((audioSec + 0.8) * 2) / 2;

/**
 * Attach cached voice to scenes whose narration text is unchanged and stretch them to fit.
 * Scenes with an explicit `narration.audio` (recorded by hand) are left alone.
 */
export async function applyNarration(script: VideoScript, scriptDir: string): Promise<number[]> {
  const file = join(scriptDir, NARRATION_CACHE);
  const cache: NarrationCache | undefined = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : undefined;
  const stale: number[] = [];
  script.scenes.forEach((scene, i) => {
    const n = scene.narration;
    if (!n || n.audio || !cache) return;
    const entry = cache.scenes[String(i + 1)];
    if (!entry || entry.text !== n.text) {
      stale.push(i + 1);
      return;
    }
    n.audio = entry.file;
    n.durationSec = entry.durationSec;
    scene.durationSec = Math.max(scene.durationSec, fitVoice(entry.durationSec));
  });
  return stale;
}

/** Compiled templates: a change in them must re-render every video. */
const TEMPLATE_FILES = ['./remotion/Tutorial', './remotion/Root', './timeline'].map((base) => {
  // dist/ has .js; running from src/ (tests) has .tsx/.ts.
  const found = ['.js', '.tsx', '.ts'].map((ext) => fileURLToPath(new URL(base + ext, import.meta.url))).find((f) => existsSync(f));
  if (!found) throw new Error(`No encuentro la plantilla ${base}`);
  return found;
});

/**
 * Fingerprint of everything that affects the rendered video: the resolved script (without its
 * capture steps), every referenced file (screenshots, audio, music) and the templates.
 */
export async function scriptInputHash(script: VideoScript, scriptDir: string): Promise<string> {
  const h = createHash('sha256');
  const { capture: _capture, $schema: _schema, ...rest } = script;
  h.update(JSON.stringify(rest));
  for (const asset of scriptAssets(script).sort()) h.update(asset).update(await readFile(join(scriptDir, asset)));
  for (const f of TEMPLATE_FILES) h.update(await readFile(f));
  return h.digest('hex').slice(0, 16);
}

const clamp01 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;

/** Replace `{ region: "name" }` highlights with the rectangle measured in `<screenshot dir>/regions.json`. */
export async function resolveRegions(script: VideoScript, scriptDir: string): Promise<void> {
  const cache = new Map<string, Record<string, Record<string, Highlight | null>>>();
  const errors: string[] = [];
  for (const scene of script.scenes) {
    if (!('screenshot' in scene) || !scene.screenshot || !scene.highlights.some((h) => 'region' in h)) continue;
    const file = join(scriptDir, dirname(scene.screenshot), 'regions.json');
    if (!cache.has(file)) cache.set(file, existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {});
    const shot = basename(scene.screenshot).replace(/\.[^.]+$/, '');
    const regions = cache.get(file)![shot] ?? {};
    scene.highlights = scene.highlights.map((h) => {
      if (!('region' in h)) return h;
      const rect = regions[h.region];
      if (!rect) {
        errors.push(`${scene.screenshot}: no hay región "${h.region}" en ${file}`);
        return h;
      }
      // Clip to the screenshot: an element taller than the viewport is only highlighted where visible.
      const x = clamp01(rect.x);
      const y = clamp01(rect.y);
      const r3 = (n: number) => Math.round(n * 1000) / 1000;
      return { x, y, width: r3(clamp01(rect.x + rect.width) - x), height: r3(clamp01(rect.y + rect.height) - y), label: h.label };
    });
  }
  if (errors.length) throw new TrainingContentError('Regiones de resaltado no encontradas (vuelve a capturar)', errors);
}

/** Local files the script needs (screenshots, narration, music), relative to the script folder. */
export function scriptAssets(script: VideoScript): string[] {
  const out = new Set<string>();
  for (const s of script.scenes) {
    if ('screenshot' in s && s.screenshot) out.add(s.screenshot);
    if (s.narration?.audio) out.add(s.narration.audio);
  }
  if (script.music) out.add(script.music.src);
  return [...out].filter((p) => !p.startsWith('https://'));
}

export function missingAssets(script: VideoScript, scriptDir: string): string[] {
  return scriptAssets(script).filter((p) => !existsSync(join(scriptDir, p.replace(/^\//, ''))));
}

export interface RenderOptions {
  scriptPath: string;
  /** Output folder. Files: <id>.mp4, <id>.<lang>.vtt, <id>.jpg */
  outDir: string;
  /** Override long side in px (e.g. 640 for a fast test render). */
  size?: number;
  onProgress?: (stage: string, progress: number) => void;
}

export interface RenderResult {
  video: string;
  captions: string;
  poster: string;
  durationSec: number;
  /** Suggested manifest `video` block (paths relative to outDir). */
  manifestVideo: Video;
}

/**
 * Bundle the Remotion project with the script folder as public dir, then render MP4,
 * poster and WebVTT. Runs fully offline after the first Chrome Headless Shell download.
 */
export async function renderTutorial(opts: RenderOptions): Promise<RenderResult> {
  const scriptPath = resolve(opts.scriptPath);
  const scriptDir = dirname(scriptPath);
  const script = await readScript(scriptPath);
  if (opts.size) script.format.size = opts.size;

  const missing = missingAssets(script, scriptDir);
  if (missing.length) throw new TrainingContentError('Faltan recursos del guion (usa capturas reales)', missing);

  const progress = opts.onProgress ?? (() => {});
  // Heavy deps loaded lazily so `validate`/`list` never pay for them.
  const { bundle } = await import('@remotion/bundler');
  const { renderMedia, renderStill, selectComposition } = await import('@remotion/renderer');

  progress('browser', 0);
  const browserExecutable_ = await browserExecutable();
  const serveUrl = await bundle({
    entryPoint: remotionEntry,
    publicDir: scriptDir,
    onProgress: (p) => progress('bundle', p / 100),
  });
  const inputProps = script as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: 'Tutorial', inputProps, browserExecutable: browserExecutable_ });

  await mkdir(opts.outDir, { recursive: true });
  const base = join(opts.outDir, script.id);
  const video = `${base}.mp4`;
  const poster = `${base}.jpg`;
  const captions = `${base}.${script.lang}.vtt`;

  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: 'h264',
    outputLocation: video,
    browserExecutable: browserExecutable_,
    onProgress: ({ progress: p }) => progress('render', p),
  });
  // Poster from the intro, after the title has fully animated in.
  await renderStill({ serveUrl, composition, inputProps, browserExecutable: browserExecutable_, output: poster, frame: Math.min(composition.durationInFrames - 1, Math.round(composition.fps * Math.min(3, script.scenes[0]!.durationSec - 0.5))), imageFormat: 'jpeg' });
  await writeFile(captions, toVtt(buildCaptionCues(script)), 'utf8');
  progress('done', 1);

  const durationSec = totalDuration(script);
  const name = (p: string) => p.slice(opts.outDir.length).replace(/^[\\/]/, '');
  return {
    video,
    captions,
    poster,
    durationSec,
    manifestVideo: {
      src: name(video),
      type: 'video/mp4',
      poster: name(poster),
      durationSec,
      captions: [{ src: name(captions), srclang: script.lang, label: script.lang === 'es' ? 'Español' : script.lang, kind: 'captions', default: true }],
      chapters: buildChapters(script),
    },
  };
}


const KIT_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
let chrome: string | undefined;

/**
 * Chrome Headless Shell used for captures and renders. Remotion downloads it next to the
 * current folder's node_modules, so it is resolved from the kit's root: one copy for every app
 * (instead of 120 MB inside each project). CHROME_PATH overrides it.
 */
export async function browserExecutable(): Promise<string> {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (chrome) return chrome;
  const { ensureBrowser } = await import('@remotion/renderer');
  const cwd = process.cwd();
  process.chdir(KIT_ROOT);
  try {
    const status = await ensureBrowser();
    if (!('path' in status)) throw new TrainingContentError('No hay navegador disponible');
    chrome = status.path;
    return chrome;
  } finally {
    process.chdir(cwd);
  }
}
