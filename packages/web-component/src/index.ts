import { SeventeenTrainingElement } from './element.js';

export { SeventeenTrainingElement } from './element.js';
export { startTour, toDriveSteps, isValidSelector, defaultTourLabels, type TourLabels, type TourResult } from './tour.js';
export * from '@seventeen-training/core';

export const TAG_NAME = 'seventeen-training';

/** Registers <seventeen-training>. Safe to call more than once and on the server (no-op). */
export function defineTrainingElement(tag = TAG_NAME): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, SeventeenTrainingElement);
  }
}

defineTrainingElement();

declare global {
  interface HTMLElementTagNameMap {
    'seventeen-training': SeventeenTrainingElement;
  }
}
