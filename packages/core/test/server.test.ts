import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseRange, serveTrainingFile } from '../src/server.js';

describe('parseRange', () => {
  it.each([
    ['bytes=0-3', [0, 3]],
    ['bytes=4-', [4, 9]],
    ['bytes=-3', [7, 9]],
    ['bytes=-50', [0, 9]],
    ['bytes=5-500', [5, 9]],
  ] as const)('%s on 10 bytes', (header, expected) => expect(parseRange(header, 10)).toEqual(expected));

  it('rejects unsatisfiable ranges and ignores unsupported ones', () => {
    expect(parseRange('bytes=10-', 10)).toBe('invalid');
    expect(parseRange('bytes=5-2', 10)).toBe('invalid');
    expect(parseRange('bytes=-0', 10)).toBe('invalid');
    expect(parseRange(null, 10)).toBeUndefined();
    expect(parseRange('bytes=0-1,4-5', 10)).toBeUndefined();
    expect(parseRange('items=0-1', 10)).toBeUndefined();
  });
});

describe('serveTrainingFile', () => {
  let root: string;
  let outside: string;
  beforeAll(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'training-files-'));
    root = join(dir, 'training');
    await mkdir(join(root, 'videos'), { recursive: true });
    await writeFile(join(root, 'videos', 'a.mp4'), '0123456789');
    await writeFile(join(root, 'notes.txt'), 'secret');
    outside = join(dir, 'outside.mp4');
    await writeFile(outside, 'private');
  });
  const get = (path: string | string[], headers: Record<string, string> = {}, method = 'GET') =>
    serveTrainingFile(new Request('http://app/x', { headers, method }), root, path);

  it('serves the whole file with its type', async () => {
    const res = await get(['videos', 'a.mp4']);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(await res.text()).toBe('0123456789');
  });

  it('serves byte ranges so the player can seek', async () => {
    const res = await get('videos/a.mp4', { range: 'bytes=2-5' });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(res.headers.get('content-length')).toBe('4');
    expect(await res.text()).toBe('2345');
    expect((await get('videos/a.mp4', { range: 'bytes=20-' })).status).toBe(416);
  });

  it('answers HEAD without a body', async () => {
    const res = await get('videos/a.mp4', {}, 'HEAD');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-length')).toBe('10');
    expect(await res.text()).toBe('');
  });

  it('returns 404 for traversal, absolute paths, unknown types and missing files', async () => {
    for (const path of [['..', 'outside.mp4'], outside, 'notes.txt', 'videos/missing.mp4', 'videos', ['videos', '..', '..', 'outside.mp4']]) {
      expect((await get(path)).status, String(path)).toBe(404);
    }
  });

  it('does not follow symlinks out of the root', async (ctx) => {
    try {
      await symlink(outside, join(root, 'videos', 'link.mp4'));
    } catch {
      ctx.skip(); // Windows without symlink privilege
    }
    expect((await get('videos/link.mp4')).status).toBe(404);
  });
});
