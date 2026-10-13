import {
  ManifestSchema,
  TourSchema,
  formatIssues,
  type Manifest,
  type Status,
  type Tour,
  type TourRef,
  type Tutorial,
} from '@seventeen-training/content-schema';

export * from '@seventeen-training/content-schema';

export class TrainingContentError extends Error {
  constructor(
    message: string,
    readonly issues: string[] = [],
  ) {
    super(issues.length ? `${message}\n- ${issues.join('\n- ')}` : message);
    this.name = 'TrainingContentError';
  }
}

/** Parse + validate unknown JSON as a manifest. Throws TrainingContentError with readable issues. */
export function parseManifest(data: unknown): Manifest {
  const r = ManifestSchema.safeParse(data);
  if (!r.success) throw new TrainingContentError('Manifiesto inválido', formatIssues(r.error));
  return r.data;
}

export function parseTour(data: unknown): Tour {
  const r = TourSchema.safeParse(data);
  if (!r.success) throw new TrainingContentError('Recorrido inválido', formatIssues(r.error));
  return r.data;
}

export interface LoadOptions {
  /** Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /**
   * Defaults to "same-origin": the browser sends the host app's own session cookie,
   * so protected routes keep working without the kit ever seeing a token.
   */
  credentials?: RequestCredentials;
}

export interface LoadedManifest {
  manifest: Manifest;
  /** Absolute URL used to resolve relative asset paths. */
  baseUrl: string;
}

async function getJson(url: string, opts: LoadOptions): Promise<unknown> {
  const f = opts.fetch ?? globalThis.fetch;
  const res = await f(url, {
    credentials: opts.credentials ?? 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new TrainingContentError(`No se pudo cargar ${url} (HTTP ${res.status})`);
  return res.json();
}

/** Fetch and validate a manifest. `url` may be relative to `location.href`. */
export async function loadManifest(url: string, opts: LoadOptions = {}): Promise<LoadedManifest> {
  const abs = new URL(url, globalThis.location?.href ?? 'http://localhost/').href;
  const manifest = parseManifest(await getJson(abs, opts));
  const baseUrl = new URL(manifest.assetsBase ?? './', abs).href;
  return { manifest, baseUrl: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/` };
}

export async function loadTour(ref: TourRef, baseUrl: string, opts: LoadOptions = {}): Promise<Tour> {
  const tour = parseTour(await getJson(resolveAsset(baseUrl, ref.src), opts));
  if (tour.id !== ref.id) {
    throw new TrainingContentError(`El recorrido "${ref.src}" declara id "${tour.id}", se esperaba "${ref.id}"`);
  }
  return tour;
}

export function resolveAsset(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).href;
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}

/** True when the manifest declares no UI range, or appVersion is unknown, or it falls in [min, max). */
export function isUiCompatible(manifest: Manifest, appVersion?: string): boolean {
  if (!manifest.ui || !appVersion) return true;
  if (compareVersions(appVersion, manifest.ui.minVersion) < 0) return false;
  return !manifest.ui.maxVersion || compareVersions(appVersion, manifest.ui.maxVersion) < 0;
}

// ---------------------------------------------------------------------------
// Content selection
// ---------------------------------------------------------------------------

export interface SelectOptions {
  module?: string;
  /**
   * Roles as resolved BY THE HOST SERVER. Used to hide content for UX only;
   * this filter is not a security boundary (see docs/security.md).
   */
  roles?: string[];
  /** Show draft/review items (authoring/preview environments). */
  includeDrafts?: boolean;
  appVersion?: string;
}

export interface SelectedContent {
  tutorials: Tutorial[];
  tours: TourRef[];
  /** False when the app version is outside manifest.ui; tours would target stale selectors. */
  toursEnabled: boolean;
}

function visible(status: Status, includeDrafts: boolean): boolean {
  return status === 'published' || (includeDrafts && (status === 'draft' || status === 'review'));
}

function allowed(itemRoles: string[] | undefined, roles: string[] | undefined): boolean {
  return !itemRoles || (roles ?? []).some((r) => itemRoles.includes(r));
}

export function selectContent(manifest: Manifest, opts: SelectOptions = {}): SelectedContent {
  const drafts = opts.includeDrafts ?? false;
  if (!visible(manifest.status, drafts)) return { tutorials: [], tours: [], toursEnabled: false };
  const keep = <T extends { module: string; status: Status; roles?: string[] }>(x: T) =>
    (!opts.module || x.module === opts.module) && visible(x.status, drafts) && allowed(x.roles, opts.roles);
  const toursEnabled = isUiCompatible(manifest, opts.appVersion);
  return {
    tutorials: manifest.tutorials.filter(keep),
    tours: toursEnabled ? manifest.tours.filter(keep) : [],
    toursEnabled,
  };
}

/**
 * Up to `limit` other tutorials of the same app: same module first, then shared tags, then the rest.
 * `candidates` should already be filtered with selectContent (without module) so hidden items never leak.
 */
export function recommend(current: Tutorial, candidates: Tutorial[], limit = 3): Tutorial[] {
  const score = (t: Tutorial) =>
    (t.module === current.module ? 10 : 0) + t.tags.filter((x) => current.tags.includes(x)).length;
  return candidates
    .filter((t) => t.id !== current.id)
    .map((t, i) => ({ t, s: score(t), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.t);
}

// ---------------------------------------------------------------------------
// WebVTT
// ---------------------------------------------------------------------------

export interface Cue {
  start: number;
  end: number;
  text: string;
}

function parseTimestamp(ts: string): number {
  const m = /^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/.exec(ts.trim());
  if (!m) throw new TrainingContentError(`Marca de tiempo WebVTT inválida: "${ts}"`);
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/** Minimal WebVTT parser (cues only; NOTE/STYLE/REGION blocks are skipped). Throws on malformed input. */
export function parseVtt(text: string): Cue[] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(src)) {
    throw new TrainingContentError('El archivo WebVTT debe comenzar con "WEBVTT"');
  }
  const cues: Cue[] = [];
  for (const block of src.split(/\n{2,}/).slice(1)) {
    const lines = block.split('\n').filter((l) => l.length > 0);
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at === -1) continue; // NOTE, STYLE, REGION or stray text
    const [a, rest] = lines[at]!.split('-->');
    const start = parseTimestamp(a!);
    const end = parseTimestamp(rest!.trim().split(/\s+/)[0]!);
    if (end <= start) throw new TrainingContentError(`Cue con fin <= inicio: "${lines[at]}"`);
    cues.push({ start, end, text: lines.slice(at + 1).join('\n') });
  }
  return cues;
}

export function formatTimestamp(sec: number): string {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

export function toVtt(cues: Cue[]): string {
  return `WEBVTT\n\n${cues.map((c) => `${formatTimestamp(c.start)} --> ${formatTimestamp(c.end)}\n${c.text}`).join('\n\n')}\n`;
}

/** "m:ss" for UI labels. */
export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
