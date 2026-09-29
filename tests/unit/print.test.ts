import { describe, expect, it } from 'vitest';
import { printFrame } from '../../src/label/print-run';
import { cubicBezier, glide, press, span } from '../../src/lib/ease';

describe('easing', () => {
  it('hits both ends', () => {
    for (const ease of [press, glide, cubicBezier(0.25, 0.1, 0.25, 1)]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
    }
  });

  it('matches the linear curve', () => {
    const linear = cubicBezier(0, 0, 1, 1);
    for (const t of [0.1, 0.37, 0.5, 0.92]) expect(linear(t)).toBeCloseTo(t, 4);
  });

  it('is monotonic', () => {
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      const v = press(t);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it('clamps spans', () => {
    expect(span(0.5, 0.4, 0.6)).toBeCloseTo(0.5);
    expect(span(0, 0.4, 0.6)).toBe(0);
    expect(span(1, 0.4, 0.6)).toBe(1);
  });
});

describe('printFrame', () => {
  it('starts with no ink on bare stock', () => {
    const f = printFrame(0, 2048);
    expect(f.alpha).toEqual([0, 0, 0, 0]);
    expect(f.final).toBe(0);
    expect(f.ink).toBe(0);
  });

  it('brings plates in one after another: C, M, Y, then K', () => {
    const f = printFrame(0.2, 2048);
    expect(f.alpha[0]).toBeGreaterThan(f.alpha[1]);
    expect(f.alpha[1]).toBeGreaterThan(0);
    expect(f.alpha[2]).toBe(0);
    expect(f.alpha[3]).toBe(0);
  });

  it('lands every plate 6–12 px out of register before the snap', () => {
    const f = printFrame(0.82, 2048);
    expect(f.alpha).toEqual([1, 1, 1, 1]);
    for (const [dx, dy] of f.offset) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      expect(d).toBeGreaterThanOrEqual(6);
      expect(d).toBeLessThanOrEqual(12);
    }
  });

  it('snaps into register and swaps in the original artwork at the end', () => {
    const f = printFrame(1, 2048);
    expect(f.alpha).toEqual([1, 1, 1, 1]);
    for (const [dx, dy] of f.offset) {
      expect(Math.abs(dx)).toBeLessThan(1e-9);
      expect(Math.abs(dy)).toBeLessThan(1e-9);
    }
    expect(f.final).toBe(1);
    expect(f.ink).toBe(1);
  });

  it('scales offsets with resolution (low tier)', () => {
    const hi = printFrame(0.82, 2048).offset[0]!;
    const lo = printFrame(0.82, 1024).offset[0]!;
    expect(lo[0]).toBeCloseTo(hi[0] / 2, 6);
  });
});
