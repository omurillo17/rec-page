import { describe, expect, it } from 'vitest';
import { VideoScriptSchema } from '@seventeen-training/core';
import { buildCaptionCues, buildChapters, dimensions, sceneTimeline, splitCaptionText } from '../src/timeline.js';

const script = VideoScriptSchema.parse({
  id: 's',
  title: 'S',
  scenes: [
    { template: 'intro', durationSec: 4, title: 'Intro', objective: 'o', narration: { text: 'Hola. ¿Listo para empezar?' } },
    { template: 'steps', durationSec: 6, title: 'Pasos', steps: ['a'] },
    { template: 'outro', durationSec: 5, title: 'Fin', conclusion: 'c', narration: { text: 'Adiós.' } },
  ],
});

describe('timeline', () => {
  it('chains scenes and builds one chapter per scene', () => {
    expect(sceneTimeline(script).map((s) => [s.start, s.end])).toEqual([[0, 4], [4, 10], [10, 15]]);
    expect(buildChapters(script)).toEqual([
      { startSec: 0, title: 'Intro' },
      { startSec: 4, title: 'Pasos' },
      { startSec: 10, title: 'Fin' },
    ]);
  });

  it('keeps every caption cue inside its scene, ordered and non-overlapping', () => {
    const cues = buildCaptionCues(script);
    expect(cues.map((c) => c.text)).toEqual(['Hola.', '¿Listo para empezar?', 'Adiós.']);
    expect(cues[0]!.start).toBeGreaterThanOrEqual(0);
    expect(cues[1]!.end).toBeLessThanOrEqual(4);
    expect(cues[2]!.start).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < cues.length; i++) expect(cues[i]!.start).toBeGreaterThanOrEqual(cues[i - 1]!.end);
  });

  it('splits long sentences into readable chunks', () => {
    const long = 'palabra '.repeat(40).trim() + '.';
    for (const part of splitCaptionText(long)) expect(part.length).toBeLessThanOrEqual(84);
  });

  it('computes even H.264 dimensions for both orientations', () => {
    expect(dimensions({ orientation: 'landscape', size: 1920, fps: 30 })).toEqual({ width: 1920, height: 1080 });
    expect(dimensions({ orientation: 'portrait', size: 1280, fps: 30 })).toEqual({ width: 720, height: 1280 });
    const odd = dimensions({ orientation: 'landscape', size: 855, fps: 30 });
    expect(odd.width % 2 + odd.height % 2).toBe(0);
  });
});
