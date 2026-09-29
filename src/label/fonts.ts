/**
 * Canvas fonts for the label. The canvas silently falls back to a system font if a face
 * isn't loaded yet, so every family/weight/width is awaited before drawing.
 * Widths map to font-stretch keywords: expanded = wdth 125, extra-condensed = 62.5,
 * condensed = 75.
 */
import type { LabelStyle } from '../lib/brand';

export const ARCHIVO = '"Archivo Variable"';
export const FRAUNCES = '"Fraunces Variable"';

export interface FontSpec {
  weight: number;
  stretch: 'normal' | 'expanded' | 'extra-condensed' | 'condensed' | 'semi-condensed';
  family: string;
  fallback: string;
}

export const FONTS = {
  wide: { weight: 900, stretch: 'expanded', family: ARCHIVO, fallback: 'sans-serif' },
  tall: { weight: 900, stretch: 'extra-condensed', family: ARCHIVO, fallback: 'sans-serif' },
  classic: { weight: 800, stretch: 'normal', family: FRAUNCES, fallback: 'serif' },
  small: { weight: 560, stretch: 'condensed', family: ARCHIVO, fallback: 'sans-serif' },
  smallBold: { weight: 760, stretch: 'condensed', family: ARCHIVO, fallback: 'sans-serif' },
  mark: { weight: 700, stretch: 'normal', family: ARCHIVO, fallback: 'sans-serif' },
} satisfies Record<string, FontSpec>;

export const fontFor = (style: LabelStyle): FontSpec => FONTS[style];

export function fontString(f: FontSpec, px: number): string {
  const stretch = f.stretch === 'normal' ? '' : `${f.stretch} `;
  return `${f.weight} ${stretch}${px}px ${f.family}, ${f.fallback}`;
}

type StretchCtx = CanvasRenderingContext2D & { fontStretch?: string };

/**
 * Sets a font including its width. Browsers that reject stretch keywords in the font
 * shorthand keep the previous font, so fall back to the fontStretch property.
 */
export function setFont(ctx: CanvasRenderingContext2D, f: FontSpec, px: number): void {
  const c = ctx as StretchCtx;
  if ('fontStretch' in c) c.fontStretch = 'normal';
  const want = fontString(f, px);
  c.font = want;
  if (f.stretch !== 'normal' && !c.font.includes(f.stretch) && 'fontStretch' in c) {
    c.font = `${f.weight} ${px}px ${f.family}, ${f.fallback}`;
    c.fontStretch = f.stretch;
  }
}

let frauncesCss: Promise<unknown> | null = null;
const loaded = new Map<string, Promise<void>>();

function loadFace(f: FontSpec): Promise<void> {
  const key = fontString(f, 64);
  let p = loaded.get(key);
  if (!p) {
    p = document.fonts
      .load(key, 'AZaz09')
      .then(() => undefined)
      .catch(() => undefined);
    loaded.set(key, p);
  }
  return p;
}

/** Loads every face the label needs for a style; Fraunces only when "Classic" is used. */
export async function ensureLabelFonts(style: LabelStyle): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  if (style === 'classic' && !frauncesCss) {
    frauncesCss = import('@fontsource-variable/fraunces/wght.css');
  }
  if (style === 'classic') await frauncesCss;
  await Promise.all([
    loadFace(fontFor(style)),
    loadFace(FONTS.wide),
    loadFace(FONTS.small),
    loadFace(FONTS.smallBold),
  ]);
}
