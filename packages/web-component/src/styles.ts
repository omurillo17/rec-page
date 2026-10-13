/** Shadow DOM styles. Theme with CSS custom properties on the host, e.g. seventeen-training { --st-primary: #0f766e }. */
export const styles = /* css */ `
:host { --st-primary: #2563eb; --st-text: #0f172a; --st-muted: #64748b; --st-bg: #fff; --st-surface: #f1f5f9; --st-border: #e2e8f0; --st-radius: 10px;
  display: inline-block; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--st-text); }
@media (prefers-color-scheme: dark) { :host(:not([theme="light"])) { --st-text: #e2e8f0; --st-muted: #94a3b8; --st-bg: #0f172a; --st-surface: #1e293b; --st-border: #334155; } }
* { box-sizing: border-box; }
button { font: inherit; cursor: pointer; }
button:focus-visible, select:focus-visible, summary:focus-visible { outline: 3px solid var(--st-primary); outline-offset: 2px; }
.trigger { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--st-border); border-radius: 999px; background: var(--st-bg); color: var(--st-text); }
.trigger .icon { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--st-primary); color: #fff; font-weight: 700; font-size: 0.8rem; }
dialog { width: min(1040px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; border: 1px solid var(--st-border); border-radius: var(--st-radius); background: var(--st-bg); color: var(--st-text); }
dialog::backdrop { background: rgb(15 23 42 / 0.55); }
header { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--st-border); background: var(--st-bg); }
h2 { margin: 0; font-size: 1.15rem; }
h3 { margin: 18px 0 10px; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--st-muted); }
.body { padding: 4px 20px 20px; }
.icon-btn { border: 0; background: none; color: inherit; font-size: 1.1rem; padding: 6px 10px; border-radius: 6px; }
.icon-btn:hover { background: var(--st-surface); }
.muted { color: var(--st-muted); }
.error { padding: 12px; border-radius: 8px; background: #fee2e2; color: #7f1d1d; }
ul, ol { list-style: none; margin: 0; padding: 0; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.card { display: flex; flex-direction: column; gap: 6px; width: 100%; height: 100%; padding: 0 0 12px; border: 1px solid var(--st-border); border-radius: var(--st-radius); background: var(--st-bg); color: inherit; text-align: left; overflow: hidden; }
.card:hover { border-color: var(--st-primary); }
.card img, .poster-placeholder { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: var(--st-surface); display: grid; place-items: center; font-size: 2rem; color: var(--st-muted); }
.card-title { padding: 0 12px; font-weight: 600; }
.card-desc { padding: 0 12px; font-size: 0.9rem; color: var(--st-muted); }
.badge { margin: auto 12px 0; align-self: flex-start; padding: 2px 8px; border-radius: 999px; background: var(--st-surface); font-size: 0.8rem; }
.tours { display: flex; flex-wrap: wrap; gap: 10px; }
.primary { padding: 8px 14px; border: 0; border-radius: 8px; background: var(--st-primary); color: #fff; font-weight: 600; }
.primary:hover { filter: brightness(1.08); }
.link { border: 0; background: none; color: var(--st-primary); padding: 8px 0; text-align: left; }
.player { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: 20px; }
video { width: 100%; border-radius: 8px; background: #000; aspect-ratio: 16 / 9; }
.controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
select { font: inherit; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--st-border); background: var(--st-bg); color: inherit; }
.a11y { display: flex; flex-wrap: wrap; gap: 6px; }
.a11y li { padding: 2px 8px; border-radius: 999px; background: var(--st-surface); font-size: 0.8rem; }
aside > :first-child, aside > :first-child h3 { margin-top: 0; }
aside > section, aside > details { margin-bottom: 18px; }
.chapters button, .transcript button { display: block; width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; background: none; color: inherit; text-align: left; font-size: 0.9rem; }
.chapters button:hover, .transcript button:hover { background: var(--st-surface); }
.chapters button[aria-current], .transcript button[aria-current] { background: color-mix(in srgb, var(--st-primary) 15%, transparent); }
.time { font-variant-numeric: tabular-nums; color: var(--st-muted); }
.transcript-box { margin-top: 16px; }
.transcript-box summary { cursor: pointer; font-weight: 600; }
.transcript { max-height: 260px; overflow: auto; margin-top: 8px; }
.recs li { border-top: 1px solid var(--st-border); }
@media (max-width: 720px) {
  dialog { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; margin: 0; border-radius: 0; }
  .player { grid-template-columns: 1fr; }
  /* Visually hidden, still the accessible name of the button. */
  .trigger .label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .trigger { padding: 6px; }
}
`;
