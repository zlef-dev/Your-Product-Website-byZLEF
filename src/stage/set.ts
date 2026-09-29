/**
 * The product-photography set: a seamless paper sweep (floor curving up into the
 * backdrop along a quarter circle), canvas-drawn contact shadows, and the light rig:
 * RoomEnvironment reflections plus two tall strip softboxes and a soft fill.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RectAreaLight,
  SRGBColorSpace,
  type Object3D,
} from 'three';

export const PAPER = new Color('#F1F2EE');

const FLOOR_FRONT = 9;
const CURVE_START = -1.6;
const RADIUS = 2.2;
const WALL_TOP = 14;
const HALF_WIDTH = 30;

/** Profile points (z, y, shade) from the front of the floor up the backdrop. */
function sweepProfile(): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = [];
  const floorSteps = 16;
  for (let i = 0; i <= floorSteps; i++) {
    const t = i / floorSteps;
    const z = FLOOR_FRONT + (CURVE_START - FLOOR_FRONT) * t;
    pts.push([z, 0, 1 - 0.018 * t * t]);
  }
  const curveSteps = 18;
  for (let i = 1; i <= curveSteps; i++) {
    const a = (i / curveSteps) * (Math.PI / 2);
    pts.push([
      CURVE_START - RADIUS * Math.sin(a),
      RADIUS - RADIUS * Math.cos(a),
      0.965 + 0.01 * Math.sin(a * 2),
    ]);
  }
  const wallSteps = 8;
  for (let i = 1; i <= wallSteps; i++) {
    const t = i / wallSteps;
    pts.push([CURVE_START - RADIUS, RADIUS + (WALL_TOP - RADIUS) * t, 0.982 + 0.018 * t]);
  }
  return pts;
}

export function createSweep(): Mesh<BufferGeometry, MeshBasicMaterial> {
  const profile = sweepProfile();
  const cols = 24;
  const rows = profile.length;
  const positions = new Float32Array(rows * (cols + 1) * 3);
  const colors = new Float32Array(rows * (cols + 1) * 3);
  let p = 0;
  profile.forEach(([z, y, shade]) => {
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const x = -HALF_WIDTH + u * HALF_WIDTH * 2;
      // Light falls off gently toward the sides of the sweep.
      const side = 1 - 0.03 * Math.min(1, (Math.abs(x) / 9) ** 2);
      positions.set([x, y, z], p * 3);
      const v = shade * side;
      colors.set([v, v, v], p * 3);
      p++;
    }
  });
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + cols + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  geo.setIndex(index);
  // Unlit and not tone mapped, so the sweep matches the CSS paper exactly.
  const mat = new MeshBasicMaterial({
    color: PAPER.clone(),
    vertexColors: true,
    toneMapped: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'sweep';
  mesh.renderOrder = -2;
  return mesh;
}

let shadowTexture: CanvasTexture | null = null;

function contactTexture(): CanvasTexture {
  if (shadowTexture) return shadowTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(35,31,32,0.62)');
  g.addColorStop(0.32, 'rgba(35,31,32,0.42)');
  g.addColorStop(0.55, 'rgba(35,31,32,0.14)');
  g.addColorStop(1, 'rgba(35,31,32,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  shadowTexture = new CanvasTexture(canvas);
  shadowTexture.colorSpace = SRGBColorSpace;
  return shadowTexture;
}

/** A soft contact shadow on the floor under a product footprint (width × depth). */
export function createContactShadow(width: number, depth: number, strength = 1): Mesh {
  const mat = new MeshBasicMaterial({
    map: contactTexture(),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: strength,
  });
  const mesh = new Mesh(new PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  mesh.renderOrder = -1;
  mesh.name = 'contact-shadow';
  return mesh;
}

/** Two tall strip softboxes left and right, plus a soft fill. Directional lights on the low tier. */
export function createLightRig(rectLights: boolean): Group {
  const rig = new Group();
  rig.name = 'light-rig';
  const add = (o: Object3D) => rig.add(o);
  if (rectLights) {
    const left = new RectAreaLight('#ffffff', 5.5, 0.45, 3.2);
    left.position.set(-1.9, 1.3, 1.3);
    left.lookAt(0, 0.7, 0);
    const right = new RectAreaLight('#fffaf2', 4.5, 0.45, 3.2);
    right.position.set(2.0, 1.2, 0.9);
    right.lookAt(0, 0.7, 0);
    add(left);
    add(right);
  } else {
    const left = new DirectionalLight('#ffffff', 1.6);
    left.position.set(-2, 1.6, 1.5);
    const right = new DirectionalLight('#fffaf2', 1.2);
    right.position.set(2, 1.4, 1);
    add(left);
    add(right);
  }
  add(new HemisphereLight('#ffffff', '#d9d7d0', 0.55));
  return rig;
}
