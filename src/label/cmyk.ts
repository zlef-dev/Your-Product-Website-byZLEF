/**
 * Per-pixel RGB → CMYK separation into four plates. Each plate is an RGBA image of
 * that ink on white paper, so multiplying the four plates together approximates the
 * artwork, which is how the print run composites them.
 * Pure and allocation-free, so the worker and the main-thread fallback share it.
 */

export type RGB = readonly [number, number, number];

export const INKS: Record<'c' | 'm' | 'y' | 'k', RGB> = {
  c: [0, 174, 239],
  m: [236, 0, 140],
  y: [255, 242, 0],
  k: [35, 31, 32],
};

export const PLATE_ORDER = ['c', 'm', 'y', 'k'] as const;
export type PlateName = (typeof PLATE_ORDER)[number];

/** Naive device CMYK with full black generation, each channel 0–1. */
export function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1) return [0, 0, 0, 1];
  const d = 1 - k;
  return [(1 - rr - k) / d, (1 - gg - k) / d, (1 - bb - k) / d, k];
}

export interface Plates {
  c: Uint8ClampedArray;
  m: Uint8ClampedArray;
  y: Uint8ClampedArray;
  k: Uint8ClampedArray;
}

export function allocatePlates(length: number): Plates {
  return {
    c: new Uint8ClampedArray(length),
    m: new Uint8ClampedArray(length),
    y: new Uint8ClampedArray(length),
    k: new Uint8ClampedArray(length),
  };
}

/** Writes the four plates for RGBA `src`. Coverage is premultiplied by source alpha. */
export function separate(src: Uint8ClampedArray, out: Plates): Plates {
  const { c: pc, m: pm, y: py, k: pk } = out;
  const [cr, cg, cb] = INKS.c;
  const [mr, mg, mb] = INKS.m;
  const [yr, yg, yb] = INKS.y;
  const [kr, kg, kb] = INKS.k;
  for (let i = 0; i < src.length; i += 4) {
    const a = (src[i + 3] ?? 255) / 255;
    const rr = (src[i] ?? 0) / 255;
    const gg = (src[i + 1] ?? 0) / 255;
    const bb = (src[i + 2] ?? 0) / 255;
    const max = rr > gg ? (rr > bb ? rr : bb) : gg > bb ? gg : bb;
    const k = 1 - max;
    let c = 0;
    let m = 0;
    let y = 0;
    if (k < 1) {
      const d = 1 - k;
      c = ((1 - rr - k) / d) * a;
      m = ((1 - gg - k) / d) * a;
      y = ((1 - bb - k) / d) * a;
    }
    const kk = k * a;
    pc[i] = 255 - c * (255 - cr);
    pc[i + 1] = 255 - c * (255 - cg);
    pc[i + 2] = 255 - c * (255 - cb);
    pc[i + 3] = 255;
    pm[i] = 255 - m * (255 - mr);
    pm[i + 1] = 255 - m * (255 - mg);
    pm[i + 2] = 255 - m * (255 - mb);
    pm[i + 3] = 255;
    py[i] = 255 - y * (255 - yr);
    py[i + 1] = 255 - y * (255 - yg);
    py[i + 2] = 255 - y * (255 - yb);
    py[i + 3] = 255;
    pk[i] = 255 - kk * (255 - kr);
    pk[i + 1] = 255 - kk * (255 - kg);
    pk[i + 2] = 255 - kk * (255 - kb);
    pk[i + 3] = 255;
  }
  return out;
}
