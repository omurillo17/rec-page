import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TrainingContentError, type CaptureStep, type ProjectConfig } from '@seventeen-training/core';
import { Browser, type Rect } from './browser.js';

/** Replace `{ use: "macro" }` steps with the macro's steps (macros may use other macros). */
export function expandSteps(steps: CaptureStep[], macros: Record<string, CaptureStep[]>, trail: string[] = []): CaptureStep[] {
  return steps.flatMap((s) => {
    if (!('use' in s)) return [s];
    if (trail.includes(s.use)) throw new TrainingContentError(`Macro recursiva: ${[...trail, s.use].join(' → ')}`);
    const m = macros[s.use];
    if (!m) throw new TrainingContentError(`No existe la macro "${s.use}" en training.config.json`);
    return expandSteps(m, macros, [...trail, s.use]);
  });
}

export interface ShotReport {
  shot: string;
  /** new: first capture · changed: screen differs · same: differences below the threshold (old file kept). */
  status: 'new' | 'changed' | 'same';
  /** Fraction of changed pixels against the previous capture. */
  ratio: number;
  missingRegions: string[];
}

export interface CaptureOptions {
  steps: CaptureStep[];
  /** Lesson folder; screenshots go to <dir>/captures. */
  dir: string;
  /** Folder of training.config.json: cwd for `run` steps. */
  projectDir: string;
  config: ProjectConfig;
  executable: string;
  log?: (msg: string) => void;
}

type Regions = Record<string, Record<string, Rect | null>>;

/**
 * Reproduce the procedure in the real app and save captures/<shot>.png + captures/regions.json.
 * A screenshot whose pixels barely changed (clocks, "hace 5 min") keeps the previous file, so
 * the video's fingerprint does not change and it is not re-rendered.
 */
export async function captureLesson(opts: CaptureOptions): Promise<ShotReport[]> {
  const { config } = opts;
  const log = opts.log ?? (() => {});
  const capturesDir = join(opts.dir, 'captures');
  await mkdir(capturesDir, { recursive: true });
  const regionsFile = join(capturesDir, 'regions.json');
  const previous: Regions = existsSync(regionsFile) ? JSON.parse(await readFile(regionsFile, 'utf8')) : {};
  const regions: Regions = {};
  const reports: ShotReport[] = [];

  const browser = await Browser.open({ executable: opts.executable, ...config.viewport, hide: config.hide, locale: config.locale });
  try {
    for (const step of expandSteps(opts.steps, config.macros)) {
      if ('goto' in step) await browser.goto(/^https?:\/\//.test(step.goto) ? step.goto : new URL(step.goto, config.baseUrl).href, step.wait);
      else if ('fill' in step) await browser.fill(step.fill, step.value);
      else if ('click' in step) await (step.real ? browser.realClick(step.click) : browser.click(step.click));
      else if ('waitFor' in step) await browser.waitFor(step.waitFor, step.timeout);
      else if ('sleep' in step) await new Promise((r) => setTimeout(r, step.sleep));
      else if ('eval' in step) await browser.eval(step.eval);
      else if ('run' in step) execSync(step.run, { cwd: opts.projectDir, stdio: 'pipe' });
      else if ('shot' in step) {
        const { png, rects } = await browser.screenshot(step.regions);
        const file = join(capturesDir, `${step.shot}.png`);
        let status: ShotReport['status'] = 'new';
        let ratio = 1;
        if (existsSync(file)) {
          ratio = await browser.diff(await readFile(file), png);
          status = ratio < config.changeThreshold ? 'same' : 'changed';
        }
        if (status === 'same') {
          // Keep the old picture and its measurements; take fresh ones where the old are missing.
          const old = previous[step.shot] ?? {};
          regions[step.shot] = Object.fromEntries(Object.entries(rects).map(([k, v]) => [k, old[k] ?? v]));
        } else {
          await writeFile(file, png);
          regions[step.shot] = rects;
        }
        const missingRegions = Object.entries(regions[step.shot]!).filter(([, v]) => !v).map(([k]) => k);
        reports.push({ shot: step.shot, status, ratio, missingRegions });
        log(`  📷 ${step.shot}: ${status === 'same' ? 'sin cambios' : status === 'new' ? 'nueva' : `cambió (${(ratio * 100).toFixed(1)} %)`}${missingRegions.length ? `  ⚠ no encontré: ${missingRegions.join(', ')}` : ''}`);
      }
    }
  } finally {
    browser.close();
  }
  await writeFile(regionsFile, JSON.stringify(regions, null, 2) + '\n', 'utf8');
  return reports;
}
