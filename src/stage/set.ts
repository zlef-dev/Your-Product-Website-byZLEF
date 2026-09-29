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
  PMREMGenerator,
  DataTexture,
  DataUtils,
  EquirectangularReflectionMapping,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  RGBAFormat,
  SRGBColorSpace,
  OrthographicCamera,
  Scene,
  type Material,
  type Texture,
  type WebGLRenderer,
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

/**
 * Reflections from a procedural HDR studio: warm-grey walls, a ceiling softbox and two
 * tall, hot vertical strips front-left and front-right (the softboxes that put highlight
 * bands down the can). Built as a small half-float equirect and pre-filtered with PMREM.
 * Rendering RoomEnvironment instead compiled lit shaders synchronously and cost ~1 s of
 * main thread on load; this needs only PMREM's small shaders.
 */
export async function createEnvironment(renderer: WebGLRenderer): Promise<Texture> {
  const w = 256;
  const h = 128;
  const data = new Uint16Array(w * h * 4);
  // Strip azimuths in three's equirect u (u = atan2(z, x) / 2π + 0.5), camera side is +z.
  const strips = [
    { u: 0.905, width: 0.022, power: 9, tint: [1, 1, 1] },
    { u: 0.6, width: 0.02, power: 7, tint: [1, 0.97, 0.92] },
  ];
  for (let y = 0; y < h; y++) {
    const v = 1 - (y + 0.5) / h;
    const elev = (v - 0.5) * Math.PI;
    // Floor below the horizon, walls around it, a brighter ceiling above.
    let base = v < 0.5 ? 0.3 + 0.15 * (v / 0.5) : 0.52 + 0.28 * Math.sin(elev);
    if (v > 0.86) base += 2.4 * smoothstep(0.86, 0.95, v);
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      let r = base * 1.02;
      let g = base;
      let b = base * 0.97;
      for (const s of strips) {
        const d = Math.abs(u - s.u);
        const inside = 1 - smoothstep(s.width * 0.6, s.width, d);
        const tall = smoothstep(0.3, 0.38, v) * (1 - smoothstep(0.8, 0.86, v));
        const k = inside * tall * s.power;
        r += k * s.tint[0]!;
        g += k * s.tint[1]!;
        b += k * s.tint[2]!;
      }
      const i = (y * w + x) * 4;
      data[i] = DataUtils.toHalfFloat(r);
      data[i + 1] = DataUtils.toHalfFloat(g);
      data[i + 2] = DataUtils.toHalfFloat(b);
      data[i + 3] = DataUtils.toHalfFloat(1);
    }
  }
  const equirect = new DataTexture(data, w, h, RGBAFormat, HalfFloatType);
  equirect.mapping = EquirectangularReflectionMapping;
  equirect.colorSpace = LinearSRGBColorSpace;
  equirect.magFilter = LinearFilter;
  equirect.minFilter = LinearFilter;
  equirect.needsUpdate = true;
  const pmrem = new PMREMGenerator(renderer);
  await precompilePmrem(renderer, pmrem, w / 4);
  const tex = pmrem.fromEquirectangular(equirect).texture;
  equirect.dispose();
  pmrem.dispose();
  return tex;
}

const GGX_SAMPLES = 32;

/** The parts of PMREMGenerator's internals used to compile its filters ahead of time. */
interface PmremInternals {
  _setSize(cubeSize: number): void;
  _allocateTargets(): { dispose(): void };
  _blurMaterial: Material | null;
  _ggxMaterial: Material | null;
  _equirectMaterial: Material | null;
}

/**
 * PMREM's blur and GGX filter shaders are long loops that take D3D11's HLSL compiler
 * most of a second, and PMREM compiles them synchronously on first use. Allocating its
 * targets creates the materials; compileAsync then builds them with
 * KHR_parallel_shader_compile, off the main thread, so the bake itself doesn't block.
 * (This reaches into two private members; checked against three r186.)
 */
async function precompilePmrem(renderer: WebGLRenderer, pmrem: PMREMGenerator, cubeSize: number): Promise<void> {
  try {
    const p = pmrem as unknown as PmremInternals;
    p._setSize(cubeSize);
    p._allocateTargets().dispose();
    // 256 GGX samples per texel is for arbitrary HDRIs; this studio is smooth, and the
    // shorter loop compiles in a fraction of the time.
    const ggx = p._ggxMaterial as (Material & { defines?: Record<string, unknown> }) | null;
    if (ggx?.defines) {
      ggx.defines.GGX_SAMPLES = GGX_SAMPLES;
      ggx.needsUpdate = true;
    }
    pmrem.compileEquirectangularShader();
    const scene = new Scene();
    for (const m of [p._blurMaterial, p._ggxMaterial, p._equirectMaterial]) {
      if (m) scene.add(new Mesh(new BufferGeometry(), m));
    }
    const camera = new OrthographicCamera();
    if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
    scene.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
  } catch {
    // Internals changed: the bake below simply compiles synchronously.
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Diffuse light for the printed labels: a key and a fill from the softboxes' sides, plus sky. */
export function createLightRig(): Group {
  const rig = new Group();
  rig.name = 'light-rig';
  const left = new DirectionalLight('#ffffff', 1.5);
  left.position.set(-2, 1.6, 1.5);
  const right = new DirectionalLight('#fffaf2', 1.1);
  right.position.set(2, 1.4, 1);
  rig.add(left, right, new HemisphereLight('#ffffff', '#d9d7d0', 0.55));
  return rig;
}
