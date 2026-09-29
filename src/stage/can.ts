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
  Plane,
  BufferGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Finish } from '../lib/brand';
import { CAN, SLEEVE_HEIGHT, SLEEVE_RADIUS } from './dims';
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
  readonly solidPlane = new Plane(new Vector3(0, -1, 0), 10);
  readonly wirePlane = new Plane(new Vector3(0, 1, 0), -10);
  readonly labelPlane = new Plane(new Vector3(0, -1, 0), 10);

  private thetas: Float32Array;
  private ys: Float32Array;
  private unwrapP = -1;
  private finish: Finish = 'gloss';
  private ink = 0;
  private materials: Array<MeshPhysicalMaterial | MeshBasicMaterial | LineBasicMaterial> = [];

  constructor(opts: { latheSegments: number; radialSegments: number; anisotropy: boolean }) {
    this.group.name = 'can';
    this.group.add(this.spinner);

    // Body.
    const profile = CAN_PROFILE.map(([r, y]) => new Vector2(r, y));
    const bodyMat = new MeshPhysicalMaterial({
      color: new Color('#D7DADD'),
      metalness: 1,
      roughness: 0.28,
      anisotropy: opts.anisotropy ? 0.4 : 0,
      anisotropyRotation: Math.PI / 2,
      clippingPlanes: [this.solidPlane],
      envMapIntensity: 1,
    });
    const bodyGeo = new LatheGeometry(profile, opts.latheSegments);
    // Real tangents: derivative-based ones facet the anisotropic reflections per triangle.
    if (opts.anisotropy) bodyGeo.computeTangents();
    this.body = new Mesh(bodyGeo, bodyMat);
    this.body.name = 'can-body';
    this.spinner.add(this.body);

    // Lid, countersink ring, score line and ring-pull.
    const lidMat = new MeshPhysicalMaterial({
      color: new Color('#C4C8CC'),
      metalness: 1,
      roughness: 0.36,
      clippingPlanes: [this.solidPlane],
    });
    const lid = new Mesh(new CircleGeometry(0.271, opts.latheSegments), lidMat);
    lid.rotation.x = -Math.PI / 2;
    lid.position.y = LID_Y;
    const ring = new Mesh(new TorusGeometry(0.262, 0.0055, 8, opts.latheSegments), lidMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = LID_Y + 0.001;
    this.lidGroup.add(lid, ring);

    const scoreMat = new LineBasicMaterial({ color: '#8C9095', clippingPlanes: [this.solidPlane] });
    const score = new LineLoop(tearPanel(), scoreMat);
    score.position.y = LID_Y + 0.0015;
    this.lidGroup.add(score);

    const pullMat = new MeshPhysicalMaterial({
      color: new Color('#CDD1D5'),
      metalness: 1,
      roughness: 0.3,
      clippingPlanes: [this.solidPlane],
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
      1,
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
      clippingPlanes: [this.labelPlane],
    });
    // The inside of the label is plain white stock, not a mirror image of the print.
    labelMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n\tif ( ! gl_FrontFacing ) diffuseColor.rgb = vec3( 0.86, 0.86, 0.84 );',
      );
    };
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
      clippingPlanes: [this.wirePlane],
    });
    this.wire = new LineSegments(new EdgesGeometry(wireLathe, 10), wireMat);
    wireLathe.dispose();
    this.wire.visible = false;
    this.spinner.add(this.wire);

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

  /** World-space clip heights for the build and label reveals. */
  setReveal(solid: number, wire: number, label: number): void {
    const base = this.group.position.y;
    const top = CAN.height + 0.02;
    const solidY = base - 0.01 + solid * (top + 0.02);
    this.solidPlane.constant = solidY;
    this.wirePlane.constant = -solidY;
    const labelY = base + CAN.wallBottom - 0.01 + label * (SLEEVE_HEIGHT + 0.02);
    this.labelPlane.constant = labelY;
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
  }
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
