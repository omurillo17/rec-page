import { existsSync, statSync } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  ManifestSchema,
  TourSchema,
  formatIssues,
  parseVtt,
  type Manifest,
  type Tour,
} from '@seventeen-training/core';

export interface Report {
  errors: string[];
  warnings: string[];
  manifest?: Manifest;
  tours: Tour[];
}

const SECRET_KEY = /token|secret|password|passwd|api[-_]?key|authorization|credential|cookie|session/i;
const SECRET_VALUE = /Bearer\s+\S|eyJ[\w-]{10,}\.[\w-]{10,}|[?&](token|access_token|sig|signature|key|x-amz-signature|x-amz-credential)=|https:\/\/[^/\s:@]+:[^/\s@]+@/i;

/** Flags anything that looks like a credential inside content JSON (manifests and tours must never carry them). */
export function findSecrets(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return SECRET_VALUE.test(value) ? [`${path || '(raíz)'}: parece contener un token o credencial`] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findSecrets(v, `${path}.${i}`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [
      ...(SECRET_KEY.test(k) ? [`${path ? `${path}.` : ''}${k}: los manifiestos no deben incluir campos de credenciales`] : []),
      ...findSecrets(v, path ? `${path}.${k}` : k),
    ]);
  }
  return [];
}

async function readHead(file: string, n: number): Promise<Buffer> {
  const fh = await open(file, 'r');
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await fh.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

export async function isMp4(file: string): Promise<boolean> {
  return (await readHead(file, 12)).subarray(4, 8).toString('latin1') === 'ftyp';
}

export async function isImage(file: string): Promise<boolean> {
  const h = await readHead(file, 12);
  return (
    (h[0] === 0xff && h[1] === 0xd8) || // jpeg
    h.subarray(0, 4).toString('latin1') === '\x89PNG' ||
    (h.subarray(0, 4).toString('latin1') === 'RIFF' && h.subarray(8, 12).toString('latin1') === 'WEBP')
  );
}

async function readJson(file: string, report: Report): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    report.errors.push(`${file}: JSON inválido o ilegible (${(e as Error).message})`);
    return undefined;
  }
}

function dupes(ids: string[]): string[] {
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}

/** Resolve `input` (folder or manifest.json) to the manifest path. */
export function manifestPath(input: string): string {
  const p = resolve(input);
  return existsSync(p) && statSync(p).isDirectory() ? join(p, 'manifest.json') : p;
}

/**
 * Validate an application's training folder: manifest schema, cross references, tour files,
 * media files (MP4 signature, images, WebVTT syntax and timing) and accidental secrets.
 */
export async function validateContent(input: string): Promise<Report> {
  const report: Report = { errors: [], warnings: [], tours: [] };
  const file = manifestPath(input);
  if (!existsSync(file)) {
    report.errors.push(`No existe ${file}`);
    return report;
  }
  const raw = await readJson(file, report);
  if (raw === undefined) return report;
  report.errors.push(...findSecrets(raw).map((m) => `manifest.json → ${m}`));
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) {
    report.errors.push(...formatIssues(parsed.error).map((m) => `manifest.json → ${m}`));
    return report;
  }
  const m = (report.manifest = parsed.data);
  const root = dirname(file);

  // Where relative asset paths live on disk (only when assetsBase is relative or absent).
  const base = m.assetsBase;
  const localBase = !base ? root : /^(https:\/\/|\/)/.test(base) ? undefined : join(root, base);
  if (!localBase) report.warnings.push(`assetsBase "${base}" no es local: los archivos multimedia no se verifican`);
  const local = (p: string) => (!localBase || /^(https:\/\/|\/)/.test(p) ? undefined : join(localBase, p));

  // Unique ids and references
  for (const [kind, ids] of [
    ['módulo', m.modules.map((x) => x.id)],
    ['tutorial', m.tutorials.map((x) => x.id)],
    ['recorrido', m.tours.map((x) => x.id)],
  ] as const) {
    for (const d of dupes([...ids])) report.errors.push(`Id de ${kind} duplicado: "${d}"`);
  }
  const modules = new Set(m.modules.map((x) => x.id));
  const tourIds = new Set(m.tours.map((x) => x.id));
  for (const t of m.tutorials) {
    if (!modules.has(t.module)) report.errors.push(`Tutorial "${t.id}": módulo inexistente "${t.module}"`);
    if (t.tourId && !tourIds.has(t.tourId)) report.errors.push(`Tutorial "${t.id}": recorrido inexistente "${t.tourId}"`);
  }

  // Tours
  for (const ref of m.tours) {
    if (!modules.has(ref.module)) report.errors.push(`Recorrido "${ref.id}": módulo inexistente "${ref.module}"`);
    if (/^(https:\/\/|\/)/.test(ref.src)) {
      report.warnings.push(`Recorrido "${ref.id}": ${ref.src} no es local, no se verifica`);
      continue;
    }
    const tf = join(root, ref.src);
    if (!existsSync(tf)) {
      report.errors.push(`Recorrido "${ref.id}": no existe ${ref.src}`);
      continue;
    }
    const traw = await readJson(tf, report);
    if (traw === undefined) continue;
    report.errors.push(...findSecrets(traw).map((x) => `${ref.src} → ${x}`));
    const tp = TourSchema.safeParse(traw);
    if (!tp.success) {
      report.errors.push(...formatIssues(tp.error).map((x) => `${ref.src} → ${x}`));
      continue;
    }
    const tour = tp.data;
    report.tours.push(tour);
    if (tour.id !== ref.id) report.errors.push(`${ref.src}: id "${tour.id}" no coincide con el manifiesto ("${ref.id}")`);
    if (tour.module !== ref.module) report.errors.push(`${ref.src}: módulo "${tour.module}" no coincide con el manifiesto ("${ref.module}")`);
    tour.steps.forEach((s, i) => {
      if (s.element && !s.element.includes('[data-training')) {
        report.warnings.push(`${ref.src} paso ${i + 1}: usa [data-training='...'] en vez de "${s.element}" (más estable ante cambios de diseño)`);
      }
    });
  }

  // Media
  for (const t of m.tutorials) {
    const v = t.video;
    const where = `Tutorial "${t.id}"`;
    const all = [v.src, v.poster, ...v.captions.map((c) => c.src)].filter(Boolean) as string[];
    if (t.access === 'protected') {
      const pub = all.filter((p) => /(^|[\\/])(public|static)([\\/]|$)/.test(local(p) ?? p) || p.startsWith('https://'));
      if (pub.length) report.warnings.push(`${where} es "protected" pero ${pub.join(', ')} parece un directorio o URL pública; sírvelo desde una ruta autenticada`);
    }
    const src = local(v.src);
    if (src) {
      if (!existsSync(src)) report.errors.push(`${where}: no existe el video ${v.src}`);
      else if (!(await isMp4(src))) report.errors.push(`${where}: ${v.src} no es un MP4 válido (falta la caja ftyp)`);
    }
    const poster = v.poster && local(v.poster);
    if (poster) {
      if (!existsSync(poster)) report.errors.push(`${where}: no existe la miniatura ${v.poster}`);
      else if (!(await isImage(poster))) report.errors.push(`${where}: ${v.poster} no es JPG, PNG ni WebP`);
    }
    if (!v.captions.length) report.warnings.push(`${where}: sin subtítulos (recomendado para accesibilidad)`);
    for (const c of v.captions) {
      const cf = local(c.src);
      if (!cf) continue;
      if (!existsSync(cf)) {
        report.errors.push(`${where}: no existe el subtítulo ${c.src}`);
        continue;
      }
      try {
        const cues = parseVtt(await readFile(cf, 'utf8'));
        if (!cues.length) report.warnings.push(`${where}: ${c.src} no tiene cues`);
        const last = Math.max(0, ...cues.map((q) => q.end));
        if (last > v.durationSec + 0.5) report.errors.push(`${where}: ${c.src} termina en ${last}s, después de la duración (${v.durationSec}s)`);
      } catch (e) {
        report.errors.push(`${where}: ${c.src} → ${(e as Error).message}`);
      }
    }
    v.chapters.forEach((ch, i) => {
      if (ch.startSec >= v.durationSec) report.errors.push(`${where}: capítulo "${ch.title}" empieza después del final`);
      if (i > 0 && ch.startSec <= v.chapters[i - 1]!.startSec) report.errors.push(`${where}: capítulos fuera de orden en "${ch.title}"`);
    });
  }
  return report;
}
