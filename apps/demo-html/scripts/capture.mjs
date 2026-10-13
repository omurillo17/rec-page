// Captures REAL screenshots of the running demo (pnpm dev) for the video scripts, plus the
// on-screen position of every [data-training] element so highlights use measured coordinates.
// Uses the Chrome Headless Shell that Remotion already downloads, driven over the DevTools protocol.
//   pnpm --filter demo-html dev        (in another terminal)
//   pnpm --filter demo-html capture
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureBrowser } from '@remotion/renderer';

const URL_BASE = process.env.DEMO_URL ?? 'http://localhost:5173/';
const OUT = fileURLToPath(new URL('../training-src/', import.meta.url));
const W = 1280;
const H = 720;
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const status = await ensureBrowser();
if (!('path' in status)) throw new Error('No hay navegador disponible');
const chrome = spawn(status.path, [`--remote-debugging-port=${PORT}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json()).catch(() => undefined);
  }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const run = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1.5, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });

  async function load() {
    await send('Page.navigate', { url: URL_BASE });
    for (let i = 0; i < 50 && !(await run(`document.readyState === 'complete' && !!customElements.get('seventeen-training')`)); i++) await sleep(100);
    await sleep(300);
  }

  async function shot(dir, name) {
    mkdirSync(join(OUT, dir, 'captures'), { recursive: true });
    await run(`document.activeElement?.blur()`); // no caret or focus ring in captures
    await sleep(350);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, dir, 'captures', `${name}.png`), Buffer.from(data, 'base64'));
    // Element rectangles as fractions of the viewport = fractions of the screenshot.
    const regions = await run(`Object.fromEntries([...document.querySelectorAll('[data-training], tbody tr:first-child')].map(el => {
      const r = el.getBoundingClientRect();
      const f = (n) => Math.round(n * 1000) / 1000;
      return [el.dataset.training ?? 'first-row', { x: f(r.x / ${W}), y: f(r.y / ${H}), width: f(r.width / ${W}), height: f(r.height / ${H}) }];
    }))`);
    console.log(`✔ ${dir}/captures/${name}.png`);
    return regions;
  }

  const fill = `(() => {
    const f = document.querySelector('#client-form');
    const set = (n, v) => { f[n].value = v; f[n].dispatchEvent(new Event('input', { bubbles: true })); };
    set('name', 'Ferretería El Roble S.A. de C.V.'); set('rfc', 'fer210507mn4'); set('email', 'compras@elroble.example'); f.type.value = 'Moral';
  })()`;

  const regions = { 'registrar-cliente': {}, 'buscar-cliente': {} };
  await load();
  regions['registrar-cliente']['01-listado'] = await shot('registrar-cliente', '01-listado');
  await run(`document.querySelector('#new-client').click()`);
  await run(fill);
  regions['registrar-cliente']['02-formulario'] = await shot('registrar-cliente', '02-formulario');
  await run(`document.querySelector('#client-form').requestSubmit()`);
  regions['registrar-cliente']['03-resultado'] = await shot('registrar-cliente', '03-resultado');

  await load();
  regions['buscar-cliente']['01-listado'] = await shot('buscar-cliente', '01-listado');
  await run(`(() => { const s = document.querySelector('#search'); s.value = 'logístico'; s.dispatchEvent(new Event('input')); })()`);
  regions['buscar-cliente']['02-busqueda'] = await shot('buscar-cliente', '02-busqueda');

  for (const [dir, r] of Object.entries(regions)) writeFileSync(join(OUT, dir, 'captures', 'regions.json'), JSON.stringify(r, null, 2) + '\n');
  ws.close();
} finally {
  chrome.kill();
}
