import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  mixHex,
  normaliseHex,
  onPaper,
  pickInk,
  PAPER,
  PROCESS_K,
  WHITE,
} from '../../src/lib/contrast';
import { jobNumber, JOB_PATTERN } from '../../src/lib/job';
import { capLength, cleanLine, cleanMultiline, slugify } from '../../src/lib/sanitize';
import { applyUnwrap, peelPoint } from '../../src/stage/unwrap';

describe('contrast', () => {
  it('normalises hex colours', () => {
    expect(normaliseHex('#abc')).toBe('#AABBCC');
    expect(normaliseHex('1b98e0')).toBe('#1B98E0');
    expect(normaliseHex('red')).toBeNull();
    expect(normaliseHex('#12345')).toBeNull();
  });

  it('computes WCAG ratios', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('picks the ink that passes AA on every preset', () => {
    const presets = ['#D7263D', '#F9A620', '#1B98E0', '#3DDC97', '#6B2D5C', '#231F20'];
    for (const hex of presets) {
      const ink = pickInk(hex);
      expect(contrastRatio(hex, ink)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('puts white on dark labels and process black on light ones', () => {
    expect(pickInk('#231F20')).toBe(WHITE);
    expect(pickInk('#6B2D5C')).toBe(WHITE);
    expect(pickInk('#F9A620')).toBe(PROCESS_K);
    expect(pickInk('#3DDC97')).toBe(PROCESS_K);
  });

  it('falls back to the higher contrast when neither ink reaches 4.5:1', () => {
    const mid = '#8A7F80';
    const ink = pickInk(mid);
    expect(ink).toBe(contrastRatio(mid, WHITE) >= contrastRatio(mid, PROCESS_K) ? WHITE : PROCESS_K);
  });

  it('only uses the brand on paper when it is readable', () => {
    expect(onPaper('#F9A620', 4.5)).toBe(PROCESS_K);
    expect(onPaper('#6B2D5C', 4.5)).toBe('#6B2D5C');
    expect(contrastRatio(onPaper('#3DDC97', 3), PAPER)).toBeGreaterThanOrEqual(3);
  });

  it('mixes colours', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixHex('#123456', '#ABCDEF', 0)).toBe('#123456');
  });
});

describe('job numbers', () => {
  it('formats JT-yymmdd-### from the date', () => {
    const d = new Date(2026, 8, 29, 12);
    expect(jobNumber(d, () => 0.123)).toBe('JT-260929-123');
    expect(jobNumber(d, () => 0)).toBe('JT-260929-000');
    expect(jobNumber(d, () => 0.9999)).toBe('JT-260929-999');
  });

  it('matches the pattern with real randomness', () => {
    for (let i = 0; i < 50; i++) expect(jobNumber()).toMatch(JOB_PATTERN);
  });
});

describe('sanitize', () => {
  it('strips control characters and collapses whitespace', () => {
    expect(cleanLine('  Kopi\u0000 \tKalye\n ', 32)).toBe('Kopi Kalye');
    expect(cleanLine('a‮b', 10)).toBe('a b');
  });

  it('caps by code points, never splitting a surrogate pair', () => {
    expect(capLength('ab😀cd', 3)).toBe('ab😀');
    expect(cleanLine('x'.repeat(40), 32)).toHaveLength(32);
  });

  it('keeps line breaks in multi-line text, at most two in a row', () => {
    expect(cleanMultiline('one\r\n\r\n\r\n\r\ntwo\u0007', 100)).toBe('one\n\ntwo');
  });

  it('treats markup as plain text (escaping happens at render via textContent)', () => {
    expect(cleanLine('<img src=x onerror=alert(1)>', 100)).toBe('<img src=x onerror=alert(1)>');
  });

  it('makes safe file names', () => {
    expect(slugify('Kopi Kalye!')).toBe('kopi-kalye');
    expect(slugify('Café Ñandú')).toBe('cafe-nandu');
    expect(slugify('***')).toBe('your-brand');
  });
});

describe('unwrap', () => {
  const r = 0.33;

  it('stays on the cylinder before the peel front arrives', () => {
    const [x, z] = peelPoint(0.5, r, Math.PI);
    expect(x).toBeCloseTo(r * Math.sin(0.5), 6);
    expect(z).toBeCloseTo(r * Math.cos(0.5), 6);
  });

  it('lies flat on the front tangent plane when fully peeled, with no stretch', () => {
    for (const t of [-Math.PI, -1, 0, 1.3, Math.PI]) {
      const [x, z] = peelPoint(t, r, 0);
      expect(x).toBeCloseTo(r * t, 6);
      expect(z).toBeCloseTo(r, 6);
    }
  });

  it('never cuts through the can while peeling', () => {
    for (const phi of [0.3, 1, 2, 2.8]) {
      for (let t = -Math.PI; t <= Math.PI; t += 0.1) {
        const [x, z] = peelPoint(t, r, phi);
        expect(Math.hypot(x, z)).toBeGreaterThanOrEqual(r - 1e-9);
      }
    }
  });

  it('peels the back seam before the front', () => {
    const positions = new Float32Array(2 * 3);
    applyUnwrap(positions, new Float32Array([Math.PI * 0.95, 0.1]), new Float32Array([0.5, 0.5]), r, 0.3, 0);
    const seamOnCylinder = [r * Math.sin(Math.PI * 0.95), r * Math.cos(Math.PI * 0.95)];
    const frontOnCylinder = [r * Math.sin(0.1), r * Math.cos(0.1)];
    const seamMoved = Math.hypot(positions[0]! - seamOnCylinder[0]!, positions[2]! - seamOnCylinder[1]!);
    const frontMoved = Math.hypot(positions[3]! - frontOnCylinder[0]!, positions[5]! - frontOnCylinder[1]!);
    expect(seamMoved).toBeGreaterThan(0.01);
    expect(frontMoved).toBeCloseTo(0, 6);
  });
});
