import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Minimal Chrome DevTools Protocol client used to capture REAL screenshots of an app.
 * No dependencies: launches Chrome headless and drives one page over a WebSocket.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrowserOptions {
  executable: string;
  width: number;
  height: number;
  scale: number;
  /** CSS selectors hidden in every page (dev overlays, chat widgets…). */
  hide?: string[];
  /** e.g. "es-MX": native date inputs and Intl formats follow it. */
  locale?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Element lookup run inside the page. Query forms: CSS selector, "text=Visible text"
 * (exact match first, then prefix) or "js=<expression returning an Element>".
 */
const FIND = `(q) => {
  if (q.startsWith('js=')) return (0, eval)(q.slice(3));
  if (!q.startsWith('text=')) return document.querySelector(q);
  const t = q.slice(5).trim().toLowerCase();
  const all = [...document.querySelectorAll('button, a, [role=button], label, h1, h2, h3, span, div, td, li, p, input, select, textarea')];
  const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const txt = (el) => (el.innerText || el.value || el.placeholder || '').trim().toLowerCase();
  return all.filter(vis).find((el) => txt(el) === t) ?? all.filter(vis).find((el) => txt(el).startsWith(t)) ?? null;
}`;

export class Browser {
  private constructor(
    private readonly proc: ChildProcess,
    private readonly ws: WebSocket,
    private readonly profile: string,
  ) {}

  private id = 0;
  private pending = new Map<number, (msg: { result?: unknown; error?: { message: string } }) => void>();

  static async open(opts: BrowserOptions): Promise<Browser> {
    if (!existsSync(opts.executable)) throw new Error(`No existe el navegador ${opts.executable}`);
    // Fresh profile per run: no leftover localStorage or cookies between lessons.
    const profile = mkdtempSync(join(tmpdir(), 'training-capture-'));
    const proc = spawn(
      opts.executable,
      ['--headless=new', '--remote-debugging-port=0', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, ...(opts.locale ? [`--lang=${opts.locale}`] : []), `--window-size=${opts.width},${opts.height}`, 'about:blank'],
      { stdio: 'ignore' },
    );
    // With port 0 Chrome picks a free port and writes it to DevToolsActivePort.
    let port: string | undefined;
    for (let i = 0; i < 100 && !port; i++) {
      await sleep(100);
      const f = join(profile, 'DevToolsActivePort');
      if (existsSync(f)) port = readFileSync(f, 'utf8').split('\n')[0]?.trim() || undefined;
    }
    if (!port) throw new Error('Chrome no abrió el puerto de depuración');
    type Target = { type: string; webSocketDebuggerUrl: string };
    let target: Target | undefined;
    for (let i = 0; i < 50 && !target; i++) {
      const list = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => [])) as Target[];
      target = list.find((t) => t.type === 'page');
      if (!target) await sleep(100);
    }
    if (!target) throw new Error('Chrome no expuso una página');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => {
      ws.addEventListener('open', r, { once: true });
      ws.addEventListener('error', j, { once: true });
    });
    const b = new Browser(proc, ws, profile);
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(String(e.data));
      const cb = msg.id && b.pending.get(msg.id);
      if (cb) {
        b.pending.delete(msg.id);
        cb(msg);
      }
    });
    await b.send('Page.enable');
    await b.send('Emulation.setDeviceMetricsOverride', { width: opts.width, height: opts.height, deviceScaleFactor: opts.scale, mobile: false });
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (opts.locale) await b.send('Emulation.setLocaleOverride', { locale: opts.locale });
    if (opts.hide?.length) {
      const css = `${opts.hide.join(',')}{display:none!important}`;
      await b.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(css)}; document.head.append(s); });`,
      });
    }
    return b;
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const n = ++this.id;
      this.pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result as T)));
      this.ws.send(JSON.stringify({ id: n, method, params }));
    });
  }

  /** Evaluate an expression in the page and return its JSON value. */
  async eval<T = unknown>(expression: string): Promise<T> {
    const r = await this.send<{ result: { value: T }; exceptionDetails?: { text: string; exception?: { description?: string } } }>('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(`Error en la página: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }

  async goto(url: string, wait = 1500): Promise<void> {
    await this.send('Page.navigate', { url });
    for (let i = 0; i < 150 && (await this.eval('document.readyState').catch(() => '')) !== 'complete'; i++) await sleep(100);
    await sleep(wait);
  }

  async exists(q: string): Promise<boolean> {
    return this.eval<boolean>(`(() => { try { return !!(${FIND})(${JSON.stringify(q)}); } catch { return false; } })()`);
  }

  async waitFor(q: string, timeout = 15_000): Promise<void> {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await this.exists(q)) return;
      await sleep(150);
    }
    throw new Error(`No apareció en ${timeout / 1000}s: ${q}`);
  }

  async click(q: string): Promise<void> {
    await this.waitFor(q);
    await this.eval(`(${FIND})(${JSON.stringify(q)}).click()`);
    await sleep(500);
  }

  /**
   * Real mouse click (CDP Input events at the element's center). Needed by widgets that listen to
   * mousedown/mouseup instead of click, e.g. react-big-calendar events and slots.
   */
  async realClick(q: string): Promise<void> {
    await this.waitFor(q);
    const p = await this.eval<{ x: number; y: number }>(`(() => {
      const el = (${FIND})(${JSON.stringify(q)});
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await this.send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
    }
    await sleep(500);
  }

  /** Type like a user: native value setter + input/change events (React-friendly). */
  async fill(q: string, value: string): Promise<void> {
    await this.waitFor(q);
    await this.eval(`(() => {
      const el = (${FIND})(${JSON.stringify(q)});
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  }

  /** PNG of the viewport plus the visible rectangle (fractions 0..1) of each region query. */
  async screenshot(regions: Record<string, string>): Promise<{ png: Buffer; rects: Record<string, Rect | null> }> {
    await this.eval('document.activeElement?.blur()');
    await sleep(400);
    const { data } = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    const rects = await this.eval<Record<string, Rect | null>>(`(() => {
      const find = ${FIND}; const out = {};
      for (const [k, q] of Object.entries(${JSON.stringify(regions)})) {
        let el = null; try { el = find(q); } catch {}
        if (!el) { out[k] = null; continue; }
        const r = el.getBoundingClientRect(); const f = (n) => Math.round(n * 1000) / 1000;
        const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(innerWidth, r.right), y1 = Math.min(innerHeight, r.bottom);
        out[k] = x1 > x0 && y1 > y0 ? { x: f(x0 / innerWidth), y: f(y0 / innerHeight), width: f((x1 - x0) / innerWidth), height: f((y1 - y0) / innerHeight) } : null;
      }
      return out;
    })()`);
    return { png: Buffer.from(data, 'base64'), rects };
  }

  /**
   * Fraction of pixels that differ between two PNGs (decoded by the browser itself, so no
   * image library is needed). Different sizes count as fully different.
   */
  async diff(a: Buffer, b: Buffer): Promise<number> {
    return this.eval<number>(`(async () => {
      const load = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + b64; });
      const [a, b] = await Promise.all([load(${JSON.stringify(a.toString('base64'))}), load(${JSON.stringify(b.toString('base64'))})]);
      if (a.naturalWidth !== b.naturalWidth || a.naturalHeight !== b.naturalHeight) return 1;
      const px = (img) => { const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight); const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const da = px(a), db = px(b); let diff = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 48) diff++;
      }
      return diff / (da.length / 4);
    })()`);
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
    // Chrome spawns child processes; on Windows only killing the tree releases them all.
    try {
      if (process.platform === 'win32' && this.proc.pid) execSync(`taskkill /pid ${this.proc.pid} /T /F`, { stdio: 'ignore' });
      else this.proc.kill();
    } catch {
      /* already exited */
    }
    setTimeout(() => rmSync(this.profile, { recursive: true, force: true, maxRetries: 5 }), 1500).unref();
  }
}
