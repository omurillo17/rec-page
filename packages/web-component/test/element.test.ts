// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseTour } from '@seventeen-training/core';
import { defineTrainingElement, type SeventeenTrainingElement } from '../src/index.js';
import { toDriveSteps } from '../src/tour.js';

const manifest = {
  schemaVersion: 1,
  appId: 'demo',
  contentVersion: '1.0.0',
  status: 'published',
  modules: [{ id: 'clientes', title: 'Clientes' }],
  tutorials: [
    {
      id: 'registrar',
      module: 'clientes',
      title: '<img src=x onerror="window.__pwned=1">Registrar',
      description: 'Alta de clientes',
      status: 'published',
      video: { src: 'videos/r.mp4', durationSec: 40, chapters: [{ startSec: 0, title: 'Intro' }] },
    },
    { id: 'oculto', module: 'clientes', title: 'Solo admin', description: 'x', status: 'published', roles: ['admin'], video: { src: 'v.mp4', durationSec: 5 } },
    { id: 'borrador', module: 'clientes', title: 'Borrador', description: 'x', status: 'draft', video: { src: 'v.mp4', durationSec: 5 } },
  ],
  tours: [{ id: 'registrar', module: 'clientes', title: 'Registrar', status: 'published', src: 'tours/registrar.json' }],
};

const tick = () => new Promise((r) => setTimeout(r, 0));

function mount(attrs: Record<string, string>) {
  const el = document.createElement('seventeen-training') as SeventeenTrainingElement;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
}

beforeAll(() => defineTrainingElement());
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('toDriveSteps', () => {
  it('maps schema steps onto Driver.js options and drops invalid selectors', () => {
    const tour = parseTour({
      id: 't',
      module: 'm',
      title: 'T',
      steps: [
        { title: 'Intro', description: 'centered' },
        { element: "[data-training='a']", title: 'A', description: 'a', side: 'left', optional: true, waitForMs: 500 },
        { element: '[[[nope', title: 'Bad', description: 'invalid selector' },
      ],
    });
    const { steps, invalid } = toDriveSteps(tour);
    expect(invalid).toEqual([2]);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ element: undefined, waitForElement: 0 });
    expect(steps[1]).toMatchObject({
      element: "[data-training='a']",
      skipMissingElement: true,
      waitForElement: 500,
      popover: { title: 'A', description: 'a', side: 'left' },
    });
  });

  it('passes tour texts to Driver.js as plain text (Driver.js uses innerHTML)', () => {
    const tour = parseTour({
      id: 't',
      module: 'm',
      title: 'T',
      steps: [{ title: '<b>Hola</b>', description: '<img src=x onerror="alert(1)"> & "más"' }],
    });
    expect(toDriveSteps(tour).steps[0]!.popover).toMatchObject({
      title: '&lt;b&gt;Hola&lt;/b&gt;',
      description: '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;más&quot;',
    });
  });
});

describe('<seventeen-training>', () => {
  it('renders a help button without fetching anything until opened', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const el = mount({ manifest: '/training/manifest.json', module: 'clientes', label: 'Ayuda' });
    expect(el.shadowRoot!.querySelector('.trigger')!.textContent).toContain('Ayuda');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('lists only published, permitted content and never renders manifest text as HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(manifest))));
    const el = mount({ manifest: '/training/manifest.json', module: 'clientes' });
    await el.open();
    const root = el.shadowRoot!;
    const titles = [...root.querySelectorAll('.card-title')].map((n) => n.textContent);
    expect(titles).toEqual(['<img src=x onerror="window.__pwned=1">Registrar']);
    expect(root.querySelector('.card img')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    expect(root.querySelector('.tours button')!.textContent).toContain('Registrar');
  });

  it('shows role-restricted content when the host passes the role', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(manifest))));
    const el = mount({ manifest: '/m.json', module: 'clientes', roles: 'ventas, admin' });
    await el.open();
    expect(el.shadowRoot!.querySelectorAll('.card')).toHaveLength(2);
  });

  it('opens the player with chapters and recommendations', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(manifest))));
    const el = mount({ manifest: '/training/manifest.json', module: 'clientes', 'include-drafts': '' });
    await el.openTutorial('registrar');
    const root = el.shadowRoot!;
    expect(root.querySelector('video source')!.getAttribute('src')).toMatch(/\/training\/videos\/r\.mp4$/);
    expect(root.querySelectorAll('.chapters button')).toHaveLength(1);
    expect([...root.querySelectorAll('.recs button')].map((b) => b.textContent)).toEqual(['Borrador']);
    expect(root.querySelector('select')!.options.length).toBe(5);
  });

  it('fails softly: error message + training-error event, no exception', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = mount({ manifest: '/m.json' });
    const errors: string[] = [];
    el.addEventListener('training-error', (e) => errors.push((e as CustomEvent).detail.message));
    await expect(el.open()).resolves.toBeUndefined();
    await tick();
    expect(el.shadowRoot!.querySelector('.error')!.textContent).toContain('sigue funcionando');
    expect(errors[0]).toMatch(/HTTP 500/);
  });
});
