/**
 * The launch fizz: a short burst of droplets from the opened can. Positions are a pure
 * function of the scrubbed progress, so scrolling backwards replays it exactly.
 * At most 200 sprite particles on desktop and 80 on mobile; the sprite is drawn in canvas.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Points,
  PointsMaterial,
  SRGBColorSpace,
} from 'three';
import { prng } from '../label/barcode';

function sprite(): CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size * 0.42, size * 0.4, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(236,240,244,0.85)');
  g.addColorStop(0.7, 'rgba(200,206,212,0.35)');
  g.addColorStop(1, 'rgba(200,206,212,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class Fizz {
  readonly object: Points<BufferGeometry, PointsMaterial>;
  private seeds: Float32Array;
  private count: number;
  private last = -1;

  constructor(count: number) {
    this.count = count;
    const rand = prng(355);
    this.seeds = new Float32Array(count * 6);
    for (let i = 0; i < count * 6; i++) this.seeds[i] = rand();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    const mat = new PointsMaterial({
      map: sprite(),
      size: 0.045,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      color: '#ffffff',
    });
    this.object = new Points(geo, mat);
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  update(t: number, origin: { x: number; y: number; z: number }): void {
    const v = Math.round(t * 500) / 500;
    if (v === this.last) return;
    this.last = v;
    this.object.visible = v > 0.001 && v < 0.999;
    if (!this.object.visible) return;
    const pos = this.object.geometry.getAttribute('position') as BufferAttribute;
    const arr = pos.array as Float32Array;
    const time = v * 1.4;
    for (let i = 0; i < this.count; i++) {
      const s = i * 6;
      const birth = this.seeds[s]! * 0.7;
      const life = 0.45 + this.seeds[s + 1]! * 0.4;
      const age = (time - birth) / life;
      if (age < 0 || age > 1) {
        arr[i * 3 + 1] = -100;
        continue;
      }
      const a = this.seeds[s + 2]! * Math.PI * 2;
      const spread = 0.12 + this.seeds[s + 3]! * 0.45;
      const up = 0.9 + this.seeds[s + 4]! * 1.3;
      const tt = age * life;
      arr[i * 3] = origin.x + Math.cos(a) * spread * tt;
      arr[i * 3 + 1] = origin.y + up * tt - 1.1 * tt * tt;
      arr[i * 3 + 2] = origin.z + Math.sin(a) * spread * tt * 0.7;
    }
    pos.needsUpdate = true;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.object.material.map?.dispose();
    this.object.material.dispose();
  }
}
