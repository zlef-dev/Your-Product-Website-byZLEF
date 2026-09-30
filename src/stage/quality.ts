/**
 * Quality tiers. Heuristics pick a starting tier; the render loop steps down at runtime
 * when the average frame time stays above 20 ms for a second.
 */
export type Tier = 'high' | 'medium' | 'low';

export interface TierSettings {
  dpr: number;
  antialias: boolean;
  sleeveWidth: number;
  radialSegments: number;
  latheSegments: number;
  transmission: boolean;
  particles: number;
}

export const TIERS: Record<Tier, TierSettings> = {
  high: {
    dpr: 2,
    antialias: true,
    sleeveWidth: 2048,
    radialSegments: 128,
    latheSegments: 96,
    transmission: true,
    particles: 200,
  },
  medium: {
    dpr: 1.5,
    antialias: true,
    sleeveWidth: 2048,
    radialSegments: 96,
    latheSegments: 72,
    transmission: false,
    particles: 120,
  },
  low: {
    dpr: 1,
    antialias: false,
    sleeveWidth: 1024,
    radialSegments: 64,
    latheSegments: 48,
    transmission: false,
    particles: 80,
  },
};

export const lower = (t: Tier): Tier => (t === 'high' ? 'medium' : 'low');

/** Starting tier from what the browser tells us about the device. */
export function detectTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 500;
  if (cores <= 2 || memory <= 2) return 'low';
  if (coarse || small) return cores >= 8 && memory >= 6 ? 'medium' : 'low';
  if (cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}

/** Software rasterisers (SwiftShader, llvmpipe) can't keep up with the high tier. */
export function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

/**
 * Tracks frame times and reports when the tier should step down: a typical frame over a
 * window (one second) takes longer than the budget (20 ms). "Typical" is the median, so
 * single stalls (a shader compile, a big texture upload) never downgrade the scene, while
 * sustained slowness, from 25 ms frames to a steady 10 fps, always does.
 */
export class FrameMonitor {
  private samples: number[] = [];
  private since = 0;

  constructor(
    private readonly budgetMs = 20,
    private readonly windowMs = 1000,
    private readonly minSamples = 6,
  ) {}

  /** Returns true when the median frame time over the last window exceeds the budget. */
  push(dtMs: number, now: number): boolean {
    if (dtMs > 250) {
      // A long gap is a hidden tab or a pause, not a slow frame.
      this.reset(now);
      return false;
    }
    if (!this.since) this.since = now;
    this.samples.push(dtMs);
    if (now - this.since < this.windowMs) return false;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const enough = sorted.length >= this.minSamples;
    this.reset(now);
    return enough && median > this.budgetMs;
  }

  reset(now = 0): void {
    this.samples = [];
    this.since = now;
  }
}
