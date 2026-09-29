/**
 * The can: a lathed brushed-aluminium body (domed base, chime, straight wall, tapered
 * shoulder and neck, rolled rim), a darker lid with a ring-pull that can flip up, and a
 * separate open label sleeve that maps the label texture 1:1 and can unwrap.
 */
import {
  BufferAttribute,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  LatheGeometry,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  BufferGeometry,
  TorusGeometry,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  Vector2,
  Vector4,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Finish } from '../lib/brand';
import type { Plates } from '../label/cmyk';
import { ALU } from '../label/draw';
import type { PlateFrame } from '../label/print-run';
import { CAN, SLEEVE_HEIGHT, SLEEVE_RADIUS } from './dims';
import { addHeightClip, type HeightClip } from './clip';
import { applyUnwrap } from './unwrap';

/** Profile (radius, height) from the centre of the domed base to the inside of the rim. */
export const CAN_PROFILE: Array<[number, number]> = [
  [0.0, 0.075],
  [0.06, 0.073],
  [0.12, 0.066],
  [0.17, 0.054],
  [0.205, 0.038],
  [0.225, 0.02],
  [0.235, 0.006],
  [0.245, 0.0],
  [0.256, 0.003],
  [0.268, 0.012],
  [0.285, 0.03],
  [0.302, 0.055],
  [0.316, 0.08],
  [0.326, 0.1],
  [CAN.radius, CAN.wallBottom],
  [CAN.radius, 0.4],
  [CAN.radius, 0.8],
  [CAN.radius, CAN.wallTop],
  [0.327, 1.125],
  [0.317, 1.15],
  [0.302, 1.172],
  [0.288, 1.188],
  [0.281, 1.198],
  [0.279, 1.206],
  [0.281, 1.213],
  [0.284, 1.219],
  [0.283, 1.2235],
  [0.279, 1.2245],
  [0.2745, 1.221],
  [0.273, 1.214],
  [0.271, 1.205],
];

const LID_Y = 1.204;

const PRINT_PARS = /* glsl */ `
uniform float uPrinting;
uniform float uFinal;
uniform vec4 uAlpha;
uniform vec4 uOffA;
uniform vec4 uOffB;
uniform vec3 uBase;
uniform sampler2D uPlateC;
uniform sampler2D uPlateM;
uniform sampler2D uPlateY;
uniform sampler2D uPlateK;`;

/** Plates multiply over bare stock, each with its own offset and opacity. */
const PRINT_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
if ( uPrinting > 0.5 ) {
  vec3 plates = vec3( 1.0 );
  plates *= mix( vec3( 1.0 ), texture2D( uPlateC, vMapUv - uOffA.xy ).rgb, uAlpha.x );
  plates *= mix( vec3( 1.0 ), texture2D( uPlateM, vMapUv - uOffA.zw ).rgb, uAlpha.y );
  plates *= mix( vec3( 1.0 ), texture2D( uPlateY, vMapUv - uOffB.xy ).rgb, uAlpha.z );
  plates *= mix( vec3( 1.0 ), texture2D( uPlateK, vMapUv - uOffB.zw ).rgb, uAlpha.w );
  diffuseColor.rgb = mix( uBase * plates, diffuseColor.rgb, uFinal );
}
#endif
// The inside of the label is plain white stock, not a mirror image of the print.
if ( ! gl_FrontFacing ) diffuseColor.rgb = vec3( 0.86, 0.86, 0.84 );`;

export const FINISHES: Record<Finish, { roughness: number; clearcoat: number; clearcoatRoughness: number }> =
  {
    gloss: { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06 },
    satin: { roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.25 },
    matte: { roughness: 0.62, clearcoat: 0.001, clearcoatRoughness: 0.5 },
  };

/** Unprinted metal vs printed ink on metal. */
const BARE = { metalness: 0.92, roughness: 0.26 };

export class Can {
  readonly group = new Group();
  /** Spins with the label; the lid and ring-pull ride along. */
  readonly spinner = new Group();
  readonly body: Mesh<LatheGeometry, MeshPhysicalMaterial>;
  readonly lidGroup = new Group();
  readonly ringPull = new Group();
  readonly sleeve: Mesh<CylinderGeometry, MeshPhysicalMaterial>;
  readonly overlay: Mesh<CylinderGeometry, MeshBasicMaterial>;
  readonly wire: LineSegments<EdgesGeometry, LineBasicMaterial>;

  /** Solid metal shows below this plane (world y); the wire shows above it. */
  readonly solidClip: HeightClip = { value: 10 };
  readonly labelClip: HeightClip = { value: 10 };

  /** Print run: four plates composited over bare stock inside the label shader. */
  readonly print = {
    uPrinting: { value: 0 },
    uFinal: { value: 1 },
    uAlpha: { value: new Vector4() },
    uOffA: { value: new Vector4() },
    uOffB: { value: new Vector4() },
    uBase: { value: new Color(ALU) },
    uPlateC: { value: null as Texture | null },
    uPlateM: { value: null as Texture | null },
    uPlateY: { value: null as Texture | null },
    uPlateK: { value: null as Texture | null },
  };
  private plateTex: DataTexture[] = [];
  private plateData: Plates | null = null;
  private plateUploaded = [false, false, false, false];
  private plateSize = { w: 1, h: 1 };

  private thetas: Float32Array;
  private ys: Float32Array;
  private unwrapP = -1;
  private finish: Finish = 'gloss';
  private ink = 0;
  private materials: Array<MeshPhysicalMaterial | MeshBasicMaterial | LineBasicMaterial> = [];

  constructor(opts: {
    latheSegments: number;
    radialSegments: number;
    /** Extra rows along the wall and label, for deforming (the 404 crush). */
    rows?: number;
  }) {
    this.group.name = 'can';
    this.group.add(this.spinner);

    // Body.
    const rows = opts.rows ?? 1;
    const profile = withWallRows(CAN_PROFILE, rows).map(([r, y]) => new Vector2(r, y));
    const bodyMat = new MeshPhysicalMaterial({
      color: new Color('#D7DADD'),
      metalness: 1,
      roughness: 0.28,
      envMapIntensity: 1,
    });
    const bodyGeo = new LatheGeometry(profile, opts.latheSegments);
    this.body = new Mesh(bodyGeo, bodyMat);
    this.body.name = 'can-body';
    this.spinner.add(this.body);

    // Lid, countersink ring, score line and ring-pull.
    const lidMat = new MeshPhysicalMaterial({
      color: new Color('#C4C8CC'),
      metalness: 1,
      roughness: 0.36,
    });
    const lid = new Mesh(new CircleGeometry(0.271, opts.latheSegments), lidMat);
    lid.rotation.x = -Math.PI / 2;
    lid.position.y = LID_Y;
    const ring = new Mesh(new TorusGeometry(0.262, 0.0055, 8, opts.latheSegments), lidMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = LID_Y + 0.001;
    this.lidGroup.add(lid, ring);

    const scoreMat = new LineBasicMaterial({ color: '#8C9095' });
    const score = new LineLoop(tearPanel(), scoreMat);
    score.position.y = LID_Y + 0.0015;
    this.lidGroup.add(score);

    const pullMat = new MeshPhysicalMaterial({
      color: new Color('#CDD1D5'),
      metalness: 1,
      roughness: 0.3,
    });
    const rivet = new Mesh(new CircleGeometry(0.018, 20), pullMat);
    rivet.rotation.x = -Math.PI / 2;
    rivet.position.set(0, LID_Y + 0.004, 0);
    const loop = new Mesh(new TorusGeometry(0.052, 0.011, 8, 32), pullMat);
    loop.rotation.x = -Math.PI / 2;
    loop.scale.set(1, 1.25, 0.4);
    loop.position.set(0, 0.006, -0.07);
    const tab = new Mesh(new RoundedBoxGeometry(0.075, 0.008, 0.13, 2, 0.004), pullMat);
    tab.position.set(0, 0.006, 0.0);
    this.ringPull.add(loop, tab);
    this.ringPull.position.set(0, LID_Y + 0.004, 0.02);
    this.lidGroup.add(rivet, this.ringPull);
    this.spinner.add(this.lidGroup);

    // Label sleeve: u runs around (u = 0.5 faces the camera), v runs up; seam at the back.
    const sleeveGeo = new CylinderGeometry(
      SLEEVE_RADIUS,
      SLEEVE_RADIUS,
      SLEEVE_HEIGHT,
      opts.radialSegments,
      rows,
      true,
      -Math.PI,
      Math.PI * 2,
    );
    sleeveGeo.translate(0, CAN.wallBottom + SLEEVE_HEIGHT / 2, 0);
    flipV(sleeveGeo);
    const uv = sleeveGeo.getAttribute('uv') as BufferAttribute;
    const pos = sleeveGeo.getAttribute('position') as BufferAttribute;
    this.thetas = new Float32Array(uv.count);
    this.ys = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) {
      this.thetas[i] = (uv.getX(i) - 0.5) * Math.PI * 2;
      this.ys[i] = pos.getY(i);
    }
    const labelMat = new MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: BARE.metalness,
      roughness: BARE.roughness,
      clearcoat: 0.001,
      clearcoatRoughness: 0.1,
      side: DoubleSide,
    });
    addHeightClip(labelMat, this.labelClip, 1, 'can-label', (shader) => {
      Object.assign(shader.uniforms, this.print);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${PRINT_PARS}`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
${PRINT_FRAGMENT}`,
        );
    });
    this.sleeve = new Mesh(sleeveGeo, labelMat);
    this.sleeve.name = 'can-label';
    this.sleeve.renderOrder = 1;
    this.spinner.add(this.sleeve);

    const overlayMat = new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.overlay = new Mesh(sleeveGeo, overlayMat);
    this.overlay.visible = false;
    this.overlay.renderOrder = 2;
    this.spinner.add(this.overlay);

    // Wireframe: a simplified lathe's creases and meridians in process black.
    const wireProfile = CAN_PROFILE.filter((_, i) => i % 2 === 0 || i === CAN_PROFILE.length - 1).map(
      ([r, y]) => new Vector2(r, y),
    );
    const wireLathe = new LatheGeometry(wireProfile, 28);
    const wireMat = new LineBasicMaterial({
      color: '#231F20',
      transparent: true,
      opacity: 0,
    });
    this.wire = new LineSegments(new EdgesGeometry(wireLathe, 10), wireMat);
    wireLathe.dispose();
    this.wire.visible = false;
    this.spinner.add(this.wire);

    // Solid metal shows below the build line; the wireframe shows above it.
    addHeightClip(bodyMat, this.solidClip, 1, 'can-metal');
    addHeightClip(lidMat, this.solidClip, 1, 'can-metal');
    addHeightClip(pullMat, this.solidClip, 1, 'can-metal');
    addHeightClip(scoreMat, this.solidClip, 1, 'can-score');
    addHeightClip(wireMat, this.solidClip, -1, 'can-wire');

    this.materials = [bodyMat, lidMat, scoreMat, pullMat, labelMat, overlayMat, wireMat];
    this.setFinish('gloss');
  }

  setLabelTexture(tex: Texture): void {
    const m = this.sleeve.material;
    if (m.map !== tex) {
      m.map = tex;
      m.needsUpdate = true;
    }
  }

  setOverlayTexture(tex: Texture | null): void {
    const m = this.overlay.material;
    if (m.map !== tex) {
      m.map = tex;
      m.needsUpdate = true;
    }
  }

  setFinish(f: Finish): void {
    this.finish = f;
    this.applyInk();
  }

  /** 0 = bare aluminium label stock, 1 = fully inked. The print run animates it. */
  setInk(v: number): void {
    this.ink = Math.min(1, Math.max(0, v));
    this.applyInk();
  }

  private applyInk(): void {
    const m = this.sleeve.material;
    const f = FINISHES[this.finish];
    const t = this.ink;
    m.metalness = BARE.metalness + (0.3 - BARE.metalness) * t;
    m.roughness = BARE.roughness + (f.roughness - BARE.roughness) * t;
    m.clearcoat = Math.max(0.001, f.clearcoat * t);
    m.clearcoatRoughness = f.clearcoatRoughness;
  }

  /** Plates for the current print run arrive (null ends the run and shows the artwork). */
  setPlates(plates: Plates | null, width: number, height: number): void {
    if (!plates) {
      this.print.uPrinting.value = 0;
      this.print.uFinal.value = 1;
      this.plateData = null;
      return;
    }
    this.plateData = plates;
    this.plateSize = { w: width, h: height };
    this.plateUploaded = [false, false, false, false];
  }

  /** One frame of the print run. Each plate uploads the first time it becomes visible. */
  setPlateFrame(f: PlateFrame): void {
    const u = this.print;
    u.uPrinting.value = 1;
    u.uFinal.value = f.final;
    u.uAlpha.value.set(...f.alpha);
    const { w, h } = this.plateSize;
    const o = f.offset;
    u.uOffA.value.set((o[0]?.[0] ?? 0) / w, (o[0]?.[1] ?? 0) / h, (o[1]?.[0] ?? 0) / w, (o[1]?.[1] ?? 0) / h);
    u.uOffB.value.set((o[2]?.[0] ?? 0) / w, (o[2]?.[1] ?? 0) / h, (o[3]?.[0] ?? 0) / w, (o[3]?.[1] ?? 0) / h);
    const data = this.plateData;
    if (!data) {
      u.uAlpha.value.set(0, 0, 0, 0);
      return;
    }
    const names = ['c', 'm', 'y', 'k'] as const;
    const slots = [u.uPlateC, u.uPlateM, u.uPlateY, u.uPlateK];
    names.forEach((n, i) => {
      if (this.plateUploaded[i] || f.alpha[i]! <= 0) return;
      this.plateUploaded[i] = true;
      const pixels = new Uint8Array(data[n].buffer, data[n].byteOffset, data[n].byteLength);
      let tex = this.plateTex[i];
      if (!tex || tex.image.width !== w || tex.image.height !== h) {
        tex?.dispose();
        tex = new DataTexture(pixels, w, h, RGBAFormat);
        tex.colorSpace = SRGBColorSpace;
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = false;
        this.plateTex[i] = tex;
      } else {
        tex.image.data = pixels;
      }
      tex.needsUpdate = true;
      slots[i]!.value = tex;
    });
    // A plate that hasn't uploaded yet must not print as black.
    u.uAlpha.value.set(
      this.plateUploaded[0] ? f.alpha[0] : 0,
      this.plateUploaded[1] ? f.alpha[1] : 0,
      this.plateUploaded[2] ? f.alpha[2] : 0,
      this.plateUploaded[3] ? f.alpha[3] : 0,
    );
  }

  /** Recomputes the sleeve for unwrap progress 0–1 (a few hundred vertices, on the CPU). */
  setUnwrap(p: number): void {
    const v = Math.round(p * 1000) / 1000;
    if (v === this.unwrapP) return;
    this.unwrapP = v;
    const geo = this.sleeve.geometry;
    const pos = geo.getAttribute('position') as BufferAttribute;
    applyUnwrap(pos.array as Float32Array, this.thetas, this.ys, SLEEVE_RADIUS, v, 0.42);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  /**
   * Crushes the can (404 page): displaces the body and label vertices with `fn` (can-local
   * coordinates) and drops the lid to follow. The label is fixed wrapped from then on.
   */
  crush(fn: (x: number, y: number, z: number, outer: number) => [number, number, number]): void {
    this.setUnwrap(0);
    for (const mesh of [this.body, this.sleeve] as Mesh[]) {
      const geo = mesh.geometry;
      const pos = geo.getAttribute('position') as BufferAttribute;
      // The label rides a little further out so the body can't poke through its folds.
      const outer = mesh === this.sleeve ? 1.012 : 1;
      for (let i = 0; i < pos.count; i++) {
        const [x, y, z] = fn(pos.getX(i), pos.getY(i), pos.getZ(i), outer);
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      if (geo.getAttribute('tangent')) geo.computeTangents();
      geo.computeBoundingSphere();
    }
    const [lx, ly, lz] = fn(0, CAN.height, 0, 1);
    this.lidGroup.position.set(lx, ly - CAN.height, lz);
  }

  /** World-space clip heights for the build and label reveals. */
  setReveal(solid: number, wire: number, label: number): void {
    const base = this.group.position.y;
    const top = CAN.height + 0.02;
    const solidY = base - 0.01 + solid * (top + 0.02);
    this.solidClip.value = solidY;
    const labelY = base + CAN.wallBottom - 0.01 + label * (SLEEVE_HEIGHT + 0.02);
    this.labelClip.value = labelY;
    this.wire.visible = wire > 0.001 && solid < 0.999;
    this.wire.material.opacity = wire;
    this.body.visible = solid > 0.001;
    this.sleeve.visible = label > 0.001;
  }

  setRingPull(v: number): void {
    this.ringPull.rotation.x = -1.35 * v;
  }

  dispose(): void {
    const geos = new Set<BufferGeometry>();
    this.group.traverse((o) => {
      if (o instanceof Mesh || o instanceof Line || o instanceof LineSegments) geos.add(o.geometry);
    });
    geos.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.plateTex.forEach((t) => t.dispose());
  }
}

/** Replaces the straight wall's points with `rows` evenly spaced ones. */
function withWallRows(profile: Array<[number, number]>, rows: number): Array<[number, number]> {
  if (rows <= 1) return profile;
  const out: Array<[number, number]> = [];
  for (const p of profile) {
    const onWall = p[0] === CAN.radius && p[1] > CAN.wallBottom && p[1] < CAN.wallTop;
    if (onWall) continue;
    out.push(p);
    if (p[0] === CAN.radius && p[1] === CAN.wallBottom) {
      for (let i = 1; i < rows; i++) out.push([CAN.radius, CAN.wallBottom + (SLEEVE_HEIGHT * i) / rows]);
    }
  }
  return out;
}

/** Label textures are uploaded without flipY, so canvas row 0 must map to the top edge. */
export function flipV(geo: BufferGeometry): void {
  const uv = geo.getAttribute('uv') as BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  uv.needsUpdate = true;
}

/** The tear panel's score line: a rounded teardrop toward the front of the lid. */
function tearPanel(): BufferGeometry {
  const pts: number[] = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * 0.075 * (1 - 0.25 * Math.sin(a));
    const z = 0.155 + Math.sin(a) * 0.06;
    pts.push(x, 0, z);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  return g;
}
