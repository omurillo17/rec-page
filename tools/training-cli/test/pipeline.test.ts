import { describe, expect, it } from 'vitest';
import { CaptureStepSchema, ProjectConfigSchema } from '@seventeen-training/core';
import { expandSteps } from '../src/capture.js';

describe('capture steps', () => {
  it('accepts every step kind and rejects unknown keys', () => {
    const ok = [{ goto: '/x', wait: 100 }, { fill: '#a', value: 'b' }, { click: 'text=Guardar' }, { waitFor: 'js=document.body' }, { sleep: 10 }, { eval: '1' }, { run: 'echo 1' }, { use: 'login' }, { shot: '01-inicio', regions: { a: 'main' } }];
    for (const s of ok) expect(CaptureStepSchema.safeParse(s).success, JSON.stringify(s)).toBe(true);
    expect(CaptureStepSchema.safeParse({ click: '#a', submit: true }).success).toBe(false);
    expect(CaptureStepSchema.safeParse({ shot: 'Con Espacios' }).success).toBe(false);
  });

  it('expands nested macros and reports unknown or recursive ones', () => {
    const macros = { login: [{ goto: '/login' }, { use: 'enter' }], enter: [{ click: 'button' }], loop: [{ use: 'loop' }] };
    expect(expandSteps([{ use: 'login' }, { sleep: 1 }], macros)).toEqual([{ goto: '/login' }, { click: 'button' }, { sleep: 1 }]);
    expect(() => expandSteps([{ use: 'nope' }], macros)).toThrow(/No existe la macro "nope"/);
    expect(() => expandSteps([{ use: 'loop' }], macros)).toThrow(/Macro recursiva/);
  });
});

describe('training.config.json', () => {
  it('applies defaults', () => {
    const c = ProjectConfigSchema.parse({ baseUrl: 'http://127.0.0.1:3000', outDir: 'out', publicPath: '/v/', dataFile: 'videos.json' });
    expect(c.viewport).toEqual({ width: 1366, height: 768, scale: 1.5 });
    expect(c.changeThreshold).toBe(0.004);
    expect(c.narration.rate).toBe(0);
    expect(c.macros).toEqual({});
  });

  it('rejects a baseUrl without protocol', () => {
    expect(ProjectConfigSchema.safeParse({ baseUrl: 'localhost:3000', outDir: 'o', publicPath: '/', dataFile: 'd.json' }).success).toBe(false);
  });
});
