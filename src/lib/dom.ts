/** Small DOM helpers. */

export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(sel);
}

export function $$<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

export const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(reducedMotionQuery).matches;
}

/** Wide compositions: desktop, or short landscape phones. Mirrors the CSS breakpoints. */
export const wideQuery = '(min-width: 1024px), (orientation: landscape) and (max-height: 560px)';

export function isWide(): boolean {
  return matchMedia(wideQuery).matches;
}

export function finePointer(): boolean {
  return matchMedia('(hover: hover) and (pointer: fine)').matches;
}

type ScrollImpl = (target: HTMLElement, onDone?: () => void) => void;

let scrollImpl: ScrollImpl = (target, onDone) => {
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  if (onDone) setTimeout(onDone, prefersReducedMotion() ? 0 : 600);
};

/** The director swaps in Lenis once smooth scrolling is running. */
export function setScrollImpl(impl: ScrollImpl): void {
  scrollImpl = impl;
}

export function scrollToElement(target: HTMLElement, onDone?: () => void): void {
  scrollImpl(target, onDone);
}

/** Resolves on the next idle period (or a timeout where requestIdleCallback is missing). */
export function idle(timeout = 1200): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 60);
  });
}

export const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

/** Warnings meant for the site owner, printed in development builds only. */
export function devWarn(message: string): void {
  if (import.meta.env.DEV) console.warn(`[site] ${message}`);
}
