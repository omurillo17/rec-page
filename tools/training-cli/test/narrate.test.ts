import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { wavDuration } from '../src/narrate.js';

/** Minimal PCM WAV: 16 kHz mono 16-bit, `seconds` of silence, with an extra LIST chunk before data. */
function wav(seconds: number): Buffer {
  const byteRate = 16000 * 2;
  const data = Buffer.alloc(Math.round(seconds * byteRate));
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'latin1');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8);
  fmt.writeUInt16LE(1, 10);
  fmt.writeUInt32LE(16000, 12);
  fmt.writeUInt32LE(byteRate, 16);
  fmt.writeUInt16LE(2, 20);
  fmt.writeUInt16LE(16, 22);
  const list = Buffer.concat([Buffer.from('LIST', 'latin1'), Buffer.from([4, 0, 0, 0]), Buffer.from('INFO', 'latin1')]);
  const dataHead = Buffer.alloc(8);
  dataHead.write('data', 0, 'latin1');
  dataHead.writeUInt32LE(data.length, 4);
  const body = Buffer.concat([Buffer.from('WAVE', 'latin1'), fmt, list, dataHead, data]);
  const riff = Buffer.alloc(8);
  riff.write('RIFF', 0, 'latin1');
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

describe('wavDuration', () => {
  it('reads the duration from the header, skipping extra chunks', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'wav-')), 'a.wav');
    writeFileSync(file, wav(2.5));
    expect(await wavDuration(file)).toBeCloseTo(2.5, 3);
  });

  it('rejects files that are not WAV', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'wav-')), 'b.wav');
    writeFileSync(file, 'not a wav');
    await expect(wavDuration(file)).rejects.toThrow(/no es un WAV/);
  });
});
