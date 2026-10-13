#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { formatDuration } from '@seventeen-training/core';
import { validateContent } from './validate.js';

const HELP = `Seventeen Training Kit CLI

Uso:
  training validate --input <carpeta|manifest.json>   Valida manifiesto, recorridos, videos, subtítulos y secretos
  training validate --input <guion.json>              Valida un guion de video y sus capturas
  training list     --input <carpeta|manifest.json>   Lista módulos, tutoriales y recorridos
  training render   --input <guion.json> [--out <carpeta>] [--size <px>]
                                                      Genera MP4 + subtítulos WebVTT + miniatura
  training preview  --input <guion.json>              Abre Remotion Studio con el guion
  training narrate  --input <guion.json> [--voice <nombre>] [--rate <-10..10>] [--force]
                                                      Voz local de Windows por escena (solo lo que cambió)
  training build    --input <carpeta> [--only id1,id2] [--force] [--no-capture]
                                                      Todo el pipeline con training.config.json: servidor demo,
                                                      capturas, voz, validación y render incremental

Opciones:
  -i, --input   Ruta de entrada (obligatoria)
  -o, --out     Carpeta de salida de render (por defecto: ./out junto al guion)
  --size        Lado largo en px, p. ej. 640 para un borrador rápido
  --voice       Voz instalada de Windows (por defecto la primera en español)
  --rate        Velocidad de la voz, -10 a 10 (por defecto 0)
  -h, --help    Muestra esta ayuda
`;

/** A video script is a JSON file with "scenes"; anything else is treated as a manifest or training folder. */
function isScript(p: string): boolean {
  try {
    return !statSync(p).isDirectory() && Array.isArray(JSON.parse(readFileSync(p, 'utf8')).scenes);
  } catch {
    return false;
  }
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      input: { type: 'string', short: 'i' },
      out: { type: 'string', short: 'o' },
      size: { type: 'string' },
      voice: { type: 'string' },
      rate: { type: 'string' },
      only: { type: 'string' },
      force: { type: 'boolean' },
      'no-capture': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [cmd] = positionals;
  if (values.help || !cmd) {
    console.log(HELP);
    return cmd || values.help ? 0 : 1;
  }
  const input = values.input;
  if (!input) {
    console.error('Falta --input\n\n' + HELP);
    return 1;
  }

  switch (cmd) {
    case 'validate':
      return isScript(input) ? validateScript(input) : validateManifest(input);
    case 'list':
      return list(input);
    case 'render':
      return render(input, values.out, values.size ? Number(values.size) : undefined);
    case 'preview':
      return preview(input);
    case 'narrate':
      return narrateCmd(input, values.voice, values.rate ? Number(values.rate) : undefined, values.force);
    case 'build':
      return buildCmd(input, values.only?.split(',').map((s) => s.trim()).filter(Boolean), values.force, !values['no-capture']);
    default:
      console.error(`Comando desconocido: ${cmd}\n\n${HELP}`);
      return 1;
  }
}

async function buildCmd(input: string, only: string[] | undefined, force = false, capture = true): Promise<number> {
  const { build } = await import('./build.js');
  try {
    const results = await build({ input, only, force, capture });
    const by = (r: string) => results.filter((x) => x.result === r).length;
    console.log(`
${by('failed') ? '✖' : '✔'} ${by('rendered')} renderizado(s), ${by('up-to-date')} sin cambios, ${by('failed')} con error`);
    return by('failed') ? 1 : 0;
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`);
    return 1;
  }
}

async function narrateCmd(input: string, voice?: string, rate?: number, force?: boolean): Promise<number> {
  const { narrate } = await import('./narrate.js');
  try {
    const r = await narrate({ scriptPath: input, voice, rate, force });
    console.log(`✔ Voz "${r.voice}": ${r.generated} escena(s) generadas, ${r.reused} reutilizadas.`);
    return 0;
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`);
    return 1;
  }
}

async function validateManifest(input: string): Promise<number> {
  const r = await validateContent(input);
  for (const w of r.warnings) console.log(`  ⚠ ${w}`);
  for (const e of r.errors) console.log(`  ✖ ${e}`);
  if (r.errors.length) {
    console.log(`\n✖ ${r.errors.length} error(es), ${r.warnings.length} advertencia(s)`);
    return 1;
  }
  const m = r.manifest!;
  console.log(`✔ ${m.appId}@${m.contentVersion}: ${m.tutorials.length} tutorial(es), ${r.tours.length} recorrido(s), ${r.warnings.length} advertencia(s)`);
  return 0;
}

async function validateScript(input: string): Promise<number> {
  const { readScript, missingAssets, totalDuration } = await import('@seventeen-training/video-renderer');
  try {
    const s = await readScript(input);
    const missing = missingAssets(s, dirname(resolve(input)));
    for (const m of missing) console.log(`  ✖ Falta recurso: ${m}`);
    if (missing.length) return 1;
    if (s.status === 'draft') console.log('  ⚠ status "draft": el video llevará la marca BORRADOR hasta que alguien verifique el procedimiento');
    console.log(`✔ Guion "${s.id}": ${s.scenes.length} escena(s), ${formatDuration(totalDuration(s))}`);
    return 0;
  } catch (e) {
    console.log(`  ✖ ${(e as Error).message}`);
    return 1;
  }
}

async function list(input: string): Promise<number> {
  const r = await validateContent(input);
  if (!r.manifest) {
    for (const e of r.errors) console.log(`  ✖ ${e}`);
    return 1;
  }
  const m = r.manifest;
  console.log(`${m.appId}  contenido ${m.contentVersion}  [${m.status}]${m.ui ? `  UI ${m.ui.minVersion}${m.ui.maxVersion ? ` – <${m.ui.maxVersion}` : '+'}` : ''}`);
  for (const mod of m.modules) {
    console.log(`\n■ ${mod.title} (${mod.id})`);
    for (const t of m.tutorials.filter((x) => x.module === mod.id)) {
      const roles = t.roles ? `  roles: ${t.roles.join(', ')}` : '';
      console.log(`  ▶ ${t.id.padEnd(28)} ${formatDuration(t.video.durationSec).padStart(6)}  [${t.status}] [${t.access}]${roles}  ${t.title}`);
    }
    for (const t of m.tours.filter((x) => x.module === mod.id)) {
      const steps = r.tours.find((x) => x.id === t.id)?.steps.length ?? '?';
      console.log(`  ⌖ ${t.id.padEnd(28)} ${`${steps} pasos`.padStart(6)}  [${t.status}]  ${t.title}`);
    }
  }
  if (r.errors.length) console.log(`\n⚠ El contenido tiene ${r.errors.length} error(es); ejecuta "training validate".`);
  return 0;
}

async function render(input: string, out?: string, size?: number): Promise<number> {
  const { renderTutorial } = await import('@seventeen-training/video-renderer');
  const outDir = resolve(out ?? join(dirname(resolve(input)), 'out'));
  let last = '';
  try {
    const r = await renderTutorial({
      scriptPath: input,
      outDir,
      size,
      onProgress: (stage, p) => {
        const line = `${stage} ${Math.round(p * 100)}%`;
        if (line !== last && (p === 0 || p === 1 || Math.round(p * 100) % 10 === 0)) console.log(`  ${line}`);
        last = line;
      },
    });
    console.log(`\n✔ Video:      ${r.video}\n✔ Subtítulos: ${r.captions}\n✔ Miniatura:  ${r.poster}`);
    console.log('\nBloque "video" sugerido para el manifiesto (copia los archivos a tu carpeta de recursos):');
    console.log(JSON.stringify(r.manifestVideo, null, 2));
    return 0;
  } catch (e) {
    console.error(`✖ ${(e as Error).message}`);
    return 1;
  }
}

async function preview(input: string): Promise<number> {
  const { readScript, remotionEntry } = await import('@seventeen-training/video-renderer');
  const script = resolve(input);
  // Studio gets the parsed script (defaults applied, region highlights resolved).
  const props = join(tmpdir(), `training-preview-${process.pid}.json`);
  writeFileSync(props, JSON.stringify(await readScript(script)));
  const req = createRequire(remotionEntry);
  const cli = join(dirname(req.resolve('@remotion/cli/package.json')), 'remotion-cli.js');
  const child = spawn(process.execPath, [cli, 'studio', remotionEntry, `--props=${props}`, `--public-dir=${dirname(script)}`], { stdio: 'inherit' });
  return new Promise((res) => child.on('exit', (code) => res(code ?? 0)));
}

main(process.argv.slice(2)).then(
  (code) => (process.exitCode = code),
  (e) => {
    console.error(e);
    process.exitCode = 1;
  },
);
