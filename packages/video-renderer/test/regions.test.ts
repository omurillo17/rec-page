import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VideoScriptSchema } from '@seventeen-training/core';
import { resolveRegions } from '../src/index.js';

function setup(regions: object) {
  const dir = mkdtempSync(join(tmpdir(), 'regions-'));
  mkdirSync(join(dir, 'captures'));
  writeFileSync(join(dir, 'captures', 'regions.json'), JSON.stringify(regions));
  return dir;
}

const script = (highlights: object[]) =>
  VideoScriptSchema.parse({
    id: 's',
    title: 'S',
    scenes: [{ template: 'demo', durationSec: 3, title: 't', screenshot: 'captures/01-login.png', highlights }],
  });

describe('resolveRegions', () => {
  it('replaces named regions with measured rectangles, clipped to the screenshot', async () => {
    const dir = setup({ '01-login': { boton: { x: 0.5, y: 0.2, width: 0.1, height: 0.05 }, tabla: { x: 0.1, y: 0.6, width: 0.8, height: 0.9 } } });
    const s = script([{ region: 'boton', label: 'Entrar' }, { region: 'tabla' }, { x: 0, y: 0, width: 0.1, height: 0.1 }]);
    await resolveRegions(s, dir);
    const [boton, tabla, fijo] = (s.scenes[0] as { highlights: object[] }).highlights;
    expect(boton).toEqual({ x: 0.5, y: 0.2, width: 0.1, height: 0.05, label: 'Entrar' });
    expect(tabla).toMatchObject({ y: 0.6, height: 0.4 });
    expect(fijo).toEqual({ x: 0, y: 0, width: 0.1, height: 0.1 });
  });

  it('fails with a readable error when a region was not captured', async () => {
    const dir = setup({ '01-login': {} });
    await expect(resolveRegions(script([{ region: 'nada' }]), dir)).rejects.toThrow(/no hay región "nada"/);
  });
});
