import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { VideoScriptSchema, formatIssues, TrainingContentError } from '@seventeen-training/core';
import { NARRATION_CACHE, type NarrationCache } from '@seventeen-training/video-renderer';

const run = promisify(execFile);

/** Duration of a PCM WAV file from its header (byte rate + "data" chunk size). */
export async function wavDuration(file: string): Promise<number> {
  const fh = await open(file, 'r');
  try {
    const head = Buffer.alloc(4096);
    const { bytesRead } = await fh.read(head, 0, head.length, 0);
    const buf = head.subarray(0, bytesRead);
    if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') {
      throw new TrainingContentError(`${file} no es un WAV`);
    }
    let byteRate = 0;
    for (let i = 12; i + 8 <= buf.length; ) {
      const id = buf.toString('latin1', i, i + 4);
      const size = buf.readUInt32LE(i + 4);
      if (id === 'fmt ') byteRate = buf.readUInt32LE(i + 16);
      if (id === 'data') return byteRate ? size / byteRate : 0;
      i += 8 + size + (size % 2);
    }
    throw new TrainingContentError(`${file}: WAV sin bloque de datos`);
  } finally {
    await fh.close();
  }
}

// Windows built-in speech (SAPI via System.Speech): offline, free, no keys.
const PS_SCRIPT = `
param([string]$jobs, [string]$voice, [int]$rate)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
if ($voice) { $s.SelectVoice($voice) }
else {
  $es = $s.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'es*' } | Select-Object -First 1
  if (-not $es) { throw 'No hay voces en español instaladas en Windows' }
  $s.SelectVoice($es.VoiceInfo.Name)
}
$s.Rate = $rate
foreach ($j in (Get-Content $jobs -Raw -Encoding UTF8 | ConvertFrom-Json)) {
  $s.SetOutputToWaveFile($j.out)
  $s.Speak($j.text)
}
$s.SetOutputToNull()
$s.Voice.Name
$s.Dispose()
`;

export interface NarrateOptions {
  scriptPath: string;
  /** Installed Windows voice name, e.g. "Microsoft Sabina Desktop". Default: first Spanish voice. */
  voice?: string;
  /** SAPI rate -10..10 (0 = normal). */
  rate?: number;
  /** Regenerate every scene even if its text did not change. */
  force?: boolean;
}

export interface NarrateResult {
  voice: string;
  generated: number;
  reused: number;
}

/**
 * Generate one WAV per narrated scene with the local Windows voice and record it in
 * audio/narration.json. Only scenes whose text (or voice/rate) changed are regenerated.
 * The script itself is not modified: readScript attaches the audio and stretches scenes.
 */
export async function narrate(opts: NarrateOptions): Promise<NarrateResult> {
  const scriptPath = resolve(opts.scriptPath);
  const raw = JSON.parse(await readFile(scriptPath, 'utf8'));
  const parsed = VideoScriptSchema.safeParse(raw);
  if (!parsed.success) throw new TrainingContentError(`Guion inválido: ${scriptPath}`, formatIssues(parsed.error));

  const dir = dirname(scriptPath);
  const cacheFile = join(dir, NARRATION_CACHE);
  const requested = { voice: opts.voice ?? '', rate: opts.rate ?? 0 };
  const old: NarrationCache | undefined = existsSync(cacheFile) ? JSON.parse(await readFile(cacheFile, 'utf8')) : undefined;
  const sameVoice = old && old.voice === requested.voice && old.rate === requested.rate;
  const cache: NarrationCache = { ...requested, scenes: {} };

  const jobs: { key: string; text: string; rel: string }[] = [];
  let reused = 0;
  parsed.data.scenes.forEach((scene, i) => {
    const text = scene.narration?.audio ? undefined : scene.narration?.text;
    if (!text) return;
    const key = String(i + 1);
    const prev = old?.scenes[key];
    if (!opts.force && sameVoice && prev && prev.text === text && existsSync(join(dir, prev.file))) {
      cache.scenes[key] = prev;
      reused++;
    } else jobs.push({ key, text, rel: `audio/${key.padStart(2, '0')}.wav` });
  });

  let voiceName = '';
  if (jobs.length) {
    if (process.platform !== 'win32') {
      throw new TrainingContentError('training narrate usa las voces de Windows (SAPI); en otro sistema graba el audio y usa narration.audio');
    }
    await mkdir(join(dir, 'audio'), { recursive: true });
    const tmp = join(tmpdir(), `training-narrate-${process.pid}`);
    await mkdir(tmp, { recursive: true });
    const jobsFile = join(tmp, 'jobs.json');
    const ps1 = join(tmp, 'narrate.ps1');
    await writeFile(jobsFile, JSON.stringify(jobs.map((j) => ({ text: j.text, out: join(dir, j.rel) }))), 'utf8');
    await writeFile(ps1, `\uFEFF${PS_SCRIPT}`, 'utf8');
    const { stdout } = await run('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1,
      '-jobs', jobsFile, '-voice', requested.voice, '-rate', String(requested.rate),
    ]);
    voiceName = stdout.trim().split(/\r?\n/).pop() ?? '';
    for (const j of jobs) {
      const durationSec = Math.round((await wavDuration(join(dir, j.rel))) * 100) / 100;
      cache.scenes[j.key] = { text: j.text, file: j.rel, durationSec };
    }
  }
  await writeFile(cacheFile, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  return { voice: voiceName || requested.voice || '(sin cambios)', generated: jobs.length, reused };
}
