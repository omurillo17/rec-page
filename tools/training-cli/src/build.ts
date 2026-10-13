import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { ProjectConfigSchema, TrainingContentError, VideoScriptSchema, formatIssues, type ProjectConfig } from '@seventeen-training/core';
import {
  browserExecutable,
  buildChapters,
  loadScript,
  missingAssets,
  renderTutorial,
  scriptInputHash,
  totalDuration,
} from '@seventeen-training/video-renderer';
import { captureLesson } from './capture.js';
import { narrate } from './narrate.js';

export const CONFIG_FILE = 'training.config.json';

/** One entry of the generated data file: everything the app needs to show a video. */
export interface VideoEntry {
  title: string;
  status: 'draft' | 'verified';
  src: string;
  poster: string;
  captions: { src: string; srclang: string; label: string }[];
  durationSec: number;
  chapters: { startSec: number; title: string }[];
  /** Fingerprint of the inputs; unchanged hash = the video is up to date. */
  hash: string;
}

export interface DataFile {
  $comment: string;
  videos: Record<string, VideoEntry>;
}

export interface BuildOptions {
  /** Folder with training.config.json (or the file itself). */
  input: string;
  /** Script ids to build; all when empty. */
  only?: string[];
  /** Re-render even when nothing changed. */
  force?: boolean;
  /** Skip screenshots and use the existing ones. */
  capture?: boolean;
  log?: (msg: string) => void;
}

export interface LessonResult {
  id: string;
  result: 'rendered' | 'up-to-date' | 'failed';
  detail?: string;
}

export async function loadConfig(input: string): Promise<{ config: ProjectConfig; projectDir: string }> {
  const file = existsSync(input) && statSync(input).isDirectory() ? join(input, CONFIG_FILE) : input;
  if (!existsSync(file)) throw new TrainingContentError(`No existe ${file}`);
  const r = ProjectConfigSchema.safeParse(JSON.parse(await readFile(file, 'utf8')));
  if (!r.success) throw new TrainingContentError(`Configuración inválida: ${file}`, formatIssues(r.error));
  return { config: r.data, projectDir: dirname(resolve(file)) };
}

/** Every `*.script.json` one level below the project folder. */
export function findScripts(projectDir: string): string[] {
  return readdirSync(projectDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(join(projectDir, d.name)).filter((f) => f.endsWith('.script.json')).map((f) => join(projectDir, d.name, f)))
    .sort();
}

/** Any HTTP answer means a server owns the port (a 500 is reported by the capture, not fixed by starting another). */
async function answers(url: string): Promise<boolean> {
  try {
    await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

function stop(proc: ChildProcess): void {
  if (!proc.pid) return;
  // The server runs through a shell; kill the whole tree.
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-proc.pid);
  } catch {
    // already exited
  }
}

/**
 * One command for the whole pipeline: start the demo app, capture every lesson, generate the
 * voice, render only what changed and write the data file the app imports.
 */
export async function build(opts: BuildOptions): Promise<LessonResult[]> {
  const log = opts.log ?? console.log;
  const { config, projectDir } = await loadConfig(opts.input);
  const sh = (cmd: string) => execSync(cmd, { cwd: projectDir, stdio: 'pipe' });
  const outDir = resolve(projectDir, config.outDir);
  const dataPath = resolve(projectDir, config.dataFile);
  const data: DataFile = existsSync(dataPath)
    ? JSON.parse(await readFile(dataPath, 'utf8'))
    : { $comment: 'Generado por `training build`. No editar a mano.', videos: {} };
  const publicUrl = (file: string) => `${config.publicPath.replace(/\/?$/, '/')}${file}`;

  const scripts = findScripts(projectDir);
  const lessons = [];
  for (const path of scripts) {
    const raw = JSON.parse(await readFile(path, 'utf8'));
    if (!opts.only?.length || opts.only.includes(raw.id)) lessons.push({ path, id: String(raw.id), capture: Array.isArray(raw.capture) });
  }
  if (!lessons.length) throw new TrainingContentError(`No hay guiones (*.script.json) que construir en ${projectDir}`);

  const capturing = opts.capture !== false && lessons.some((l) => l.capture);
  let server: ChildProcess | undefined;
  const results: LessonResult[] = [];
  try {
    let executable = '';
    if (capturing) {
      executable = await browserExecutable();
      if (config.setup) {
        log('▶ setup');
        sh(config.setup);
      }
      if (config.server && !(await answers(config.server.readyUrl))) {
        log(`▶ iniciando servidor: ${config.server.command}`);
        server = spawn(config.server.command, { cwd: projectDir, shell: true, stdio: 'ignore', detached: process.platform !== 'win32' });
        let exited: number | null = null;
        server.on('exit', (code) => (exited = code ?? 0));
        const t0 = Date.now();
        while (!(await answers(config.server.readyUrl))) {
          if (exited !== null) throw new TrainingContentError(`El servidor terminó (código ${exited}): ${config.server.command}`);
          if (Date.now() - t0 > config.server.timeoutSec * 1000) throw new TrainingContentError(`El servidor no respondió en ${config.server.readyUrl}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    for (const lesson of lessons) {
      log(`\n■ ${lesson.id}`);
      try {
        const dir = dirname(lesson.path);
        if (capturing && lesson.capture) {
          if (config.beforeLesson) sh(config.beforeLesson);
          const parsed = VideoScriptSchema.safeParse(JSON.parse(await readFile(lesson.path, 'utf8')));
          if (!parsed.success) throw new TrainingContentError('Guion inválido', formatIssues(parsed.error));
          await captureLesson({ steps: parsed.data.capture ?? [], dir, projectDir, config, executable, log });
        }
        const n = await narrate({ scriptPath: lesson.path, voice: config.narration.voice, rate: config.narration.rate });
        if (n.generated) log(`  🔊 voz: ${n.generated} escena(s) nuevas, ${n.reused} reutilizadas`);

        const { script, staleNarration } = await loadScript(lesson.path);
        if (staleNarration.length) throw new TrainingContentError(`Narración desactualizada en escenas ${staleNarration.join(', ')}`);
        const missing = missingAssets(script, dir);
        if (missing.length) throw new TrainingContentError('Faltan recursos', missing);

        const hash = await scriptInputHash(script, dir);
        const files = [`${script.id}.mp4`, `${script.id}.jpg`, `${script.id}.${script.lang}.vtt`];
        const upToDate = data.videos[script.id]?.hash === hash && files.every((f) => existsSync(join(outDir, f)));
        if (upToDate && !opts.force) {
          log('  ✔ sin cambios: no se vuelve a renderizar');
          results.push({ id: script.id, result: 'up-to-date' });
          continue;
        }
        log('  🎬 renderizando…');
        await mkdir(outDir, { recursive: true });
        // Chrome sometimes takes >30 s to start right after the capture browser closes: retry once.
        await renderTutorial({ scriptPath: lesson.path, outDir }).catch(async (e: Error) => {
          if (!/setting up the headless browser/i.test(e.message)) throw e;
          log('  ↻ Chrome tardó en iniciar; reintentando…');
          await new Promise((r) => setTimeout(r, 3000));
          return renderTutorial({ scriptPath: lesson.path, outDir });
        });
        data.videos[script.id] = {
          title: script.title,
          status: script.status,
          src: publicUrl(files[0]!),
          poster: publicUrl(files[1]!),
          captions: [{ src: publicUrl(files[2]!), srclang: script.lang, label: script.lang === 'es' ? 'Español' : script.lang }],
          durationSec: Math.round(totalDuration(script)),
          chapters: buildChapters(script),
          hash,
        };
        await mkdir(dirname(dataPath), { recursive: true });
        await writeFile(dataPath, JSON.stringify(sortVideos(data), null, 2) + '\n', 'utf8');
        log(`  ✔ ${files[0]} (${Math.round(totalDuration(script))} s)`);
        results.push({ id: script.id, result: 'rendered' });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`  ✖ ${msg}`);
        results.push({ id: lesson.id, result: 'failed', detail: msg });
      }
    }
  } finally {
    if (server) stop(server);
  }
  return results;
}

/** Stable key order: the data file only changes in git when a video really changed. */
function sortVideos(data: DataFile): DataFile {
  return { ...data, videos: Object.fromEntries(Object.entries(data.videos).sort(([a], [b]) => a.localeCompare(b))) };
}
