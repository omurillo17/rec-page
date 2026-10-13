import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NARRATION_CACHE, fitVoice, loadScript, scriptInputHash } from '../src/index.js';

function lesson(script: object, cache?: object) {
  const dir = mkdtempSync(join(tmpdir(), 'lesson-'));
  mkdirSync(join(dir, 'audio'));
  mkdirSync(join(dir, 'captures'));
  writeFileSync(join(dir, 'captures', 'a.png'), 'png-v1');
  writeFileSync(join(dir, 'audio', '01.wav'), 'wav');
  writeFileSync(join(dir, 's.script.json'), JSON.stringify(script));
  if (cache) writeFileSync(join(dir, NARRATION_CACHE), JSON.stringify(cache));
  return dir;
}

const script = {
  id: 's',
  title: 'S',
  capture: [{ goto: '/' }],
  scenes: [
    { template: 'intro', durationSec: 2, title: 'Intro', objective: 'o', narration: { text: 'Hola mundo.' } },
    { template: 'demo', durationSec: 4, title: 'Demo', screenshot: 'captures/a.png', narration: { text: 'Texto nuevo.' } },
  ],
};

describe('narration cache', () => {
  it('attaches voice to unchanged scenes, stretches them, and reports changed text', async () => {
    const dir = lesson(script, {
      voice: '',
      rate: 0,
      scenes: { '1': { text: 'Hola mundo.', file: 'audio/01.wav', durationSec: 3.2 }, '2': { text: 'Texto viejo.', file: 'audio/02.wav', durationSec: 1 } },
    });
    const { script: s, staleNarration } = await loadScript(join(dir, 's.script.json'));
    expect(s.scenes[0]!.narration).toEqual({ text: 'Hola mundo.', audio: 'audio/01.wav', durationSec: 3.2 });
    expect(s.scenes[0]!.durationSec).toBe(fitVoice(3.2));
    expect(s.scenes[1]!.narration?.audio).toBeUndefined();
    expect(staleNarration).toEqual([2]);
  });

  it('without a cache there is nothing stale (narration not generated yet)', async () => {
    const { staleNarration } = await loadScript(join(lesson(script), 's.script.json'));
    expect(staleNarration).toEqual([]);
  });
});

describe('scriptInputHash', () => {
  it('changes with the screenshots, not with the capture steps', async () => {
    const dir = lesson(script);
    const path = join(dir, 's.script.json');
    const h1 = await scriptInputHash((await loadScript(path)).script, dir);
    writeFileSync(path, JSON.stringify({ ...script, capture: [{ goto: '/otra' }] }));
    expect(await scriptInputHash((await loadScript(path)).script, dir)).toBe(h1);
    writeFileSync(join(dir, 'captures', 'a.png'), 'png-v2');
    expect(await scriptInputHash((await loadScript(path)).script, dir)).not.toBe(h1);
  });
});
