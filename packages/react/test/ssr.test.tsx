// Runs in plain Node (no DOM), like Next.js server rendering.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TrainingHelp } from '../src/index.js';

describe('TrainingHelp (SSR)', () => {
  it('renders an inert custom element tag on the server without touching browser APIs', () => {
    expect(typeof window).toBe('undefined');
    const html = renderToString(
      createElement(TrainingHelp, { manifest: '/training/manifest.json', module: 'clientes', appVersion: '1.2.0', roles: ['ventas', 'admin'], includeDrafts: true }),
    );
    expect(html).toContain('<seventeen-training');
    expect(html).toContain('manifest="/training/manifest.json"');
    expect(html).toContain('module="clientes"');
    expect(html).toContain('app-version="1.2.0"');
    expect(html).toContain('roles="ventas,admin"');
    expect(html).toContain('include-drafts=""');
  });

  it('omits optional attributes', () => {
    const html = renderToString(createElement(TrainingHelp, { manifest: '/m.json' }));
    expect(html).not.toContain('roles=');
    expect(html).not.toContain('include-drafts');
  });
});
