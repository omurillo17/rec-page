/**
 * Server-only helper (Node.js). Imported as `@seventeen-training/core/server` so the browser
 * bundle of the kit never pulls in `node:fs`.
 */
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
};

/**
 * `bytes=a-b`, `bytes=a-` or `bytes=-n` → `[start, end]` (inclusive). No header or an unsupported
 * form (several ranges) → `undefined`, and the whole file is served, as RFC 9110 allows.
 */
export function parseRange(header: string | null, size: number): [number, number] | 'invalid' | undefined {
  const m = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!m || (!m[1] && !m[2])) return undefined;
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return start > end || start >= size ? 'invalid' : [start, end];
}

/**
 * Serves one training file (video, captions, poster…) from `root` as a Web `Response`, for Next.js
 * route handlers and any framework built on `Request`/`Response`. Supports `Range` so videos can seek.
 *
 * It does NOT authenticate: check the session (and the user's roles) before calling it.
 * Paths outside `root` (`..`, absolute paths, symlinks) and unknown file types return 404.
 */
export async function serveTrainingFile(request: Request, root: string, path: string | string[]): Promise<Response> {
  const notFound = new Response(null, { status: 404 });
  const base = await realpath(resolve(root)).catch(() => undefined);
  const type = TYPES[extname(Array.isArray(path) ? (path.at(-1) ?? '') : path).toLowerCase()];
  if (!base || !type) return notFound;
  const file = await realpath(resolve(base, ...(Array.isArray(path) ? path : [path]))).catch(() => undefined);
  const info = file?.startsWith(base + sep) ? await stat(file).catch(() => undefined) : undefined;
  if (!file || !info?.isFile()) return notFound;

  const headers: Record<string, string> = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  };
  const range = parseRange(request.headers.get('range'), info.size);
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${info.size}` } });
  }
  const [start, end] = range ?? [0, info.size - 1];
  headers['Content-Length'] = String(Math.max(0, end - start + 1));
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  const body =
    request.method === 'HEAD' || info.size === 0
      ? null
      : (Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>);
  return new Response(body, { status: range ? 206 : 200, headers });
}
