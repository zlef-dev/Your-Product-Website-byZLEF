/**
 * Label surfaces: the canvases the renderer draws into and the stage turns into textures.
 * The controller owns what is currently printed and redraws every layout from it.
 * Redraws are coalesced to at most one per animation frame.
 */
import { labelCopy } from '../content';
import type { BrandState } from '../lib/brand';
import { BOTTLE_BAND_ASPECT, JAR_BAND_ASPECT, SLEEVE_ASPECT } from '../stage/dims';
import { drawAnnotations, drawLabel, drawSticker, type LabelArt, type LabelMode } from './draw';
import { ensureLabelFonts } from './fonts';

export type SurfaceName = 'sleeve' | 'proof' | 'annotations' | 'bottle' | 'jar' | 'box';

export interface Surface {
  readonly name: SurfaceName;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  /** Bumped on every change; consumers compare it to know when to re-upload. */
  version: number;
}

function makeSurface(name: SurfaceName, width: number, height: number): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // CPU-backed: uploading a GPU-backed 2D canvas to WebGL forces a readback stall.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  return { name, canvas, ctx, width, height, version: 0 };
}

export const toArt = (s: Readonly<BrandState>): LabelArt => ({
  name: s.name,
  colour: s.colour,
  style: s.style,
  logo: s.logo,
});

type Listener = (name: SurfaceName) => void;

export class LabelSurfaces {
  readonly sleeve: Surface;
  private extra = new Map<SurfaceName, Surface>();
  private listeners = new Set<Listener>();
  private art: LabelArt | null = null;
  private annotateT = 0;
  private dirty = new Set<SurfaceName>();
  private raf = 0;

  constructor(readonly sleeveWidth: number) {
    this.sleeve = makeSurface('sleeve', sleeveWidth, Math.round(sleeveWidth / SLEEVE_ASPECT));
  }

  /** Current printed artwork, or null while the can is still a white label. */
  printed(): LabelArt | null {
    return this.art;
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  touch(name: SurfaceName): void {
    const s = name === 'sleeve' ? this.sleeve : this.extra.get(name);
    if (!s) return;
    s.version++;
    this.listeners.forEach((l) => l(name));
  }

  /** Lazily creates the secondary surfaces (proof, band labels, box top, annotations). */
  get(name: Exclude<SurfaceName, 'sleeve'>): Surface {
    let s = this.extra.get(name);
    if (!s) {
      const w = this.sleeveWidth;
      const size: Record<typeof name, [number, number]> = {
        proof: [w, Math.round(w / SLEEVE_ASPECT)],
        annotations: [w / 2, Math.round(w / 2 / SLEEVE_ASPECT)],
        bottle: [Math.round(w / 2), Math.round(w / 2 / BOTTLE_BAND_ASPECT)],
        jar: [Math.round(w / 2), Math.round(w / 2 / JAR_BAND_ASPECT)],
        box: [Math.round(w / 2), Math.round(w / 2)],
      };
      const [sw, sh] = size[name];
      s = makeSurface(name, sw, sh);
      this.extra.set(name, s);
      this.drawNow(name);
    }
    return s;
  }

  has(name: SurfaceName): boolean {
    return name === 'sleeve' || this.extra.has(name);
  }

  /** Draws the sleeve in a given mode right now (used by the print run for its final swap). */
  drawSleeve(mode: LabelMode): void {
    const art = this.art ?? { name: '', colour: '#D7263D', style: 'wide', logo: null };
    drawLabel(this.sleeve.ctx, this.sleeve.width, this.sleeve.height, {
      layout: 'sleeve',
      mode: this.art ? mode : 'blank',
      art,
    });
    this.touch('sleeve');
  }

  /** Prints a shipping sticker over the current sleeve artwork. */
  stickSticker(job: string): void {
    drawSticker(this.sleeve.ctx, this.sleeve.width, this.sleeve.height, job);
    this.touch('sleeve');
  }

  /** Sets the printed artwork and redraws the secondary surfaces on the next frame. */
  async setArt(art: LabelArt | null): Promise<void> {
    if (art) await ensureLabelFonts(art.style);
    else await ensureLabelFonts('wide');
    this.art = art;
    this.extra.forEach((_s, name) => this.dirty.add(name));
    this.schedule();
  }

  setAnnotation(t: number): void {
    const v = Math.round(t * 60) / 60;
    if (v === this.annotateT) return;
    this.annotateT = v;
    if (this.extra.has('annotations')) {
      this.dirty.add('annotations');
      this.schedule();
    }
  }

  private schedule(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const names = [...this.dirty];
      this.dirty.clear();
      names.forEach((n) => this.drawNow(n));
    });
  }

  private drawNow(name: SurfaceName): void {
    if (name === 'sleeve') return;
    const s = this.extra.get(name);
    if (!s) return;
    const art = this.art ?? { name: '', colour: '#D7263D', style: 'wide' as const, logo: null };
    const mode: LabelMode = this.art ? 'final' : 'blank';
    if (name === 'proof') {
      drawLabel(s.ctx, s.width, s.height, { layout: 'sleeve', mode: this.art ? 'proof' : 'blank', art });
    } else if (name === 'annotations') {
      drawAnnotations(s.ctx, s.width, s.height, this.annotateT);
    } else if (name === 'bottle') {
      drawLabel(s.ctx, s.width, s.height, { layout: 'band', mode, art, volume: labelCopy.bottleVolume });
    } else if (name === 'jar') {
      drawLabel(s.ctx, s.width, s.height, { layout: 'band', mode, art, volume: labelCopy.jarVolume });
    } else if (name === 'box') {
      drawLabel(s.ctx, s.width, s.height, { layout: 'box-top', mode, art });
    }
    this.touch(name);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.listeners.clear();
    this.extra.forEach((s) => {
      s.canvas.width = 0;
      s.canvas.height = 0;
    });
    this.extra.clear();
  }
}
