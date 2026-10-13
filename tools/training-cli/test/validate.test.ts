import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findSecrets, validateContent } from '../src/validate.js';

const demo = fileURLToPath(new URL('../../../apps/demo-html/public/training', import.meta.url));

/** Minimal valid MP4 header: size + "ftyp" box. */
const MP4 = Buffer.from([0, 0, 0, 0x18, ...Buffer.from('ftypisom'), 0, 0, 0, 0]);

function fixture(manifest: object, files: Record<string, string | Buffer> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'training-'));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  return dir;
}

const base = {
  schemaVersion: 1,
  appId: 'x',
  contentVersion: '1.0.0',
  status: 'published',
  modules: [{ id: 'm', title: 'M' }],
};
const tutorial = (video: object, extra: object = {}) => ({ id: 't', module: 'm', title: 'T', description: 'd', status: 'published', video, ...extra });

describe('validateContent', () => {
  it('accepts the real demo content (rendered MP4s, WebVTT, tours)', async () => {
    const r = await validateContent(demo);
    expect(r.errors).toEqual([]);
    expect(r.manifest?.tutorials).toHaveLength(2);
    expect(r.tours.map((t) => t.id).sort()).toEqual(['buscar-cliente', 'registrar-cliente']);
  });

  it('reports broken references and missing tour files', async () => {
    const dir = fixture({
      ...base,
      tutorials: [tutorial({ src: 'v.mp4', durationSec: 5 }, { module: 'nope', tourId: 'ghost' })],
      tours: [{ id: 'tour', module: 'm', title: 'T', status: 'published', src: 'tours/missing.json' }],
    }, { 'v.mp4': MP4 });
    const { errors } = await validateContent(dir);
    expect(errors.join('\n')).toMatch(/módulo inexistente "nope"/);
    expect(errors.join('\n')).toMatch(/recorrido inexistente "ghost"/);
    expect(errors.join('\n')).toMatch(/no existe tours\/missing.json/);
  });

  it('checks media: MP4 signature, WebVTT syntax and caption length vs duration', async () => {
    const dir = fixture(
      {
        ...base,
        tutorials: [
          tutorial({
            src: 'v.mp4',
            durationSec: 5,
            captions: [
              { src: 'bad.vtt', srclang: 'es', label: 'ES' },
              { src: 'long.vtt', srclang: 'en', label: 'EN' },
            ],
            chapters: [{ startSec: 9, title: 'Tarde' }],
          }),
        ],
      },
      { 'v.mp4': 'not a video', 'bad.vtt': 'hola', 'long.vtt': 'WEBVTT\n\n00:00:01.000 --> 00:00:30.000\nx\n' },
    );
    const msg = (await validateContent(dir)).errors.join('\n');
    expect(msg).toMatch(/no es un MP4 válido/);
    expect(msg).toMatch(/bad\.vtt → .*WEBVTT/);
    expect(msg).toMatch(/long\.vtt termina en 30s/);
    expect(msg).toMatch(/capítulo "Tarde" empieza después del final/);
  });

  it('warns when protected content sits in a public directory', async () => {
    const dir = fixture({ ...base, tutorials: [tutorial({ src: 'public/v.mp4', durationSec: 5 }, { access: 'protected' })] }, { 'public/v.mp4': MP4 });
    const { warnings, errors } = await validateContent(dir);
    expect(errors).toEqual([]);
    expect(warnings.join('\n')).toMatch(/"protected" pero public\/v.mp4/);
  });

  it('flags credentials in manifests', async () => {
    const dir = fixture({ ...base, tutorials: [tutorial({ src: 'https://cdn.example/v.mp4?token=abc', durationSec: 5 })] });
    expect((await validateContent(dir)).errors.join('\n')).toMatch(/token o credencial/);
  });
});

describe('findSecrets', () => {
  it('detects secret-looking keys and values, ignores normal text', () => {
    expect(findSecrets({ apiKey: 'x' })).toHaveLength(1);
    expect(findSecrets({ a: ['Bearer abc.def'] })).toHaveLength(1);
    expect(findSecrets({ a: 'https://user:pass@host.example/v.mp4' })).toHaveLength(1);
    expect(findSecrets({ title: 'Cómo registrar un cliente', src: 'videos/a.mp4' })).toEqual([]);
  });
});
