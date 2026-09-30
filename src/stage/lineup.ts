/**
 * S3 line-up (lazy-loaded before scene 3): a glass bottle, a cosmetic jar and a kraft
 * mailer box join the can on the sweep, all wearing the visitor's artwork.
 */
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector2,
  type Material,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { SurfaceName } from '../label/surfaces';
import { flipV } from './can';
import { BOTTLE, BOX, JAR } from './dims';
import { createContactShadow } from './set';
import type { StageState } from './state';

/** Where each product stands, left to right, and the height the camera frames. */
export const LINEUP = [
  { x: 0, height: 1.22, turn: 0.1 },
  { x: 2.2, height: BOTTLE.height, turn: 0.18 },
  { x: 4.3, height: JAR.bodyHeight + JAR.lidHeight, turn: -0.22 },
  { x: 6.4, height: BOX.height, turn: -0.38 },
] as const;

const SPACING = 2.1;
const TURN = (20 * Math.PI) / 180;

const lathe = (pts: Array<[number, number]>, segments: number) =>
  new LatheGeometry(
    pts.map(([r, y]) => new Vector2(r, y)),
    segments,
  );

function bandGeometry(radius: number, height: number, arc: number, y: number): CylinderGeometry {
  const g = new CylinderGeometry(radius, radius, height, 64, 1, true, -arc / 2, arc);
  g.translate(0, y + height / 2, 0);
  flipV(g);
  return g;
}

export class Lineup {
  readonly group = new Group();
  private items: Group[] = [];
  /** Real transmission (high tier) and a tinted transparent glass (everything else). */
  private glassSolid: MeshPhysicalMaterial;
  private glassTint: MeshPhysicalMaterial;
  private bottleBody: Mesh;
  /**
   * Invisible, and always wearing whichever glass is *not* in use, so the scene's shader
   * compile covers both. A runtime quality step-down is then a material swap rather than a
   * synchronous compile on a machine that is already struggling.
   */
  private glassProbe: Mesh;
  private brandParts: MeshPhysicalMaterial[] = [];
  private bottleLabel: MeshPhysicalMaterial;
  private jarLabel: MeshPhysicalMaterial;
  private boxDecal: MeshStandardMaterial;
  private materials: Material[] = [];
  private transmission = false;

  constructor(segments: number) {
    this.group.name = 'lineup';
    this.group.visible = false;

    // ---------- Bottle ----------
    const bottle = new Group();
    const glass = {
      color: new Color('#E6F0E8'),
      metalness: 0,
      roughness: 0.05,
      ior: 1.5,
      thickness: 0.3,
      side: DoubleSide,
      attenuationColor: new Color('#CFE6D5'),
      attenuationDistance: 1.6,
      specularIntensity: 1,
    } as const;
    this.glassSolid = new MeshPhysicalMaterial({ ...glass, transmission: 1 });
    this.glassTint = new MeshPhysicalMaterial({
      ...glass,
      transmission: 0,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const glassBody = new Mesh(
      lathe(
        [
          [0, 0.02],
          [0.28, 0.0],
          [0.34, 0.008],
          [0.365, 0.04],
          [BOTTLE.radius, 0.1],
          [BOTTLE.radius, 1.3],
          [0.366, 1.4],
          [0.345, 1.51],
          [0.3, 1.64],
          [0.235, 1.76],
          [0.175, 1.86],
          [0.14, 1.95],
          [0.13, 2.05],
          [0.13, 2.22],
          [0.14, 2.24],
          [0.142, 2.3],
        ],
        segments,
      ),
      this.glassTint,
    );
    this.bottleBody = glassBody;
    this.bottleBody.renderOrder = 3;
    this.glassProbe = new Mesh(this.bottleBody.geometry, this.glassSolid);
    this.glassProbe.visible = false;
    this.glassProbe.name = 'glass-probe';
    const cap = new Mesh(
      lathe(
        [
          [0, 2.42],
          [0.13, 2.42],
          [0.148, 2.41],
          [0.152, 2.39],
          [0.152, 2.27],
          [0.145, 2.26],
          [0, 2.26],
        ],
        segments,
      ),
      this.brandMaterial(),
    );
    this.bottleLabel = new MeshPhysicalMaterial({ roughness: 0.42, metalness: 0, clearcoat: 0.3 });
    const bottleBand = new Mesh(
      bandGeometry(BOTTLE.radius * 1.004, BOTTLE.labelHeight, BOTTLE.labelArc, BOTTLE.labelBottom),
      this.bottleLabel,
    );
    bottle.add(this.bottleBody, this.glassProbe, cap, bottleBand, createContactShadow(1.3, 1.3, 0.55));

    // ---------- Jar ----------
    const jar = new Group();
    const ceramic = new MeshPhysicalMaterial({
      color: new Color('#F4F2EE'),
      roughness: 0.32,
      metalness: 0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });
    const jarBody = new Mesh(
      lathe(
        [
          [0, 0.002],
          [0.3, 0],
          [0.33, 0.012],
          [JAR.radius, 0.04],
          [JAR.radius, 0.32],
          [0.33, 0.345],
          [0.3, 0.355],
          [0.29, 0.37],
        ],
        segments,
      ),
      ceramic,
    );
    const lidTop = JAR.bodyHeight + JAR.lidHeight;
    const lid = new Mesh(
      lathe(
        [
          [0, lidTop],
          [0.3, lidTop],
          [0.335, lidTop - 0.008],
          [0.348, lidTop - 0.03],
          [0.35, JAR.bodyHeight + 0.01],
          [0.345, JAR.bodyHeight],
          [0.3, JAR.bodyHeight],
        ],
        segments,
      ),
      this.brandMaterial(),
    );
    this.jarLabel = new MeshPhysicalMaterial({ roughness: 0.5, metalness: 0, clearcoat: 0.2 });
    const jarBand = new Mesh(
      bandGeometry(JAR.radius * 1.004, JAR.labelHeight, JAR.labelArc, JAR.labelBottom),
      this.jarLabel,
    );
    jar.add(jarBody, lid, jarBand, createContactShadow(1.1, 1.1, 0.75));

    // ---------- Mailer box ----------
    const box = new Group();
    const kraft = new MeshStandardMaterial({ color: new Color('#C8A878'), roughness: 0.9, metalness: 0 });
    const boxMesh = new Mesh(new RoundedBoxGeometry(BOX.width, BOX.height, BOX.depth, 4, 0.03), kraft);
    boxMesh.position.y = BOX.height / 2;
    this.boxDecal = new MeshStandardMaterial({
      transparent: true,
      roughness: 0.55,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const decalGeo = new PlaneGeometry(BOX.width * 0.92, BOX.height * 0.92);
    flipV(decalGeo);
    const decal = new Mesh(decalGeo, this.boxDecal);
    decal.position.set(0, BOX.height / 2, BOX.depth / 2 + 0.001);
    box.add(boxMesh, decal, createContactShadow(2, 1.2, 0.6));

    this.items = [new Group(), bottle, jar, box];
    this.items.slice(1).forEach((g) => this.group.add(g));
    this.materials = [
      this.glassSolid,
      this.glassTint,
      ceramic,
      kraft,
      this.bottleLabel,
      this.jarLabel,
      this.boxDecal,
    ];
  }

  private brandMaterial(): MeshPhysicalMaterial {
    const m = new MeshPhysicalMaterial({
      color: new Color('#D7263D'),
      roughness: 0.3,
      metalness: 0.1,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
    });
    this.brandParts.push(m);
    return m;
  }

  setTextures(get: (name: SurfaceName) => Texture): void {
    this.bottleLabel.map = get('bottle');
    this.jarLabel.map = get('jar');
    this.boxDecal.map = get('box');
    [this.bottleLabel, this.jarLabel, this.boxDecal].forEach((m) => (m.needsUpdate = true));
  }

  setBrandColour(hex: string): void {
    this.brandParts.forEach((m) => m.color.set(hex));
  }

  /** Real transmission on the high tier; a tinted transparent glass elsewhere. */
  setTransmission(on: boolean): void {
    if (on === this.transmission) return;
    this.transmission = on;
    this.bottleBody.material = on ? this.glassSolid : this.glassTint;
    this.glassProbe.material = on ? this.glassTint : this.glassSolid;
  }

  update(s: StageState, _time: number): void {
    this.group.visible = s.lineup > 0.001;
    if (!this.group.visible) return;
    for (let i = 1; i < LINEUP.length; i++) {
      const spec = LINEUP[i]!;
      const g = this.items[i]!;
      // Products slide in from the right one after another as `lineup` goes 0 → 1.
      const local = Math.min(1, Math.max(0, s.lineup * 1.6 - (i - 1) * 0.3));
      const e = 1 - (1 - local) ** 3;
      g.position.x = spec.x + (1 - e) * 3.5;
      g.visible = local > 0.001;
      // Each product turns about 20° as the camera passes its centre.
      const pass = Math.max(-1, Math.min(1, (s.tx - spec.x) / SPACING));
      g.rotation.y = spec.turn - pass * TURN * 0.5;
    }
  }

  dispose(): void {
    const geos = new Set<BufferGeometry>();
    this.group.traverse((o) => {
      if (o instanceof Mesh) geos.add(o.geometry);
    });
    geos.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.brandParts.forEach((m) => m.dispose());
  }
}
