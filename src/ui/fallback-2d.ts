/**
 * No-WebGL fallback: an SVG can silhouette with the label drawn flat inside it through a
 * cylindrical projection (so turning still works). The try-it controls, the print run
 * (composited on a canvas from the same plate timeline) and download all keep working.
 */
import { tryIt } from '../content';
import type { BrandState, Finish } from '../lib/brand';
import { $ } from '../lib/dom';
import { ALU } from '../label/draw';
import { Printer, type PlateFrame } from '../label/print-run';
import { LabelSurfaces, toArt } from '../label/surfaces';
import type { Plates } from '../label/cmyk';
import { CARD, composeCard, toPng } from './card';
import type { CanView } from './tryit';

/** Can outline in 0.1 mm units: 66 mm wide, 122 mm tall. */
const W = 660;
const H = 1220;
const WALL_TOP = 118;
const WALL_BOTTOM = 1102;
export const CAN_PATH =
  'M120 12H540Q560 12 562 30L570 60Q640 90 660 118V1102Q660 1140 640 1165L610 1200Q590 1220 560 1220H100Q70 1220 50 1200L20 1165Q0 1140 0 1102V118Q20 90 90 60L98 30Q100 12 120 12Z';

const METAL = [
  [0, '#8F959A'],
  [0.12, '#D9DDE0'],
  [0.3, '#F4F5F6'],
  [0.46, '#B7BCC1'],
  [0.62, '#E9EBED'],
  [0.82, '#C3C7CB'],
  [1, '#81878C'],
] as const;

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

let uid = 0;

/** One can on the page (hero, try-it). */
class CanElement {
  readonly root = document.createElement('div');
  readonly canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;

  constructor(slot: HTMLElement) {
    const id = `can-metal-${++uid}`;
    this.root.className = 'fallback-can';
    this.root.setAttribute('aria-hidden', 'true');
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fallback-can__body' });
    const defs = svg('defs', {});
    const grad = svg('linearGradient', { id, x1: '0', x2: '1', y1: '0', y2: '0' });
    METAL.forEach(([o, c]) => grad.append(svg('stop', { offset: String(o), 'stop-color': c })));
    const shade = svg('linearGradient', { id: `${id}-shade`, x1: '0', x2: '1', y1: '0', y2: '0' });
    [
      [0, 'rgba(35,31,32,0.34)'],
      [0.22, 'rgba(35,31,32,0.04)'],
      [0.32, 'rgba(255,255,255,0.28)'],
      [0.4, 'rgba(255,255,255,0)'],
      [0.75, 'rgba(35,31,32,0.06)'],
      [1, 'rgba(35,31,32,0.4)'],
    ].forEach(([o, c]) => shade.append(svg('stop', { offset: String(o), 'stop-color': String(c) })));
    defs.append(grad, shade);
    s.append(defs, svg('path', { d: CAN_PATH, fill: `url(#${id})` }));
    s.append(
      svg('ellipse', {
        cx: '330',
        cy: '22',
        rx: '218',
        ry: '12',
        fill: 'none',
        stroke: '#8F959A',
        'stroke-width': '6',
      }),
    );
    const over = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fallback-can__shade' });
    over.append(
      svg('rect', {
        x: '0',
        y: String(WALL_TOP),
        width: String(W),
        height: String(WALL_BOTTOM - WALL_TOP),
        fill: `url(#${id}-shade)`,
      }),
    );
    this.canvas.className = 'fallback-can__label';
    this.canvas.width = 440;
    this.canvas.height = Math.round((440 * (WALL_BOTTOM - WALL_TOP)) / W);
    this.ctx = this.canvas.getContext('2d')!;
    this.root.append(s, this.canvas, over);
    slot.append(this.root);
  }

  draw(label: CanvasImageSource, lw: number, lh: number, turn: number): void {
    projectLabel(this.ctx, this.canvas.width, this.canvas.height, label, lw, lh, turn);
  }
}

/** Draws the visible half of a wrapped label: output column x shows angle asin(x / r). */
export function projectLabel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  label: CanvasImageSource,
  lw: number,
  lh: number,
  turnDeg: number,
): void {
  ctx.clearRect(0, 0, w, h);
  const columns = Math.min(w, 220);
  const colW = w / columns;
  for (let i = 0; i < columns; i++) {
    const x = ((i + 0.5) / columns) * 2 - 1;
    const theta = Math.asin(Math.max(-1, Math.min(1, x)));
    let u = 0.5 + theta / (2 * Math.PI) - turnDeg / 360;
    u = ((u % 1) + 1) % 1;
    const sx = Math.min(lw - 1, Math.floor(u * lw));
    const span = Math.max(1, Math.ceil(lw / (Math.PI * 2 * (columns / 2)) / Math.max(0.2, Math.cos(theta))));
    ctx.drawImage(label, sx, 0, Math.min(span, lw - sx), lh, i * colW, 0, colW + 0.6, h);
  }
}

/** A full can (silhouette, metal, projected label, shading) drawn on a 2D canvas, for download. */
function drawCan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  label: HTMLCanvasElement,
  turn: number,
) {
  const scale = h / H;
  ctx.save();
  ctx.translate(x - (W * scale) / 2, y);
  ctx.scale(scale, scale);
  const path = new Path2D(CAN_PATH);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  METAL.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fill(path);
  const tmp = document.createElement('canvas');
  tmp.width = W;
  tmp.height = WALL_BOTTOM - WALL_TOP;
  projectLabel(tmp.getContext('2d')!, tmp.width, tmp.height, label, label.width, label.height, turn);
  ctx.drawImage(tmp, 0, WALL_TOP);
  const s = ctx.createLinearGradient(0, 0, W, 0);
  s.addColorStop(0, 'rgba(35,31,32,0.34)');
  s.addColorStop(0.32, 'rgba(255,255,255,0.22)');
  s.addColorStop(0.4, 'rgba(255,255,255,0)');
  s.addColorStop(1, 'rgba(35,31,32,0.4)');
  ctx.fillStyle = s;
  ctx.fillRect(0, WALL_TOP, W, WALL_BOTTOM - WALL_TOP);
  ctx.restore();
}

export async function startFallback(): Promise<CanView> {
  document.documentElement.classList.add('no-webgl');
  const surfaces = new LabelSurfaces(1024);
  await surfaces.setArt(null);
  surfaces.drawSleeve('blank');

  const cans = ['top', 'try']
    .map((id) => $(`[data-slot="${id}"]`))
    .filter((el): el is HTMLElement => !!el)
    .map((slot) => new CanElement(slot));

  // S4 shows the flat dieline.
  const dieline = $('[data-slot="process"]');
  let dielineCanvas: HTMLCanvasElement | null = null;
  if (dieline) {
    dielineCanvas = document.createElement('canvas');
    dielineCanvas.className = 'fallback-dieline';
    dielineCanvas.setAttribute('aria-hidden', 'true');
    dielineCanvas.width = surfaces.sleeve.width;
    dielineCanvas.height = surfaces.sleeve.height;
    dieline.append(dielineCanvas);
  }

  // What the cans show: the sleeve, or the print run's composite while it plays.
  const display = document.createElement('canvas');
  display.width = surfaces.sleeve.width;
  display.height = surfaces.sleeve.height;
  const dctx = display.getContext('2d')!;
  let printing = false;
  let turn = 0;
  let plateCanvases: HTMLCanvasElement[] = [];

  const redraw = () => {
    const src = printing ? display : surfaces.sleeve.canvas;
    cans.forEach((c) => c.draw(src, display.width, display.height, turn));
    if (dielineCanvas && !printing) dielineCanvas.getContext('2d')!.drawImage(surfaces.sleeve.canvas, 0, 0);
  };
  surfaces.onChange((name) => {
    if (name === 'sleeve') redraw();
  });
  redraw();

  const printer = new Printer({
    surfaces,
    setInk: () => undefined,
    hold: () => undefined,
    showPlates(plates: Plates | null, w: number, h: number) {
      if (!plates) {
        printing = false;
        plateCanvases = [];
        redraw();
        return;
      }
      plateCanvases = (['c', 'm', 'y', 'k'] as const).map((n) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const img = new ImageData(w, h);
        img.data.set(plates[n]);
        c.getContext('2d')!.putImageData(img, 0, 0);
        return c;
      });
    },
    setPlateFrame(f: PlateFrame) {
      printing = true;
      dctx.globalCompositeOperation = 'source-over';
      dctx.globalAlpha = 1;
      dctx.fillStyle = ALU;
      dctx.fillRect(0, 0, display.width, display.height);
      dctx.globalCompositeOperation = 'multiply';
      plateCanvases.forEach((c, i) => {
        const a = f.alpha[i] ?? 0;
        if (a <= 0) return;
        dctx.globalAlpha = a;
        const [dx, dy] = f.offset[i] ?? [0, 0];
        dctx.drawImage(c, dx, dy);
      });
      dctx.globalCompositeOperation = 'source-over';
      if (f.final > 0) {
        dctx.globalAlpha = f.final;
        dctx.drawImage(surfaces.sleeve.canvas, 0, 0);
      }
      dctx.globalAlpha = 1;
      redraw();
    },
  });

  let printedName = '';
  let lastPrint: Promise<void> = Promise.resolve();
  return {
    print(state: Readonly<BrandState>, o) {
      printedName = state.name;
      lastPrint = printer.print(toArt(state), { instant: o?.instant });
      return lastPrint;
    },
    setFinish: (_f: Finish) => undefined,
    turn(deg: number) {
      turn += deg;
      redraw();
    },
    rotation: () => ((Math.round(turn) % 360) + 360) % 360,
    async snapshot() {
      await lastPrint;
      const c = document.createElement('canvas');
      c.width = CARD.width;
      c.height = CARD.height;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#F1F2EE';
      ctx.fillRect(0, 0, c.width, c.height);
      const shadow = ctx.createRadialGradient(600, 1180, 0, 600, 1180, 330);
      shadow.addColorStop(0, 'rgba(35,31,32,0.28)');
      shadow.addColorStop(1, 'rgba(35,31,32,0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(200, 1080, 800, 200);
      drawCan(ctx, 600, 230, 960, surfaces.sleeve.canvas, turn);
      return toPng(composeCard(c, printedName || tryIt.sampleName));
    },
  };
}
