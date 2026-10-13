import { describe, expect, it } from 'vitest';
import { AssetPathSchema, ManifestSchema, TourSchema, VideoScriptSchema } from '../src/index.js';

const manifest = {
  schemaVersion: 1,
  appId: 'demo',
  contentVersion: '1.0.0',
  status: 'published',
  modules: [{ id: 'clientes', title: 'Clientes' }],
  tutorials: [
    {
      id: 't1',
      module: 'clientes',
      title: 'T1',
      description: 'd',
      status: 'published',
      video: { src: 'videos/t1.mp4', durationSec: 10 },
    },
  ],
};

describe('ManifestSchema', () => {
  it('accepts a minimal manifest and applies defaults', () => {
    const m = ManifestSchema.parse(manifest);
    expect(m.tutorials[0]!.access).toBe('public');
    expect(m.tutorials[0]!.video.captions).toEqual([]);
    expect(m.tours).toEqual([]);
  });

  it('rejects unknown keys such as credentials', () => {
    expect(ManifestSchema.safeParse({ ...manifest, apiToken: 'x' }).success).toBe(false);
  });

  it('rejects ids with spaces or uppercase', () => {
    expect(ManifestSchema.safeParse({ ...manifest, appId: 'Mi App' }).success).toBe(false);
  });
});

describe('AssetPathSchema', () => {
  it.each(['videos/a.mp4', '/media/a.mp4', 'https://cdn.example/a.mp4', 'a..b.mp4'])('accepts %s', (p) => {
    expect(AssetPathSchema.safeParse(p).success).toBe(true);
  });
  it.each(['javascript:alert(1)', 'data:video/mp4;base64,AA', 'http://insecure/a.mp4', '../secret.mp4', 'a/../../b'])(
    'rejects %s',
    (p) => {
      expect(AssetPathSchema.safeParse(p).success).toBe(false);
    },
  );
});

describe('TourSchema', () => {
  it('applies defaults for dynamic pages', () => {
    const t = TourSchema.parse({ id: 'x', module: 'm', title: 'X', steps: [{ element: '#a', title: 'A', description: 'B' }] });
    expect(t.steps[0]).toMatchObject({ optional: false, waitForMs: 3000 });
  });

  it('has no automation fields: unknown step keys are rejected', () => {
    const r = TourSchema.safeParse({ id: 'x', module: 'm', title: 'X', steps: [{ title: 'A', description: 'B', click: '#delete' }] });
    expect(r.success).toBe(false);
  });
});

describe('VideoScriptSchema', () => {
  it('requires a real screenshot for demo scenes and defaults to draft', () => {
    const base = { id: 's', title: 'S' };
    expect(VideoScriptSchema.safeParse({ ...base, scenes: [{ template: 'demo', durationSec: 3, title: 'x' }] }).success).toBe(false);
    const ok = VideoScriptSchema.parse({ ...base, scenes: [{ template: 'intro', durationSec: 3, title: 'x', objective: 'y' }] });
    expect(ok.status).toBe('draft');
    expect(ok.burnCaptions).toBe(false);
    expect(ok.format).toEqual({ orientation: 'landscape', size: 1280, fps: 30 });
  });
});
