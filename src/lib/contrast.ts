/** WCAG 2.x contrast helpers. */

export const PAPER = '#F1F2EE';
export const PROCESS_K = '#231F20';
export const WHITE = '#FFFFFF';

export type RGB = [number, number, number];

/** Accepts #rgb or #rrggbb (any case). Returns uppercase #RRGGBB, or null if invalid. */
export function normaliseHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!m || !m[1]) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${h.toUpperCase()}`;
}

export function hexToRgb(hex: string): RGB {
  const h = normaliseHex(hex) ?? PROCESS_K;
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The ink that sits on a label colour: white or process black, whichever passes
 * WCAG AA (4.5:1). If both pass, the higher contrast wins; if neither does, the
 * higher contrast still wins so text stays as legible as possible.
 */
export function pickInk(bg: string): typeof WHITE | typeof PROCESS_K {
  const w = contrastRatio(bg, WHITE);
  const k = contrastRatio(bg, PROCESS_K);
  if (w >= 4.5 && k < 4.5) return WHITE;
  if (k >= 4.5 && w < 4.5) return PROCESS_K;
  return w >= k ? WHITE : PROCESS_K;
}

/** Brand colour when it reads on paper at the given ratio, otherwise process black. */
export function onPaper(brand: string, ratio: number): string {
  return contrastRatio(brand, PAPER) >= ratio ? (normaliseHex(brand) ?? PROCESS_K) : PROCESS_K;
}

/** Mixes two hex colours in sRGB. t = 0 → a, t = 1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex([ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t]);
}
