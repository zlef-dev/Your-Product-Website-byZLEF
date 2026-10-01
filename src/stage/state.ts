/**
 * The Stage state: the only thing scroll timelines write to. The render loop reads it
 * with light damping; no scroll handler touches Three.js objects directly.
 *
 * Camera: an orbit around `target` (yaw, pitch) whose distance is derived from the
 * frame: `ref` world units should span `frame.h` of the viewport height (and `refW`
 * should fit `frame.w` of its width), with `target` landing at (frame.x, frame.y) of the
 * viewport through a lens shift. Frames come from CSS layout slots.
 */

export interface StageState {
  tx: number;
  ty: number;
  tz: number;
  yaw: number;
  pitch: number;
  ref: number;
  refW: number;
  fx: number;
  fy: number;
  fh: number;
  fw: number;
  /** Can transform. */
  canX: number;
  canY: number;
  canRot: number;
  /** How much of the visitor's drag spin applies (1 in S2, 0 elsewhere). */
  spinWeight: number;
  /** Idle turn amplitude (hero). */
  idle: number;
  /** Label unwrap 0 (wrapped) → 1 (flat dieline). */
  unwrap: number;
  /** 1 shows the proof artwork on the sleeve instead of the printed label. */
  proof: number;
  /** Annotation draw-in 0–1 (Design beat). */
  annotate: number;
  /** Solid aluminium revealed bottom → top; 0 leaves only the wireframe. */
  solid: number;
  /** Wireframe lines visibility 0–1. */
  wire: number;
  /** Label revealed bottom → top, 0–1. */
  label: number;
  ringPull: number;
  fizz: number;
  rise: number;
  /** Line-up products slid into place, 0–1. */
  lineup: number;
  /** Sweep tint toward the label colour (subtle) and full wash (launch). */
  tint: number;
  wash: number;
  /** Brief sent: the can slides off the sweep. */
  ship: number;
}

export const DEFAULT_STATE: StageState = {
  tx: 0,
  ty: 0.61,
  tz: 0,
  yaw: 0.27,
  pitch: 0.06,
  ref: 1.22,
  refW: 0,
  fx: 0.7,
  fy: 0.52,
  fh: 0.62,
  fw: 0.5,
  canX: 0,
  canY: 0,
  canRot: 0.1,
  spinWeight: 0,
  idle: 1,
  unwrap: 0,
  proof: 0,
  annotate: 0,
  solid: 1,
  wire: 0,
  label: 1,
  ringPull: 0,
  fizz: 0,
  rise: 0,
  lineup: 0,
  tint: 0,
  wash: 0,
  ship: 0,
};

/** Keys that switch instantly instead of easing (discrete states). */
const DISCRETE = new Set<keyof StageState>(['proof']);

export function createState(): StageState {
  return { ...DEFAULT_STATE };
}

/**
 * Moves `current` toward `target`. Returns true while anything is still moving, so the
 * loop can stop rendering once the scene settles.
 */
export function damp(current: StageState, target: StageState, dt: number, rate = 9): boolean {
  const k = 1 - Math.exp(-rate * dt);
  let moving = false;
  for (const key of Object.keys(target) as Array<keyof StageState>) {
    const t = target[key];
    const c = current[key];
    // GSAP decorates the objects it tweens with a `_gsap` bookkeeping property. It is not a
    // stage value: treating it as one made `moving` true forever, so the render loop never
    // stopped (and never really rendered on demand).
    if (typeof t !== 'number' || typeof c !== 'number') continue;
    if (DISCRETE.has(key)) {
      current[key] = t;
      continue;
    }
    const d = t - c;
    if (Math.abs(d) < 1e-4) {
      current[key] = t;
    } else {
      current[key] = c + d * k;
      moving = true;
    }
  }
  return moving;
}

export function copyState(from: StageState, to: StageState): void {
  Object.assign(to, from);
}
