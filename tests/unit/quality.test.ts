import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectTier, FrameMonitor, lower, TIERS } from '../../src/stage/quality';

/** Feeds `frames` frames of `dt` ms each into the monitor; returns whether it ever asked to step down. */
function run(
  monitor: FrameMonitor,
  frames: number,
  dt: number,
  start = 1000,
): { down: boolean; end: number } {
  let now = start;
  let down = false;
  for (let i = 0; i < frames; i++) {
    now += dt;
    if (monitor.push(dt, now)) down = true;
  }
  return { down, end: now };
}

describe('FrameMonitor', () => {
  it('leaves a healthy 60 fps scene alone', () => {
    expect(run(new FrameMonitor(), 300, 16.7).down).toBe(false);
  });

  it('steps down when frames stay slow for a second', () => {
    expect(run(new FrameMonitor(), 120, 25).down).toBe(true);
  });

  it('steps down for a steady 10 fps too', () => {
    expect(run(new FrameMonitor(), 40, 100).down).toBe(true);
  });

  it('is not fooled by single stalls (a shader compile, a texture upload)', () => {
    const m = new FrameMonitor();
    let now = 1000;
    let down = false;
    for (let i = 0; i < 300; i++) {
      const dt = i % 40 === 0 ? 200 : 16.7;
      now += dt;
      if (m.push(dt, now)) down = true;
    }
    expect(down).toBe(false);
  });

  it('ignores a gap longer than 250 ms (a hidden tab)', () => {
    const m = new FrameMonitor();
    const { end } = run(m, 30, 16.7);
    expect(m.push(4000, end + 4000)).toBe(false);
  });

  it('needs a window of evidence, not one slow frame', () => {
    const m = new FrameMonitor();
    expect(m.push(60, 1060)).toBe(false);
    expect(m.push(60, 1120)).toBe(false);
  });

  it('starts a fresh window after a reset, so old slow frames never count', () => {
    const m = new FrameMonitor();
    const first = run(m, 60, 30);
    expect(first.down).toBe(true);
    m.reset(first.end);
    expect(run(m, 120, 16.7, first.end).down).toBe(false);
  });
});

describe('tiers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('steps high → medium → low and stops', () => {
    expect(lower('high')).toBe('medium');
    expect(lower('medium')).toBe('low');
    expect(lower('low')).toBe('low');
  });

  it('caps device pixel ratio at 2, 1.5 and 1', () => {
    expect([TIERS.high.dpr, TIERS.medium.dpr, TIERS.low.dpr]).toEqual([2, 1.5, 1]);
  });

  it('uses real transmission on the high tier only, and fewer segments and particles below', () => {
    expect([TIERS.high.transmission, TIERS.medium.transmission, TIERS.low.transmission]).toEqual([
      true,
      false,
      false,
    ]);
    expect(TIERS.high.radialSegments).toBe(128);
    expect(TIERS.low.radialSegments).toBe(64);
    expect(TIERS.low.sleeveWidth).toBe(1024);
    expect(TIERS.high.sleeveWidth).toBe(2048);
    expect(TIERS.high.particles).toBe(200);
    expect(TIERS.low.particles).toBeLessThanOrEqual(80);
  });

  it('picks a starting tier from the device', () => {
    const tierFor = (nav: object, coarse: boolean, screenW: number) => {
      vi.stubGlobal('navigator', nav);
      vi.stubGlobal('matchMedia', () => ({ matches: coarse }));
      vi.stubGlobal('screen', { width: screenW, height: 900 });
      return detectTier();
    };
    expect(tierFor({ hardwareConcurrency: 16, deviceMemory: 8 }, false, 1920)).toBe('high');
    expect(tierFor({ hardwareConcurrency: 4, deviceMemory: 8 }, false, 1920)).toBe('medium');
    expect(tierFor({ hardwareConcurrency: 2 }, false, 1920)).toBe('low');
    expect(tierFor({ hardwareConcurrency: 6, deviceMemory: 4 }, true, 390)).toBe('low');
    expect(tierFor({ hardwareConcurrency: 8, deviceMemory: 8 }, true, 390)).toBe('medium');
  });
});
