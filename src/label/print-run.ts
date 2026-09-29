/**
 * Signature moment 1, the print run. The finished artwork is separated into C, M, Y and K
 * plates (in a worker), then over ~1.1 s each plate slides onto the unprinted aluminium
 * slightly out of register, and all four snap into register with the `press` ease.
 * Finally the exact original artwork swaps in so the colours are faithful.
 *
 * The timeline is a pure function of progress; the 3D stage composites plates in the
 * label shader and the 2D fallback composites them on a canvas.
 */
import { clamp01, glide, press, span } from '../lib/ease';
import type { Plates } from './cmyk';
import type { LabelArt } from './draw';
import { separatePlates } from './separate';
import type { LabelSurfaces } from './surfaces';

export const PRINT_MS = 1100;
const PLATE_WIDTH = 1024;

/** Where each plate lands out of register, in px at a 2048 px wide sleeve (C, M, Y, K). */
const MISREGISTER: Array<[number, number]> = [
  [-9, 4],
  [11, -5],
  [-6, -10],
  [8, 7],
];
/** Plates feed in from the left of the sheet. */
const FEED = 90;
const STAGGER = 0.15;
const INK_IN = 0.44;
const SNAP_START = 0.84;
const FINAL_START = 0.9;

export interface PlateFrame {
  /** Opacity of C, M, Y, K. */
  alpha: [number, number, number, number];
  /** Offsets in px for a sleeve `width` wide. */
  offset: Array<[number, number]>;
  /** 0 = plates over bare aluminium, 1 = exact original artwork. */
  final: number;
  /** How far the sleeve has gone from bare metal to inked. */
  ink: number;
}

export function printFrame(t: number, width: number): PlateFrame {
  const scale = width / 2048;
  const snap = press(span(t, SNAP_START, 1));
  const alpha = [0, 0, 0, 0] as [number, number, number, number];
  const offset: Array<[number, number]> = [];
  for (let i = 0; i < 4; i++) {
    const start = i * STAGGER;
    const local = span(t, start, start + INK_IN);
    alpha[i] = clamp01(local / 0.55);
    const slide = 1 - glide(local);
    const [mx, my] = MISREGISTER[i] ?? [0, 0];
    offset.push([(mx - FEED * slide) * scale * (1 - snap), my * scale * (1 - snap)]);
  }
  return { alpha, offset, final: span(t, FINAL_START, 1), ink: clamp01(t / FINAL_START) };
}

export interface PrintTarget {
  surfaces: LabelSurfaces;
  /** 0 = bare aluminium label stock, 1 = fully inked. */
  setInk(v: number): void;
  /** Keeps the render loop running while the print run animates. */
  hold(on: boolean): void;
  /** Start printing: show bare stock, then these plates as they arrive (null = done). */
  showPlates?(plates: Plates | null, width: number, height: number): void;
  setPlateFrame?(frame: PlateFrame): void;
}

export class Printer {
  private run = 0;

  constructor(private readonly target: PrintTarget) {}

  /** Resolves when the artwork is on the can. A newer print supersedes an older one. */
  async print(art: LabelArt, opts: { instant?: boolean } = {}): Promise<void> {
    const id = ++this.run;
    const t = this.target;
    const s = t.surfaces;
    await s.setArt(art);
    if (id !== this.run) return;

    const animate = !opts.instant && !!t.showPlates && !!t.setPlateFrame;
    if (!animate) {
      t.showPlates?.(null, 0, 0);
      s.drawSleeve('final');
      t.setInk(1);
      return;
    }

    // Blank the stock first so the finished artwork never flashes before the plates.
    const start = printFrame(0, s.sleeve.width);
    t.setPlateFrame!(start);
    t.setInk(0);
    s.drawSleeve('final');
    // Plates run at most 1024 px wide: they're on screen for a second, moving, and a quarter
    // of the pixels keeps separation and upload off the frame budget. The exact full-size
    // artwork swaps in at the end.
    const pw = Math.min(PLATE_WIDTH, s.sleeve.width);
    const ph = Math.round((s.sleeve.height * pw) / s.sleeve.width);
    const small = document.createElement('canvas');
    small.width = pw;
    small.height = ph;
    const sctx = small.getContext('2d', { willReadFrequently: true })!;
    sctx.drawImage(s.sleeve.canvas, 0, 0, pw, ph);
    const plates = await separatePlates(sctx.getImageData(0, 0, pw, ph).data);
    if (id !== this.run) return;
    t.showPlates!(plates, pw, ph);

    t.hold(true);
    await new Promise<void>((resolve) => {
      const t0 = performance.now();
      const step = (now: number) => {
        if (id !== this.run) {
          resolve();
          return;
        }
        const p = Math.min(1, (now - t0) / PRINT_MS);
        const frame = printFrame(p, s.sleeve.width);
        t.setPlateFrame!(frame);
        t.setInk(frame.ink);
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    t.hold(false);
    if (id !== this.run) return;
    t.showPlates!(null, 0, 0);
    t.setInk(1);
  }
}
