import { describe, expect, it } from 'vitest';
import { barcodeFor, eanCheckDigit, isValidEan13 } from '../../src/label/barcode';
import { allocatePlates, INKS, rgbToCmyk, separate } from '../../src/label/cmyk';
import { fitText, type Measure } from '../../src/label/fit';

/** A monospace stand-in for canvas measureText: every character is 0.6 em wide. */
const mono: Measure = (text, size) => text.length * size * 0.6;

describe('fitText', () => {
  it('keeps a short name on one line and fills the width', () => {
    const r = fitText('ACME', 600, 400, mono, { lineHeight: 0.9, maxLines: 2 });
    expect(r.lines).toEqual(['ACME']);
    expect(r.size).toBeCloseTo(600 / (4 * 0.6), 1);
  });

  it('caps the size by height', () => {
    const r = fitText('A', 1000, 100, mono, { lineHeight: 0.9, maxLines: 2 });
    expect(r.size).toBeCloseTo(100 / 0.9, 1);
  });

  it('wraps a long multi-word name onto two lines when that sets it larger', () => {
    const r = fitText('KOPI KALYE ROASTERS', 500, 500, mono, { lineHeight: 0.9, maxLines: 2 });
    expect(r.lines).toHaveLength(2);
    const oneLine = 500 / ('KOPI KALYE ROASTERS'.length * 0.6);
    expect(r.size).toBeGreaterThan(oneLine);
  });

  it('chooses the most balanced break', () => {
    const r = fitText('AAAA BB CCCCCC', 300, 1000, mono, { lineHeight: 1, maxLines: 2 });
    expect(r.lines).toEqual(['AAAA BB', 'CCCCCC']);
  });

  it('never exceeds the box', () => {
    const names = ['X', 'Kopi Kalye', 'A very long brand name indeed', 'Supercalifragilisticexpialidoc'];
    for (const name of names) {
      const r = fitText(name, 420, 260, mono, { lineHeight: 0.9, maxLines: 3 });
      const widest = Math.max(...r.lines.map((l) => mono(l, r.size)));
      expect(widest).toBeLessThanOrEqual(420 + 0.5);
      expect(r.lines.length * r.size * 0.9).toBeLessThanOrEqual(260 + 0.5);
    }
  });

  it('keeps a 32-character name without spaces on one line', () => {
    const r = fitText('A'.repeat(32), 600, 400, mono, { lineHeight: 0.9, maxLines: 2 });
    expect(r.lines).toHaveLength(1);
    expect(r.size).toBeGreaterThan(0);
  });

  it('returns nothing for empty text', () => {
    expect(fitText('   ', 100, 100, mono, { lineHeight: 1, maxLines: 2 })).toEqual({ lines: [], size: 0 });
  });

  it('respects maxSize', () => {
    const r = fitText('A', 1000, 1000, mono, { lineHeight: 1, maxLines: 1, maxSize: 120 });
    expect(r.size).toBe(120);
  });
});

describe('rgbToCmyk', () => {
  it('maps white to no ink and black to pure K', () => {
    expect(rgbToCmyk(255, 255, 255)).toEqual([0, 0, 0, 0]);
    expect(rgbToCmyk(0, 0, 0)).toEqual([0, 0, 0, 1]);
  });

  it('maps primaries to their complementary inks', () => {
    const [c, m, y, k] = rgbToCmyk(255, 0, 0);
    expect([c, m, y, k]).toEqual([0, 1, 1, 0]);
    expect(rgbToCmyk(0, 255, 255)).toEqual([1, 0, 0, 0]);
  });

  it('pulls grey into K only', () => {
    const [c, m, y, k] = rgbToCmyk(128, 128, 128);
    expect(c).toBe(0);
    expect(m).toBe(0);
    expect(y).toBe(0);
    expect(k).toBeCloseTo(1 - 128 / 255, 5);
  });
});

describe('separate', () => {
  const px = (r: number, g: number, b: number, a = 255) => new Uint8ClampedArray([r, g, b, a]);

  it('leaves every plate white where there is no ink', () => {
    const plates = separate(px(255, 255, 255), allocatePlates(4));
    for (const p of Object.values(plates)) expect(Array.from(p)).toEqual([255, 255, 255, 255]);
  });

  it('prints pure black on the K plate only', () => {
    const plates = separate(px(0, 0, 0), allocatePlates(4));
    expect(Array.from(plates.k)).toEqual([...INKS.k, 255]);
    expect(Array.from(plates.c)).toEqual([255, 255, 255, 255]);
    expect(Array.from(plates.m)).toEqual([255, 255, 255, 255]);
    expect(Array.from(plates.y)).toEqual([255, 255, 255, 255]);
  });

  it('prints a full cyan pixel as the cyan ink colour', () => {
    const plates = separate(px(0, 255, 255), allocatePlates(4));
    expect(Array.from(plates.c)).toEqual([...INKS.c, 255]);
  });

  it('scales coverage by source alpha', () => {
    const plates = separate(px(0, 0, 0, 0), allocatePlates(4));
    expect(Array.from(plates.k)).toEqual([255, 255, 255, 255]);
  });

  it('handles many pixels', () => {
    const src = new Uint8ClampedArray(4 * 1000).fill(200);
    const plates = separate(src, allocatePlates(src.length));
    expect(plates.k.length).toBe(src.length);
  });
});

describe('barcode', () => {
  it('is deterministic for a name', () => {
    expect(barcodeFor('Kopi Kalye')).toEqual(barcodeFor('Kopi Kalye'));
    expect(barcodeFor(' kopi kalye ')).toEqual(barcodeFor('Kopi Kalye'));
  });

  it('differs between names', () => {
    expect(barcodeFor('Acme').digits).not.toBe(barcodeFor('Acne').digits);
  });

  it('looks like EAN-13 but never validates', () => {
    for (const name of ['Acme', 'Kopi Kalye', 'Your brand', 'x', '', 'Supercalifragilistic']) {
      const b = barcodeFor(name);
      expect(b.digits).toMatch(/^\d{13}$/);
      expect(isValidEan13(b.digits)).toBe(false);
      // 3 + 6×4 + 5 + 6×4 + 3 elements, 95 modules, like a real EAN-13.
      expect(b.modules).toHaveLength(59);
      expect(b.modules.reduce((a, c) => a + c, 0)).toBe(95);
    }
  });

  it('computes real EAN-13 check digits', () => {
    expect(eanCheckDigit('400638133393')).toBe(1);
    expect(isValidEan13('4006381333931')).toBe(true);
  });
});
