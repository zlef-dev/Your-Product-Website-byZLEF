/**
 * A decorative barcode generated from the brand name. It looks like an EAN-13 (guards,
 * 7-module digits, 13 digits underneath) but its check digit is deliberately wrong, so it
 * can never scan as a real product.
 */

export interface Barcode {
  /** Alternating bar and space widths in modules, starting with a bar. */
  modules: number[];
  digits: string;
}

/** FNV-1a, 32-bit. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny deterministic PRNG. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The real EAN-13 check digit for 12 digits. */
export function eanCheckDigit(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(twelve[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(digits: string): boolean {
  return /^\d{13}$/.test(digits) && eanCheckDigit(digits.slice(0, 12)) === Number(digits[12]);
}

/** Four element widths (bar, space, bar, space) of 1–4 modules that sum to 7. */
function digitPattern(rand: () => number): number[] {
  for (;;) {
    const a = 1 + Math.floor(rand() * 3);
    const b = 1 + Math.floor(rand() * 3);
    const c = 1 + Math.floor(rand() * 3);
    const d = 7 - a - b - c;
    if (d >= 1 && d <= 4) return [a, b, c, d];
  }
}

export function barcodeFor(name: string): Barcode {
  const rand = prng(hashString(name.trim().toLowerCase() || 'white label'));
  let twelve = '';
  for (let i = 0; i < 12; i++) twelve += String(Math.floor(rand() * 10));
  const wrong = (eanCheckDigit(twelve) + 1 + Math.floor(rand() * 9)) % 10;
  const modules: number[] = [1, 1, 1];
  for (let i = 0; i < 6; i++) modules.push(...digitPattern(rand));
  // Centre guard: space, bar, space, bar, space.
  modules.push(1, 1, 1, 1, 1);
  for (let i = 0; i < 6; i++) modules.push(...digitPattern(rand));
  modules.push(1, 1, 1);
  return { modules, digits: `${twelve}${wrong}` };
}
