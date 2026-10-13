import type { Chapter, Cue, Scene, VideoScript } from '@seventeen-training/core';

export interface TimedScene {
  scene: Scene;
  start: number;
  end: number;
}

export function sceneTimeline(script: VideoScript): TimedScene[] {
  let t = 0;
  return script.scenes.map((scene) => {
    const start = t;
    t += scene.durationSec;
    return { scene, start, end: t };
  });
}

export function totalDuration(script: VideoScript): number {
  return script.scenes.reduce((s, x) => s + x.durationSec, 0);
}

/** Even pixel sizes (required by H.264). landscape 1280 → 1280x720, portrait 1280 → 720x1280. */
export function dimensions(format: VideoScript['format']): { width: number; height: number } {
  const long = format.size - (format.size % 2);
  const short = Math.round((format.size * 9) / 16 / 2) * 2;
  return format.orientation === 'portrait' ? { width: short, height: long } : { width: long, height: short };
}

const MAX_CUE_CHARS = 84;

/** Split narration into readable subtitle chunks: by sentence, then long sentences into balanced parts. */
export function splitCaptionText(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.trim().split(/(?<=[.!?…])\s+/)) {
    // Even parts ("a b c" / "d e f") instead of a full line plus a dangling word or two.
    const target = sentence.length / Math.ceil(sentence.length / MAX_CUE_CHARS);
    let line = '';
    for (const word of sentence.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && (next.length > MAX_CUE_CHARS || line.length >= target)) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
  }
  return out;
}

/**
 * Subtitle cues derived from scene narration. Each chunk gets time proportional to its length
 * inside its scene, so the burned-in captions and the exported .vtt use the exact same timing.
 */
export function buildCaptionCues(script: VideoScript): Cue[] {
  const LEAD = 0.3;
  const TAIL = 0.2;
  const cues: Cue[] = [];
  for (const { scene, start, end } of sceneTimeline(script)) {
    if (!scene.narration) continue;
    const parts = splitCaptionText(scene.narration.text);
    const total = parts.reduce((s, p) => s + p.length, 0);
    // With recorded audio the voice starts with the scene: follow the voice, not the scene length.
    const voice = scene.narration.audio && scene.narration.durationSec;
    const lead = voice ? 0.1 : LEAD;
    const span = Math.max(0.5, voice ? Math.min(voice, end - start) - lead : end - start - LEAD - TAIL);
    let t = start + lead;
    for (const p of parts) {
      const d = (span * p.length) / total;
      cues.push({ start: round(t), end: round(t + d), text: p });
      t += d;
    }
  }
  return cues;
}

/** One chapter per scene: ready to paste into the manifest's video.chapters. */
export function buildChapters(script: VideoScript): Chapter[] {
  return sceneTimeline(script).map(({ scene, start }) => ({ startSec: round(start), title: scene.chapter ?? scene.title }));
}

const round = (n: number) => Math.round(n * 1000) / 1000;
