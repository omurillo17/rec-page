import { Composition, type CalculateMetadataFunction } from 'remotion';
import { VideoScriptSchema, formatIssues, type VideoScript, type VideoScriptInput } from '@seventeen-training/core';
import { Tutorial } from './Tutorial.js';
import { dimensions, totalDuration } from '../timeline.js';

/** Shown in Remotion Studio when no --props are given. Uses no screenshots on purpose. */
const sample: VideoScriptInput = {
  id: 'ejemplo',
  title: 'Plantilla de ejemplo',
  scenes: [
    { template: 'intro', durationSec: 4, title: 'Plantilla de ejemplo', objective: 'Ver las plantillas sin recursos externos.', narration: { text: 'Este es un video de prueba generado sin claves externas.' } },
    { template: 'steps', durationSec: 5, title: 'Pasos', steps: ['Escribe un guion JSON.', 'Agrega capturas reales.', 'Ejecuta training render.'] },
    { template: 'outro', durationSec: 4, title: 'Conclusión', mistakes: ['Usar capturas de otra versión.'], conclusion: 'Revisa el borrador antes de publicarlo.' },
  ],
};

const calculateMetadata: CalculateMetadataFunction<VideoScript> = ({ props }) => {
  const r = VideoScriptSchema.safeParse(props);
  if (!r.success) throw new Error(`Guion inválido:\n- ${formatIssues(r.error).join('\n- ')}`);
  const script = r.data;
  const { width, height } = dimensions(script.format);
  return {
    props: script,
    fps: script.format.fps,
    width,
    height,
    durationInFrames: Math.round(totalDuration(script) * script.format.fps),
  };
};

export function Root() {
  return (
    <Composition
      id="Tutorial"
      component={Tutorial}
      defaultProps={sample as VideoScript}
      calculateMetadata={calculateMetadata}
      // Real values come from calculateMetadata.
      durationInFrames={1}
      fps={30}
      width={1280}
      height={720}
    />
  );
}
