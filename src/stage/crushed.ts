/**
 * The 404 page: a crushed can lying on the sweep. Vertex displacement dents the middle
 * of the body and label, shortens the can and tips its top. It wears the visitor's brand
 * when they set one this session.
 */
import { brand } from '../lib/brand';
import { toArt } from '../label/surfaces';
import { CAN } from './dims';
import { detectTier, isSoftwareRenderer } from './quality';
import { probeWebGL, Stage } from './stage';
import { createState } from './state';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Can-local crush: the front of a band around the middle is pushed in with sharp folds,
 * the sides pinch, the can shortens and its top half bends over.
 */
export function crushPoint(x: number, y: number, z: number, outer = 1): [number, number, number] {
  const t = y / CAN.height;
  const band = Math.exp(-(((t - 0.5) / 0.16) ** 2));
  const theta = Math.atan2(x, z);
  const front = Math.max(0, Math.cos(theta));
  // Folds: a few sharp ridges running round the dent.
  const folds = 0.5 + 0.5 * Math.sin(theta * 3 + t * 9);
  const dent = band * (0.38 * front + 0.08) * (0.8 + 0.4 * folds);
  const r = Math.hypot(x, z);
  const nr = Math.max(0.05, r * (1 - dent) * (1 + (outer - 1) * (0.2 + band)));
  const nx = Math.sin(theta) * nr * (1 + 0.1 * band);
  const nz = Math.cos(theta) * nr;
  const bend = smoothstep(0.45, 1, t);
  const ny = y - 0.16 * smoothstep(0.32, 0.72, t);
  return [nx, ny, nz - 0.14 * bend];
}

export async function startCrushed(slot: HTMLElement): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let tier = detectTier();
  const gl = probeWebGL(canvas, tier !== 'low');
  // Without WebGL the headline carries the page on its own.
  if (!gl) return;
  if (isSoftwareRenderer(gl)) tier = 'low';
  document.body.prepend(canvas);

  const length = CAN.height - 0.16;
  const target = Object.assign(createState(), {
    tx: 0,
    ty: 0.3,
    tz: 0,
    yaw: 0.42,
    pitch: 0.42,
    ref: 0.95,
    refW: 1.45,
    idle: 0,
    canX: length / 2,
    canY: 0.3,
    canRot: 0.35,
    spinWeight: 0,
  });
  const stage = new Stage(canvas, gl, tier, true, target, 32);
  const g = stage.can.group;
  // Lying on its side, rolled a little so the label faces up at the camera.
  g.rotation.z = Math.PI / 2 - 0.06;
  stage.can.crush(crushPoint);
  stage.setShadow(-length / 2, 1.5);

  await stage.warm();
  const s = brand.get();
  if (brand.meta().personalised && s.name) {
    await stage.surfaces.setArt(toArt(s));
    stage.surfaces.drawSleeve('final');
    stage.setInk(1);
    stage.setBrandColour(s.colour);
  }
  stage.setAnchor(slot, 0.8);
  stage.onFirstFrame(() => canvas.classList.add('is-ready'));
  stage.snapNext();
  addEventListener('pagehide', (e) => {
    if (!e.persisted) stage.dispose();
  });
}
