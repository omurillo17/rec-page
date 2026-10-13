import { driver, type DriveStep } from 'driver.js';
import driverCss from 'driver.js/dist/driver.css?inline';
import type { Tour } from '@seventeen-training/core';

export interface TourLabels {
  next: string;
  prev: string;
  done: string;
  close: string;
  progress: string;
  missing: string;
}

export const defaultTourLabels: TourLabels = {
  next: 'Siguiente',
  prev: 'Anterior',
  done: 'Finalizar',
  close: 'Salir del recorrido',
  progress: 'Paso {{current}} de {{total}}',
  missing: 'Este elemento no está visible en la pantalla actual. Continúa con el siguiente paso.',
};

export interface TourResult {
  tourId: string;
  /** True only when the user reached and confirmed the last step. */
  completed: boolean;
  /** Steps dropped before starting because their selector is not valid CSS. */
  invalidSteps: number[];
}

const THEME_CSS = `
.driver-popover.st-tour { font-family: system-ui, sans-serif; max-width: min(380px, calc(100vw - 24px)); border-radius: 10px; }
.driver-popover.st-tour .driver-popover-title { font-size: 1.05rem; }
.driver-popover.st-tour .driver-popover-footer button { padding: 6px 12px; font-size: 0.9rem; text-shadow: none; border-radius: 6px; }
.driver-popover.st-tour .driver-popover-next-btn { background: var(--st-tour-primary, #2563eb); color: #fff; border-color: transparent; }
.driver-popover.st-tour .st-tour-missing { display: block; margin-top: 8px; padding: 6px 8px; border-radius: 6px; background: #fef3c7; color: #78350f; font-size: 0.85rem; }
@media (prefers-reduced-motion: reduce) { .driver-popover.st-tour, .driver-overlay { transition: none !important; animation: none !important; } }
`;

function injectCss(): void {
  if (document.getElementById('st-driver-css')) return;
  const style = document.createElement('style');
  style.id = 'st-driver-css';
  style.textContent = driverCss + THEME_CSS;
  document.head.append(style);
}

export function isValidSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

/** Map validated tour steps onto Driver.js steps. Invalid selectors are dropped (reported in `invalid`). */
export function toDriveSteps(tour: Tour, labels: TourLabels = defaultTourLabels) {
  const invalid: number[] = [];
  const steps: DriveStep[] = [];
  tour.steps.forEach((s, i) => {
    if (s.element && !isValidSelector(s.element)) {
      invalid.push(i);
      return;
    }
    steps.push({
      element: s.element,
      waitForElement: s.element ? s.waitForMs : 0,
      skipMissingElement: s.optional,
      data: { expectsElement: Boolean(s.element) },
      popover: {
        title: s.title,
        description: s.description,
        side: s.side === 'over' ? undefined : s.side,
        align: s.align,
        onPopoverRender: (popover, { state }) => {
          // Required element missing after waiting: Driver.js shows a centered popover; say why.
          if (state.activeStep?.data?.expectsElement && state.activeElement?.id === 'driver-dummy-element') {
            const note = document.createElement('span');
            note.className = 'st-tour-missing';
            note.textContent = labels.missing;
            popover.description.append(note);
          }
        },
      },
    });
  });
  return { steps, invalid };
}

/**
 * Run an instructive tour with Driver.js. Resolves when the tour is closed or finished.
 * The tour only highlights and explains; it never clicks, submits or changes data.
 */
export function startTour(tour: Tour, labels: Partial<TourLabels> = {}): Promise<TourResult> {
  const l = { ...defaultTourLabels, ...labels };
  const { steps, invalid } = toDriveSteps(tour, l);
  if (invalid.length) console.warn(`[seventeen-training] Recorrido "${tour.id}": selectores inválidos en pasos`, invalid);
  if (!steps.length) return Promise.resolve({ tourId: tour.id, completed: false, invalidSteps: invalid });
  injectCss();

  return new Promise((resolve) => {
    let completed = false;
    const d = driver({
      steps,
      showProgress: true,
      allowClose: true,
      popoverClass: 'st-tour',
      nextBtnText: l.next,
      prevBtnText: l.prev,
      doneBtnText: l.done,
      closeBtnLabel: l.close,
      progressText: l.progress,
      animate: !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      onNextClick: (_el, _step, { driver: drv }) => {
        if (drv.isLastStep()) completed = true;
        drv.moveNext();
      },
      // Driver.js calls onDestroyStarted for every close path (button, Esc, overlay, end of tour,
      // all steps skipped) and onDestroyed only when a step was shown; resolve on either.
      onDestroyStarted: (_el, _step, { driver: drv }) => {
        done();
        drv.destroy();
      },
      onDestroyed: () => done(),
    });
    const done = () => resolve({ tourId: tour.id, completed, invalidSteps: invalid });
    d.drive();
  });
}
