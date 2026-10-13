'use client';
import { createElement, forwardRef, useEffect, useRef, type CSSProperties, type ForwardedRef } from 'react';
import type { SeventeenTrainingElement, TourResult } from '@seventeen-training/web';

export type { SeventeenTrainingElement, TourResult };

export interface TrainingHelpProps {
  /** Manifest URL. Serve it from a route protected by your own auth when content is private. */
  manifest: string;
  module?: string;
  appVersion?: string;
  /** Roles your SERVER resolved for the session. UX filter only — never a security check. */
  roles?: string[];
  includeDrafts?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
  onTourEnd?: (result: TourResult) => void;
  onError?: (message: string) => void;
}

/** Loads and registers the Web Component in the browser only (never during SSR). */
export function loadTrainingElement(): Promise<unknown> {
  return import('@seventeen-training/web');
}

/**
 * Help button + training dialog for a module.
 * SSR renders an inert <seventeen-training> tag; the browser upgrades it after hydration,
 * so the host page never waits for training code.
 */
export const TrainingHelp = forwardRef(function TrainingHelp(
  { manifest, module, appVersion, roles, includeDrafts, label, className, style, onTourEnd, onError }: TrainingHelpProps,
  forwarded: ForwardedRef<SeventeenTrainingElement>,
) {
  const ref = useRef<SeventeenTrainingElement | null>(null);

  useEffect(() => {
    void loadTrainingElement().catch((e) => console.warn('[seventeen-training] no se pudo cargar', e));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tourEnd = (e: Event) => onTourEnd?.((e as CustomEvent<TourResult>).detail);
    const error = (e: Event) => onError?.((e as CustomEvent<{ message: string }>).detail.message);
    el.addEventListener('training-tour-end', tourEnd);
    el.addEventListener('training-error', error);
    return () => {
      el.removeEventListener('training-tour-end', tourEnd);
      el.removeEventListener('training-error', error);
    };
  }, [onTourEnd, onError]);

  return createElement('seventeen-training', {
    ref: (node: SeventeenTrainingElement | null) => {
      ref.current = node;
      if (typeof forwarded === 'function') forwarded(node);
      else if (forwarded) forwarded.current = node;
    },
    manifest,
    module,
    'app-version': appVersion,
    roles: roles?.length ? roles.join(',') : undefined,
    'include-drafts': includeDrafts ? '' : undefined,
    label,
    className,
    style,
  });
});
