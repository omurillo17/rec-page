import { describe, expect, it, vi } from 'vitest';
import {
  TrainingContentError,
  isUiCompatible,
  loadManifest,
  loadTour,
  parseManifest,
  parseVtt,
  recommend,
  selectContent,
  toVtt,
  type Manifest,
} from '../src/index.js';

const video = { src: 'v.mp4', durationSec: 10 };
const m: Manifest = parseManifest({
  schemaVersion: 1,
  appId: 'demo',
  contentVersion: '1.0.0',
  status: 'published',
  ui: { minVersion: '1.0.0', maxVersion: '2.0.0' },
  modules: [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
  ],
  tutorials: [
    { id: 'a1', module: 'a', title: 'A1', description: 'd', status: 'published', video, tags: ['x'] },
    { id: 'a2', module: 'a', title: 'A2', description: 'd', status: 'draft', video },
    { id: 'a3', module: 'a', title: 'A3', description: 'd', status: 'published', roles: ['admin'], video },
    { id: 'b1', module: 'b', title: 'B1', description: 'd', status: 'published', video, tags: ['x'] },
    { id: 'b2', module: 'b', title: 'B2', description: 'd', status: 'published', video },
  ],
  tours: [{ id: 't', module: 'a', title: 'T', status: 'published', src: 'tours/t.json' }],
});

describe('selectContent', () => {
  it('filters by module, status and roles', () => {
    expect(selectContent(m, { module: 'a' }).tutorials.map((t) => t.id)).toEqual(['a1']);
    expect(selectContent(m, { module: 'a', roles: ['admin'] }).tutorials.map((t) => t.id)).toEqual(['a1', 'a3']);
    expect(selectContent(m, { module: 'a', includeDrafts: true }).tutorials.map((t) => t.id)).toEqual(['a1', 'a2']);
  });

  it('hides everything when the manifest itself is not published', () => {
    expect(selectContent({ ...m, status: 'draft' }).tutorials).toEqual([]);
  });

  it('disables tours (not videos) outside the compatible UI range', () => {
    expect(selectContent(m, { appVersion: '1.4.2' }).tours).toHaveLength(1);
    const old = selectContent(m, { appVersion: '2.0.0' });
    expect(old.toursEnabled).toBe(false);
    expect(old.tours).toEqual([]);
    expect(old.tutorials.length).toBeGreaterThan(0);
  });
});

describe('isUiCompatible', () => {
  it('compares numerically, not lexically', () => {
    expect(isUiCompatible(m, '1.10.0')).toBe(true);
    expect(isUiCompatible(m, '0.9.9')).toBe(false);
    expect(isUiCompatible(m)).toBe(true);
  });
});

describe('recommend', () => {
  it('prefers same module, then shared tags, never the current one', () => {
    const all = selectContent(m).tutorials;
    const a1 = all.find((t) => t.id === 'a1')!;
    expect(recommend(a1, all).map((t) => t.id)).toEqual(['b1', 'b2']);
    const b2 = all.find((t) => t.id === 'b2')!;
    expect(recommend(b2, all, 1).map((t) => t.id)).toEqual(['b1']);
  });
});

describe('WebVTT', () => {
  it('parses cues, skipping NOTE blocks and cue settings', () => {
    const src = '﻿WEBVTT\r\n\r\nNOTE hola\r\n\r\n1\r\n00:00:01.000 --> 00:00:02.500 align:start\r\nHola\r\nmundo\r\n\r\n00:03.000 --> 00:04.000\r\nAdiós\r\n';
    expect(parseVtt(src)).toEqual([
      { start: 1, end: 2.5, text: 'Hola\nmundo' },
      { start: 3, end: 4, text: 'Adiós' },
    ]);
  });

  it('rejects files without header or with inverted times', () => {
    expect(() => parseVtt('00:00:01.000 --> 00:00:02.000\nx')).toThrow(TrainingContentError);
    expect(() => parseVtt('WEBVTT\n\n00:00:03.000 --> 00:00:02.000\nx')).toThrow(/fin <= inicio/);
  });

  it('round-trips through toVtt', () => {
    const cues = [{ start: 0.3, end: 61.25, text: 'Uno' }];
    expect(parseVtt(toVtt(cues))).toEqual(cues);
  });
});

describe('loadManifest / loadTour', () => {
  const json = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));

  it('resolves assets relative to the manifest and sends same-origin credentials only', async () => {
    const fetch = vi.fn((_url: string, _init?: RequestInit) => json({ ...m, ui: undefined }));
    const { baseUrl } = await loadManifest('https://app.example/static/training/manifest.json', { fetch: fetch as typeof globalThis.fetch });
    expect(baseUrl).toBe('https://app.example/static/training/');
    expect(fetch.mock.calls[0]![1]).toMatchObject({ credentials: 'same-origin' });
  });

  it('throws readable errors for HTTP failures and invalid content', async () => {
    await expect(loadManifest('https://x.example/m.json', { fetch: () => json({}, 403) })).rejects.toThrow(/HTTP 403/);
    await expect(loadManifest('https://x.example/m.json', { fetch: () => json({ appId: 1 }) })).rejects.toThrow(/Manifiesto inválido/);
  });

  it('checks the tour id against the manifest reference', async () => {
    const tour = { id: 'other', module: 'a', title: 'T', steps: [{ title: 'x', description: 'y' }] };
    await expect(loadTour(m.tours[0]!, 'https://x.example/', { fetch: () => json(tour) })).rejects.toThrow(/se esperaba "t"/);
  });
});
