import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AbsoluteFill,
  Html5Audio,
  Img,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type { Highlight, HighlightRef, Scene, VideoScript } from '@seventeen-training/core';
import { buildCaptionCues, sceneTimeline } from '../timeline.js';

const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';

/** Script paths are relative to the script folder, which is the bundle's public dir. */
const asset = (p: string) => (p.startsWith('https://') ? p : staticFile(p.replace(/^\//, '')));

/** 1 unit = 1px at 720p short side; keeps layouts identical across resolutions/orientations. */
function useUnit() {
  const { width, height } = useVideoConfig();
  return { u: Math.min(width, height) / 720, portrait: height > width };
}

function useEnter(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.6) });
  return { opacity: p, transform: `translateY(${(1 - p) * 16}px)` } satisfies CSSProperties;
}

export function Tutorial(script: VideoScript) {
  const { fps } = useVideoConfig();
  const cues = buildCaptionCues(script);
  return (
    <AbsoluteFill style={{ background: script.theme.background, color: '#f8fafc', fontFamily: FONT }}>
      {sceneTimeline(script).map(({ scene, start }, i) => (
        <Sequence key={i} from={Math.round(start * fps)} durationInFrames={Math.round(scene.durationSec * fps)} name={`${scene.template}: ${scene.title}`}>
          <SceneView scene={scene} script={script} />
          {scene.narration?.audio ? <Html5Audio src={asset(scene.narration.audio)} /> : null}
        </Sequence>
      ))}
      {script.music ? <Html5Audio src={asset(script.music.src)} volume={script.music.volume} loop /> : null}
      {script.burnCaptions ? <Captions cues={cues} /> : null}
      <ProgressBar color={script.theme.primary} />
      {script.status === 'draft' ? <DraftMark /> : null}
    </AbsoluteFill>
  );
}

function SceneView({ scene, script }: { scene: Scene; script: VideoScript }) {
  const primary = script.theme.primary;
  switch (scene.template) {
    case 'intro':
      return <Intro title={scene.title} objective={scene.objective} appTitle={script.title} primary={primary} />;
    case 'demo':
      return (
        <Frame title={scene.title} primary={primary} kicker="Demostración">
          <Screenshot src={scene.screenshot} highlights={scene.highlights} primary={primary} />
        </Frame>
      );
    case 'steps':
      return (
        <Frame title={scene.title} primary={primary} kicker="Paso a paso">
          <Steps durationSec={scene.durationSec} steps={scene.steps} screenshot={scene.screenshot} highlights={scene.highlights} primary={primary} />
        </Frame>
      );
    case 'result':
      return (
        <Frame title={scene.title} primary={primary} kicker="Resultado esperado">
          <Result description={scene.description} screenshot={scene.screenshot} highlights={scene.highlights} primary={primary} />
        </Frame>
      );
    case 'outro':
      return <Outro title={scene.title} mistakes={scene.mistakes} conclusion={scene.conclusion} primary={primary} />;
  }
}

// ------------------------------------------------------------------ templates

function Intro({ title, objective, appTitle, primary }: { title: string; objective: string; appTitle: string; primary: string }) {
  const { u } = useUnit();
  const [e0, e1, e2, e3] = [useEnter(0), useEnter(6), useEnter(14), useEnter(20)];
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 80 * u, gap: 24 * u }}>
      <div style={{ ...e0, fontSize: 22 * u, color: primary, fontWeight: 700, letterSpacing: 2 * u, textTransform: 'uppercase' }}>Videotutorial</div>
      <div style={{ ...e1, fontSize: 58 * u, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
      <div style={{ ...e2, display: 'flex', gap: 16 * u, alignItems: 'baseline', fontSize: 28 * u, maxWidth: 1000 * u }}>
        <span style={{ color: primary, fontWeight: 700 }}>Objetivo</span>
        <span style={{ opacity: 0.9 }}>{objective}</span>
      </div>
      {appTitle !== title ? <div style={{ ...e3, fontSize: 20 * u, opacity: 0.6 }}>{appTitle}</div> : null}
    </AbsoluteFill>
  );
}

function Frame({ title, kicker, primary, children }: { title: string; kicker: string; primary: string; children: ReactNode }) {
  const { u } = useUnit();
  return (
    <AbsoluteFill style={{ padding: `${36 * u}px ${48 * u}px ${110 * u}px`, gap: 20 * u }}>
      <div style={useEnter(0)}>
        <div style={{ fontSize: 16 * u, color: primary, fontWeight: 700, letterSpacing: 1.5 * u, textTransform: 'uppercase' }}>{kicker}</div>
        <div style={{ fontSize: 36 * u, fontWeight: 800 }}>{title}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 * u }}>{children}</div>
    </AbsoluteFill>
  );
}

/** Natural size of an image; holds the render (delayRender) until it is known. */
function useImageSize(src: string) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [handle] = useState(() => delayRender(`Midiendo ${src}`));
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setSize({ w: img.naturalWidth, h: img.naturalHeight });
      continueRender(handle);
    };
    img.onerror = () => cancelRender(new Error(`No se pudo cargar la captura ${src}`));
    img.src = src;
  }, [src, handle]);
  return size;
}

/**
 * Real screenshot (never generated), fitted inside the available box ("contain") with container
 * query units, so highlight percentages map exactly onto the image. Highlights appear one by one;
 * only the latest dims the rest of the screenshot.
 */
function Screenshot({ src, highlights: all, primary, top = false }: { src: string; highlights: (Highlight | HighlightRef)[]; primary: string; /** Stick to the top of the box (portrait text+image layouts). */ top?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useUnit();
  const url = asset(src);
  // Region references are resolved by readScript before rendering; skip any left unresolved.
  const highlights = all.filter((h): h is Highlight => 'x' in h);
  const size = useImageSize(url);
  const enter = useEnter(4);
  const delays = highlights.map((_, i) => Math.round(fps * (0.8 + i * 1.2)));
  const active = delays.filter((d) => frame >= d).length - 1;
  const box = (hl: Highlight): CSSProperties => ({ position: 'absolute', left: `${hl.x * 100}%`, top: `${hl.y * 100}%`, width: `${hl.width * 100}%`, height: `${hl.height * 100}%` });
  return (
    <div style={{ flex: '1 1 0', alignSelf: 'stretch', minWidth: 0, minHeight: 0, containerType: 'size', display: 'grid', placeItems: top ? 'start center' : 'center' }}>
      {size ? (
        <div style={{ ...enter, position: 'relative', width: `min(100cqw, calc(100cqh * ${size.w / size.h}))`, aspectRatio: `${size.w} / ${size.h}` }}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 10 * u, boxShadow: '0 20px 60px rgb(0 0 0 / 0.45)' }}>
            <Img src={url} style={{ width: '100%', height: '100%', display: 'block' }} />
            {active >= 0 ? (
              <div style={{ ...box(highlights[active]!), borderRadius: 8 * u, boxShadow: `0 0 0 ${4000 * u}px rgb(2 6 23 / ${0.45 * interpolate(frame, [delays[active]!, delays[active]! + 8], [0, 1], { extrapolateRight: 'clamp' })})` }} />
            ) : null}
          </div>
          {highlights.map((hl, i) => {
            const appear = interpolate(frame, [delays[i]!, delays[i]! + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const pulse = i === active ? 1 + 0.3 * Math.max(0, Math.sin(((frame - delays[i]!) / fps) * Math.PI * 1.2)) : 1;
            const below = hl.y + hl.height < 0.85;
            return (
              <div key={i} style={{ ...box(hl), opacity: appear * (i === active ? 1 : 0.6), border: `${3 * u * pulse}px solid ${primary}`, borderRadius: 8 * u }}>
                {hl.label && i === active ? (
                  <span style={{ position: 'absolute', right: 0, ...(below ? { top: '100%', marginTop: 8 * u } : { bottom: '100%', marginBottom: 8 * u }), whiteSpace: 'nowrap', background: primary, color: '#fff', fontSize: 20 * u, lineHeight: 1.3, padding: `${4 * u}px ${12 * u}px`, borderRadius: 6 * u, fontWeight: 700, boxShadow: '0 6px 20px rgb(0 0 0 / 0.35)' }}>
                    {hl.label}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Steps({ durationSec, steps, screenshot, highlights, primary }: { durationSec: number; steps: string[]; screenshot?: string; highlights: (Highlight | HighlightRef)[]; primary: string }) {
  const { u, portrait } = useUnit();
  const { fps } = useVideoConfig();
  const every = Math.max(8, Math.floor(((durationSec - 1) * fps) / steps.length));
  const list = (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 * u, flex: !screenshot ? '0 1 900px' : portrait ? '0 0 auto' : '0 0 38%' }}>
      {steps.map((s, i) => (
        <StepItem key={i} n={i + 1} text={s} delay={Math.round(fps * 0.3) + i * every} primary={primary} />
      ))}
    </ol>
  );
  return (
    <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', gap: 32 * u, width: '100%', height: '100%', justifyContent: 'center' }}>
      {list}
      {screenshot ? <Screenshot src={screenshot} highlights={highlights} primary={primary} top={portrait} /> : null}
    </div>
  );
}

function StepItem({ n, text, delay, primary }: { n: number; text: string; delay: number; primary: string }) {
  const { u } = useUnit();
  return (
    <li style={{ ...useEnter(delay), display: 'flex', gap: 16 * u, alignItems: 'center', fontSize: 26 * u }}>
      <span style={{ flex: `0 0 ${44 * u}px`, height: 44 * u, borderRadius: '50%', background: primary, display: 'grid', placeItems: 'center', fontWeight: 800 }}>{n}</span>
      <span>{text}</span>
    </li>
  );
}

function Result({ description, screenshot, highlights, primary }: { description: string; screenshot: string; highlights: (Highlight | HighlightRef)[]; primary: string }) {
  const { u, portrait } = useUnit();
  return (
    <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', alignItems: 'center', gap: 32 * u, width: '100%', height: '100%', justifyContent: 'center' }}>
      <div style={{ ...useEnter(6), flex: portrait ? '0 0 auto' : '0 0 32%', display: 'flex', gap: 14 * u, alignItems: 'flex-start', fontSize: 26 * u }}>
        <span style={{ color: '#22c55e', fontSize: 40 * u, lineHeight: 1 }}>✔</span>
        <span>{description}</span>
      </div>
      <Screenshot src={screenshot} highlights={highlights} primary={primary} top={portrait} />
    </div>
  );
}

function Outro({ title, mistakes, conclusion, primary }: { title: string; mistakes: string[]; conclusion: string; primary: string }) {
  const { u } = useUnit();
  const [e0, e1, e2] = [useEnter(0), useEnter(6), useEnter(14)];
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: `${60 * u}px ${80 * u}px ${120 * u}px`, gap: 28 * u }}>
      <div style={{ ...e0, fontSize: 44 * u, fontWeight: 800 }}>{title}</div>
      {mistakes.length ? (
        <div style={e1}>
          <div style={{ fontSize: 18 * u, color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 * u, marginBottom: 12 * u }}>Errores frecuentes</div>
          <ul style={{ margin: 0, paddingLeft: 28 * u, fontSize: 24 * u, display: 'flex', flexDirection: 'column', gap: 8 * u }}>
            {mistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div style={{ ...e2, fontSize: 28 * u, borderLeft: `${6 * u}px solid ${primary}`, paddingLeft: 20 * u }}>{conclusion}</div>
    </AbsoluteFill>
  );
}

// ------------------------------------------------------------------ overlays

function Captions({ cues }: { cues: { start: number; end: number; text: string }[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useUnit();
  const t = frame / fps;
  const cue = cues.find((c) => t >= c.start && t < c.end);
  if (!cue) return null;
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 34 * u, pointerEvents: 'none' }}>
      <div style={{ maxWidth: '86%', background: 'rgb(0 0 0 / 0.78)', color: '#fff', fontSize: 26 * u, lineHeight: 1.35, padding: `${8 * u}px ${18 * u}px`, borderRadius: 8 * u, textAlign: 'center' }}>{cue.text}</div>
    </AbsoluteFill>
  );
}

function ProgressBar({ color }: { color: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return <div style={{ position: 'absolute', left: 0, bottom: 0, height: 5, width: `${(frame / Math.max(1, durationInFrames - 1)) * 100}%`, background: color }} />;
}

function DraftMark() {
  const { u } = useUnit();
  return (
    <div style={{ position: 'absolute', top: 16 * u, right: 16 * u, padding: `${4 * u}px ${12 * u}px`, borderRadius: 6 * u, background: '#f59e0b', color: '#1c1917', fontWeight: 800, fontSize: 16 * u, letterSpacing: 1 * u }}>
      BORRADOR · procedimiento no verificado
    </div>
  );
}
