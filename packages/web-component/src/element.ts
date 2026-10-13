import {
  formatDuration,
  formatTimestamp,
  loadManifest,
  loadTour,
  parseVtt,
  recommend,
  resolveAsset,
  selectContent,
  type Cue,
  type LoadedManifest,
  type TourRef,
  type Tutorial,
} from '@seventeen-training/core';
import { startTour, type TourResult } from './tour.js';
import { styles } from './styles.js';

type Child = Node | string | null | undefined | false;

/** Tiny DOM builder. Text always goes through textContent: manifest strings are never parsed as HTML. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined | ((e: Event) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (typeof v === 'string') el.setAttribute(k, v);
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

// Lets the module be imported during SSR (Next.js) without crashing; it only does work in a browser.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

/**
 * <seventeen-training manifest="/training/manifest.json" module="clientes"></seventeen-training>
 *
 * Attributes:
 *  - manifest (required): URL of the app's manifest. Serve it from a protected route if content is private.
 *  - module: module id to show. Without it, all modules are listed.
 *  - app-version: host UI version; tours are disabled when outside manifest.ui.
 *  - roles: comma-separated roles RESOLVED BY THE HOST SERVER. UX filter only, never security.
 *  - include-drafts: show draft/review content (authoring environments only).
 *  - label: button text (default "Ayuda").
 *
 * Events (bubbling, composed): training-open, training-close, training-video-play,
 * training-tour-start, training-tour-end, training-error. None carry user data.
 */
export class SeventeenTrainingElement extends Base {
  static observedAttributes = ['manifest', 'module', 'app-version', 'roles', 'include-drafts', 'label'];

  #root!: ShadowRoot;
  #dialog!: HTMLDialogElement;
  #body!: HTMLElement;
  #title!: HTMLElement;
  #button!: HTMLButtonElement;
  #loaded: Promise<LoadedManifest> | null = null;

  connectedCallback(): void {
    if (this.#root) return;
    this.#root = this.attachShadow({ mode: 'open' });
    this.#button = h(
      'button',
      { part: 'button', class: 'trigger', type: 'button', 'aria-haspopup': 'dialog', onclick: () => void this.open() },
      h('span', { class: 'icon', 'aria-hidden': 'true' }, '?'),
      h('span', { class: 'label' }),
    );
    this.#title = h('h2', { id: 'st-title' });
    this.#body = h('div', { class: 'body' });
    this.#dialog = h(
      'dialog',
      { part: 'dialog', 'aria-labelledby': 'st-title', onclose: () => this.#onClose() },
      h(
        'header',
        {},
        this.#title,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar capacitación', onclick: () => this.close() }, '✕'),
      ),
      this.#body,
    );
    // Click on the backdrop closes the dialog.
    this.#dialog.addEventListener('click', (e) => e.target === this.#dialog && this.close());
    const style = h('style');
    style.textContent = styles;
    this.#root.append(style, this.#button, this.#dialog);
    this.#renderLabel();
  }

  attributeChangedCallback(name: string): void {
    if (name === 'manifest') this.#loaded = null;
    if (name === 'label') this.#renderLabel();
  }

  get #opts() {
    return {
      module: this.getAttribute('module') ?? undefined,
      appVersion: this.getAttribute('app-version') ?? undefined,
      roles: (this.getAttribute('roles') ?? '').split(',').map((r) => r.trim()).filter(Boolean),
      includeDrafts: this.hasAttribute('include-drafts'),
    };
  }

  #renderLabel(): void {
    const label = this.#button?.querySelector('.label');
    if (label) label.textContent = this.getAttribute('label') ?? 'Ayuda';
  }

  #emit(type: string, detail: unknown = {}): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  #load(): Promise<LoadedManifest> {
    const url = this.getAttribute('manifest');
    if (!url) return Promise.reject(new Error('Falta el atributo "manifest"'));
    this.#loaded ??= loadManifest(url);
    this.#loaded.catch(() => (this.#loaded = null)); // allow retry
    return this.#loaded;
  }

  /** Force a fresh manifest fetch on next open (e.g. after the host changed the user's permissions). */
  reload(): void {
    this.#loaded = null;
  }

  async open(): Promise<void> {
    if (!this.#dialog.open) {
      this.#dialog.showModal();
      this.#emit('training-open', { module: this.#opts.module });
    }
    await this.#withContent((lm) => this.#renderList(lm));
  }

  async openTutorial(id: string): Promise<void> {
    if (!this.#dialog.open) this.#dialog.showModal();
    await this.#withContent((lm) => {
      const t = lm.manifest.tutorials.find((x) => x.id === id);
      const visible = t && selectContent(lm.manifest, { ...this.#opts, module: undefined }).tutorials.includes(t);
      if (!visible) throw new Error(`Tutorial no disponible: ${id}`);
      this.#renderPlayer(lm, t!);
    });
  }

  close(): void {
    if (this.#dialog?.open) this.#dialog.close();
  }

  /** Start a tour by id. Closes the dialog first so the page is visible. */
  async startTour(id: string): Promise<TourResult | undefined> {
    try {
      const lm = await this.#load();
      const ref = selectContent(lm.manifest, { ...this.#opts, module: undefined }).tours.find((t) => t.id === id);
      if (!ref) throw new Error(`Recorrido no disponible: ${id}`);
      const tour = await loadTour(ref, lm.baseUrl);
      this.close();
      this.#emit('training-tour-start', { tourId: id });
      const result = await startTour(tour);
      this.#emit('training-tour-end', result);
      return result;
    } catch (err) {
      this.#fail(err);
      return undefined;
    }
  }

  #onClose(): void {
    this.#root.querySelectorAll('video').forEach((v) => v.pause());
    this.#emit('training-close');
    this.#button.focus();
  }

  async #withContent(render: (lm: LoadedManifest) => void): Promise<void> {
    this.#body.replaceChildren(h('p', { class: 'muted', role: 'status' }, 'Cargando capacitación…'));
    try {
      render(await this.#load());
    } catch (err) {
      this.#fail(err);
      this.#body.replaceChildren(
        h('p', { class: 'error', role: 'alert' }, 'No se pudo cargar la capacitación. La aplicación sigue funcionando con normalidad.'),
      );
    }
  }

  #fail(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[seventeen-training]', message);
    this.#emit('training-error', { message });
  }

  // ------------------------------------------------------------------ views

  #renderList(lm: LoadedManifest): void {
    const { manifest, baseUrl } = lm;
    const opts = this.#opts;
    const mod = manifest.modules.find((m) => m.id === opts.module);
    this.#title.textContent = mod ? `Capacitación · ${mod.title}` : 'Capacitación';
    const { tutorials, tours, toursEnabled } = selectContent(manifest, opts);

    const videoList = h('ul', { class: 'cards' });
    for (const t of tutorials) {
      videoList.append(
        h(
          'li',
          {},
          h(
            'button',
            { class: 'card', type: 'button', onclick: () => this.#renderPlayer(lm, t) },
            t.video.poster
              ? h('img', { src: resolveAsset(baseUrl, t.video.poster), alt: '', loading: 'lazy' })
              : h('div', { class: 'poster-placeholder', 'aria-hidden': 'true' }, '▶'),
            h('span', { class: 'card-title' }, t.title),
            h('span', { class: 'card-desc' }, t.description),
            h('span', { class: 'badge' }, `Video · ${formatDuration(t.video.durationSec)}`),
          ),
        ),
      );
    }

    const tourList = h('ul', { class: 'tours' });
    for (const ref of tours) tourList.append(h('li', {}, this.#tourButton(ref)));

    this.#body.replaceChildren(
      h('section', { 'aria-label': 'Videotutoriales' }, h('h3', {}, 'Videotutoriales'), tutorials.length ? videoList : h('p', { class: 'muted' }, 'No hay videos para este módulo.')),
      h(
        'section',
        { 'aria-label': 'Recorridos interactivos' },
        h('h3', {}, 'Recorridos interactivos'),
        tours.length
          ? tourList
          : h('p', { class: 'muted' }, toursEnabled ? 'No hay recorridos para este módulo.' : 'Los recorridos no están disponibles para esta versión de la aplicación.'),
      ),
    );
  }

  #tourButton(ref: TourRef, label = `Iniciar recorrido: ${ref.title}`): HTMLButtonElement {
    return h('button', { class: 'primary', type: 'button', onclick: () => void this.startTour(ref.id) }, label);
  }

  #renderPlayer(lm: LoadedManifest, t: Tutorial): void {
    const { manifest, baseUrl } = lm;
    const opts = this.#opts;
    const all = selectContent(manifest, { ...opts, module: undefined });
    this.#title.textContent = t.title;
    const v = t.video;

    const video = h('video', {
      controls: true,
      preload: 'metadata',
      playsinline: true,
      poster: v.poster ? resolveAsset(baseUrl, v.poster) : undefined,
      'aria-label': `Video: ${t.title}`,
      onplay: () => this.#emit('training-video-play', { tutorialId: t.id }),
    });
    video.append(h('source', { src: resolveAsset(baseUrl, v.src), type: v.type }));
    v.captions.forEach((c, i) =>
      video.append(
        h('track', {
          kind: c.kind,
          src: resolveAsset(baseUrl, c.src),
          srclang: c.srclang,
          label: c.label,
          default: c.default ?? i === 0,
        }),
      ),
    );

    const speed = h(
      'select',
      { 'aria-label': 'Velocidad de reproducción', onchange: (e) => (video.playbackRate = Number((e.target as HTMLSelectElement).value)) },
      ...SPEEDS.map((s) => h('option', { value: String(s), selected: s === 1 }, `${s}×`)),
    );

    const chapters = h('ol', { class: 'chapters' });
    for (const c of v.chapters) {
      chapters.append(
        h('li', {}, h('button', { type: 'button', 'data-start': String(c.startSec), onclick: () => this.#seek(video, c.startSec) }, h('span', { class: 'time' }, formatDuration(c.startSec)), ` ${c.title}`)),
      );
    }

    const transcript = h('ol', { class: 'transcript', 'aria-live': 'off' });
    const track = v.captions.find((c) => c.default) ?? v.captions[0];
    if (track) void this.#loadTranscript(resolveAsset(baseUrl, track.src), transcript, video);

    video.addEventListener('timeupdate', () => {
      const now = video.currentTime;
      for (const list of [chapters, transcript]) {
        const items = [...list.querySelectorAll<HTMLButtonElement>('button[data-start]')];
        const active = items.filter((b) => Number(b.dataset.start) <= now).pop();
        items.forEach((b) => (b === active ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
      }
    });

    const tourRef = t.tourId ? all.tours.find((x) => x.id === t.tourId) : undefined;
    const recs = recommend(t, all.tutorials);

    const a11y = [
      v.captions.length ? `Subtítulos: ${v.captions.map((c) => c.label).join(', ')}` : 'Sin subtítulos',
      track ? 'Transcripción disponible' : null,
      `Duración ${formatDuration(v.durationSec)}`,
    ].filter(Boolean) as string[];

    this.#body.replaceChildren(
      h('button', { class: 'link', type: 'button', onclick: () => this.#renderList(lm) }, '← Volver a la lista'),
      h(
        'div',
        { class: 'player' },
        h(
          'div',
          { class: 'main' },
          video,
          h('div', { class: 'controls' }, h('label', {}, 'Velocidad ', speed), tourRef ? this.#tourButton(tourRef, 'Practicar con recorrido guiado') : null),
          h('p', {}, t.description),
          h('ul', { class: 'a11y', 'aria-label': 'Accesibilidad' }, ...a11y.map((x) => h('li', {}, x))),
          t.accessibilityNotes ? h('p', { class: 'muted' }, t.accessibilityNotes) : null,
        ),
        h(
          'aside',
          {},
          v.chapters.length ? h('section', {}, h('h3', {}, 'Capítulos'), chapters) : null,
          track ? h('details', { class: 'transcript-box' }, h('summary', {}, 'Transcripción'), transcript) : null,
          recs.length
            ? h(
                'section',
                {},
                h('h3', {}, 'También te puede servir'),
                h('ul', { class: 'recs' }, ...recs.map((r) => h('li', {}, h('button', { type: 'button', class: 'link', onclick: () => this.#renderPlayer(lm, r) }, r.title)))),
              )
            : null,
        ),
      ),
    );
  }

  #seek(video: HTMLVideoElement, sec: number): void {
    video.currentTime = sec;
    void video.play().catch(() => {});
  }

  async #loadTranscript(url: string, list: HTMLOListElement, video: HTMLVideoElement): Promise<void> {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cues: Cue[] = parseVtt(await res.text());
      list.replaceChildren(
        ...cues.map((c) =>
          h('li', {}, h('button', { type: 'button', 'data-start': String(c.start), onclick: () => this.#seek(video, c.start) }, h('span', { class: 'time' }, formatTimestamp(c.start).slice(3, 8)), ` ${c.text}`)),
        ),
      );
    } catch (err) {
      list.replaceChildren(h('li', { class: 'muted' }, 'Transcripción no disponible.'));
      this.#fail(err);
    }
  }
}
