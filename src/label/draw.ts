/**
 * The label renderer: pure 2D canvas drawing from a brand's artwork settings.
 *
 * Layouts: sleeve (wraps the can, u runs around, seam at u = 0/1, front at u = 0.5),
 * band (bottle and jar), box-top (1:1 mailer box decal).
 * Modes: blank (unprinted aluminium with proof marks), proof (artwork with printer's
 * marks), final (artwork only).
 */
import { labelCopy, tryIt } from '../content';
import type { LabelStyle, Logo } from '../lib/brand';
import { pickInk } from '../lib/contrast';
import { SLEEVE_MM } from '../stage/dims';
import { barcodeFor } from './barcode';
import { fitText, type Measure } from './fit';
import { FONTS, fontFor, setFont, type FontSpec } from './fonts';

export type LabelLayout = 'sleeve' | 'band' | 'box-top';
export type LabelMode = 'blank' | 'proof' | 'final';

export interface LabelArt {
  name: string;
  colour: string;
  style: LabelStyle;
  logo: Logo | null;
}

export interface DrawParams {
  layout: LabelLayout;
  mode: LabelMode;
  art: LabelArt;
  /** Volume line for band labels, e.g. "750 mL". */
  volume?: string;
}

export const K = '#231F20';
/** Unprinted aluminium, matched to the can body under studio light. */
export const ALU = '#D3D6D9';
const PROOF_PAPER = '#FAFAF7';
const PROCESS = ['#00AEEF', '#EC008C', '#FFF200', '#231F20'];
const TINTS = ['#80D7F7', '#F680C6', '#FFF980', '#918F8F'];

type Ctx = CanvasRenderingContext2D;

// ---------- Helpers ----------

export function measurer(ctx: Ctx, font: FontSpec): Measure {
  return (text, size) => {
    setFont(ctx, font, size);
    return ctx.measureText(text).width;
  };
}

const CAP = { archivo: 0.72, fraunces: 0.68 };
const capOf = (f: FontSpec) => (f.family.includes('Fraunces') ? CAP.fraunces : CAP.archivo);

/** Displays a name the way the style sets it: capitals for Wide and Tall, as typed for Classic. */
export function setName(name: string, style: LabelStyle): string {
  return style === 'classic' ? name : name.toLocaleUpperCase('en');
}

/** Draws fitted lines centred on (cx, cy), with caps optically centred. */
function drawFitted(
  ctx: Ctx,
  text: string,
  font: FontSpec,
  cx: number,
  cy: number,
  boxW: number,
  boxH: number,
  maxLines: number,
  colour: string,
  lineHeight = 0.9,
): number {
  const fit = fitText(text, boxW, boxH, measurer(ctx, font), { lineHeight, maxLines });
  if (!fit.lines.length) return 0;
  const s = fit.size;
  const cap = capOf(font) * s;
  const block = cap + (fit.lines.length - 1) * s * lineHeight;
  let y = cy - block / 2 + cap;
  setFont(ctx, font, s);
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const line of fit.lines) {
    ctx.fillText(line, cx, y);
    y += s * lineHeight;
  }
  return s;
}

function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function smallPrint(
  ctx: Ctx,
  paragraphs: string[],
  x: number,
  y: number,
  maxW: number,
  size: number,
  colour: string,
  align: CanvasTextAlign = 'left',
): number {
  setFont(ctx, FONTS.small, size);
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  let yy = y;
  for (const p of paragraphs) {
    for (const line of wrap(ctx, p, maxW)) {
      ctx.fillText(line, x, yy);
      yy += size * 1.28;
    }
    yy += size * 0.45;
  }
  return yy;
}

function drawLogo(ctx: Ctx, logo: Logo, cx: number, cy: number, maxW: number, maxH: number): void {
  const scale = Math.min(maxW / logo.width, maxH / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  ctx.drawImage(logo.image, cx - w / 2, cy - h / 2, w, h);
}

export function drawBarcode(ctx: Ctx, name: string, x: number, y: number, w: number, h: number): void {
  const code = barcodeFor(name);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, w, h);
  const pad = w * 0.08;
  const total = code.modules.reduce((a, b) => a + b, 0);
  const mod = (w - pad * 2) / total;
  const barTop = y + h * 0.1;
  const barH = h * 0.62;
  const guardH = h * 0.7;
  let cx = x + pad;
  let el = 0;
  ctx.fillStyle = K;
  const guards = new Set([0, 2, 28, 30, 56, 58]);
  code.modules.forEach((m, i) => {
    if (i % 2 === 0) ctx.fillRect(cx, barTop, m * mod, guards.has(el) ? guardH : barH);
    cx += m * mod;
    el++;
  });
  const size = h * 0.16;
  setFont(ctx, FONTS.mark, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const baseline = y + h * 0.92;
  const half = (w - pad * 2) / 2;
  ctx.fillText(code.digits.slice(1, 7), x + pad + half * 0.5, baseline);
  ctx.fillText(code.digits.slice(7), x + pad + half * 1.5, baseline);
  ctx.textAlign = 'right';
  ctx.fillText(code.digits.slice(0, 1), x + pad * 0.85, baseline);
}

export function drawRegistration(ctx: Ctx, cx: number, cy: number, r: number, colour = K): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r * 1.6, cy);
  ctx.lineTo(cx + r * 1.6, cy);
  ctx.moveTo(cx, cy - r * 1.6);
  ctx.lineTo(cx, cy + r * 1.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Crop marks just outside the corners of a trim box. */
export function drawCropMarks(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  len: number,
  gap: number,
): void {
  ctx.save();
  ctx.strokeStyle = K;
  ctx.lineWidth = Math.max(1, len * 0.05);
  ctx.beginPath();
  for (const [px, sx] of [
    [x, -1],
    [x + w, 1],
  ] as const) {
    for (const [py, sy] of [
      [y, -1],
      [y + h, 1],
    ] as const) {
      ctx.moveTo(px + sx * gap, py);
      ctx.lineTo(px + sx * (gap + len), py);
      ctx.moveTo(px, py + sy * gap);
      ctx.lineTo(px, py + sy * (gap + len));
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Printer's colour control strip: solids then 50% tints. */
export function drawColourStrip(ctx: Ctx, x: number, y: number, patch: number): number {
  const all = [...PROCESS, ...TINTS];
  all.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + i * patch, y, patch, patch);
  });
  ctx.strokeStyle = K;
  ctx.lineWidth = Math.max(1, patch * 0.04);
  ctx.strokeRect(x, y, patch * all.length, patch);
  return patch * all.length;
}

// ---------- Sleeve ----------

function sleeveFinal(ctx: Ctx, w: number, h: number, art: LabelArt): void {
  const ink = pickInk(art.colour);
  ctx.fillStyle = art.colour;
  ctx.fillRect(0, 0, w, h);

  // Two hairline rules run all the way round, like a can's print bands.
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ink;
  const rule = Math.max(1, h * 0.005);
  ctx.fillRect(0, h * 0.075, w, rule);
  ctx.fillRect(0, h * 0.925 - rule, w, rule);
  ctx.globalAlpha = 1;

  // Front panel: logo (optional), name, volume.
  const cx = w * 0.5;
  const panelW = w * 0.3;
  let nameCy = h * 0.47;
  let nameH = h * 0.56;
  if (art.logo) {
    drawLogo(ctx, art.logo, cx, h * 0.24, panelW * 0.62, h * 0.2);
    nameCy = h * 0.56;
    nameH = h * 0.4;
  }
  const font = fontFor(art.style);
  drawFitted(
    ctx,
    setName(art.name, art.style),
    font,
    cx,
    nameCy,
    panelW,
    nameH,
    2,
    ink,
    art.style === 'classic' ? 0.95 : 0.88,
  );

  setFont(ctx, FONTS.smallBold, h * 0.052);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.fillText(labelCopy.volume, cx, h * 0.87);

  // Back left: the small print.
  const sp = h * 0.043;
  smallPrint(
    ctx,
    [labelCopy.ingredients, labelCopy.bestBefore, labelCopy.serving],
    w * 0.075,
    h * 0.27,
    w * 0.18,
    sp,
    ink,
  );

  // Back right: barcode and printer's line.
  const bx = w * 0.745;
  const bw = w * 0.17;
  drawBarcode(ctx, art.name, bx, h * 0.24, bw, bw * 0.62);
  smallPrint(ctx, [labelCopy.printedIn], bx, h * 0.24 + bw * 0.62 + sp * 1.9, bw, sp, ink);
}

function sleeveBlank(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = ALU;
  ctx.fillRect(0, 0, w, h);

  // Dieline: the trim outline, dashed at the seam overlap.
  const inset = h * 0.045;
  const lw = Math.max(1, h * 0.0022);
  ctx.strokeStyle = K;
  ctx.lineWidth = lw;
  ctx.setLineDash([h * 0.018, h * 0.012]);
  ctx.strokeRect(w * 0.012, inset, w * 0.976, h - inset * 2);
  ctx.setLineDash([]);

  drawCropMarks(ctx, w * 0.3, h * 0.13, w * 0.4, h * 0.74, h * 0.045, h * 0.018);
  drawRegistration(ctx, w * 0.5, h * 0.075, h * 0.018);
  drawRegistration(ctx, w * 0.5, h * 0.925, h * 0.018);

  const patch = h * 0.05;
  drawColourStrip(ctx, w * 0.72, h * 0.8, patch);

  drawFitted(ctx, tryIt.blankLabel, FONTS.wide, w * 0.5, h * 0.5, w * 0.27, h * 0.52, 3, K, 0.9);
}

function sleeveProof(ctx: Ctx, w: number, h: number, art: LabelArt): void {
  ctx.fillStyle = PROOF_PAPER;
  ctx.fillRect(0, 0, w, h);

  const slugY = h * 0.1;
  const slugX = w * 0.035;
  const trim = { x: slugX, y: slugY, w: w - slugX * 2, h: h - slugY * 2 };
  const bleed = h * 0.018;

  ctx.save();
  ctx.translate(trim.x - bleed, trim.y - bleed);
  ctx.beginPath();
  ctx.rect(0, 0, trim.w + bleed * 2, trim.h + bleed * 2);
  ctx.clip();
  // Artwork drawn to the bleed.
  ctx.translate(bleed, bleed);
  sleeveFinal(ctx, trim.w, trim.h, art);
  ctx.restore();

  const lw = Math.max(1, h * 0.002);
  ctx.strokeStyle = K;
  ctx.lineWidth = lw;
  ctx.strokeRect(trim.x, trim.y, trim.w, trim.h);
  ctx.setLineDash([h * 0.012, h * 0.008]);
  ctx.strokeRect(trim.x - bleed, trim.y - bleed, trim.w + bleed * 2, trim.h + bleed * 2);
  ctx.setLineDash([]);

  drawCropMarks(ctx, trim.x, trim.y, trim.w, trim.h, h * 0.04, bleed + h * 0.01);
  drawRegistration(ctx, w * 0.5, slugY * 0.45, h * 0.02);
  drawRegistration(ctx, w * 0.5, h - slugY * 0.45, h * 0.02);
  drawColourStrip(ctx, w * 0.7, slugY * 0.2, slugY * 0.5);

  const size = h * 0.034;
  setFont(ctx, FONTS.smallBold, size);
  ctx.fillStyle = K;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${labelCopy.proofTitle} 1: ${art.name}, ${labelCopy.volume} can`, trim.x, slugY * 0.45);

  // Dimension callouts: width along the bottom slug, height up the left slug.
  const dimY = h - slugY * 0.45;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(trim.x, dimY);
  ctx.lineTo(w * 0.44, dimY);
  ctx.moveTo(w * 0.56, dimY);
  ctx.lineTo(trim.x + trim.w, dimY);
  for (const x of [trim.x, trim.x + trim.w]) {
    ctx.moveTo(x, dimY - size * 0.5);
    ctx.lineTo(x, dimY + size * 0.5);
  }
  ctx.stroke();
  setFont(ctx, FONTS.small, size);
  ctx.textAlign = 'center';
  ctx.fillText(`${SLEEVE_MM.width} mm`, w * 0.5, dimY);

  ctx.save();
  ctx.translate(slugX * 0.45, h * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(`${SLEEVE_MM.height} mm`, 0, 0);
  ctx.restore();
}

// ---------- Band (bottle, jar) ----------

function bandFinal(ctx: Ctx, w: number, h: number, art: LabelArt, volume: string): void {
  const ink = pickInk(art.colour);
  ctx.fillStyle = art.colour;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = ink;
  const rule = Math.max(1, h * 0.008);
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, h * 0.1, w, rule);
  ctx.fillRect(0, h * 0.9 - rule, w, rule);
  ctx.globalAlpha = 1;
  const panelW = Math.min(w * 0.62, h * 1.9);
  let cy = h * 0.46;
  let boxH = h * 0.5;
  if (art.logo) {
    drawLogo(ctx, art.logo, w / 2, h * 0.3, panelW * 0.4, h * 0.2);
    cy = h * 0.56;
    boxH = h * 0.36;
  }
  drawFitted(ctx, setName(art.name, art.style), fontFor(art.style), w / 2, cy, panelW, boxH, 2, ink, 0.88);
  setFont(ctx, FONTS.smallBold, h * 0.075);
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.fillText(volume, w / 2, h * 0.84);
}

function bandBlank(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = PROOF_PAPER;
  ctx.fillRect(0, 0, w, h);
  drawFitted(ctx, tryIt.blankLabel, FONTS.wide, w / 2, h / 2, Math.min(w * 0.6, h * 1.8), h * 0.5, 3, K);
}

// ---------- Box top ----------

function boxTop(ctx: Ctx, w: number, h: number, art: LabelArt, blank: boolean): void {
  ctx.clearRect(0, 0, w, h);
  const m = w * 0.07;
  const colour = blank ? PROOF_PAPER : art.colour;
  const ink = blank ? K : pickInk(art.colour);
  ctx.fillStyle = colour;
  ctx.fillRect(m, m, w - m * 2, h - m * 2);
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.strokeRect(m * 1.6, m * 1.6, w - m * 3.2, h - m * 3.2);
  ctx.globalAlpha = 1;
  const text = blank ? tryIt.blankLabel : setName(art.name, art.style);
  let cy = h * 0.47;
  let boxH = h * 0.42;
  if (!blank && art.logo) {
    drawLogo(ctx, art.logo, w / 2, h * 0.3, w * 0.4, h * 0.18);
    cy = h * 0.56;
    boxH = h * 0.3;
  }
  drawFitted(ctx, text, blank ? FONTS.wide : fontFor(art.style), w / 2, cy, w * 0.66, boxH, 3, ink, 0.9);
  smallPrint(ctx, [labelCopy.boxNote], w / 2, h * 0.82, w * 0.66, h * 0.034, ink, 'center');
}

// ---------- Entry points ----------

export function drawLabel(ctx: Ctx, w: number, h: number, p: DrawParams): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.setLineDash([]);
  if (p.layout === 'sleeve') {
    if (p.mode === 'blank') sleeveBlank(ctx, w, h);
    else if (p.mode === 'proof') sleeveProof(ctx, w, h, p.art);
    else sleeveFinal(ctx, w, h, p.art);
  } else if (p.layout === 'band') {
    if (p.mode === 'blank') bandBlank(ctx, w, h);
    else bandFinal(ctx, w, h, p.art, p.volume ?? labelCopy.bottleVolume);
  } else {
    boxTop(ctx, w, h, p.art, p.mode === 'blank');
  }
  ctx.restore();
}

/** The unprinted aluminium the print run lays its plates over. */
export function drawBase(ctx: Ctx, w: number, h: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = ALU;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Trim, bleed and seam annotations for the flat dieline (S4 "Design" beat), drawn on a
 * transparent canvas. `t` (0–1) draws the lines in.
 */
export function drawAnnotations(ctx: Ctx, w: number, h: number, t: number): void {
  ctx.clearRect(0, 0, w, h);
  if (t <= 0) return;
  const lw = Math.max(1.5, h * 0.004);
  const size = h * 0.04;
  ctx.save();
  ctx.strokeStyle = K;
  ctx.fillStyle = K;
  ctx.lineWidth = lw;
  const trimInset = h * 0.06;
  const draw = (k: number) => Math.min(1, Math.max(0, t * 3 - k));

  // Trim: a rectangle drawn clockwise.
  const tr = draw(0);
  if (tr > 0) {
    const x = w * 0.02;
    const y = trimInset;
    const rw = w * 0.96;
    const rh = h - trimInset * 2;
    const per = 2 * (rw + rh);
    let len = per * tr;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs: Array<[number, number, number]> = [
      [rw, 1, 0],
      [rh, 0, 1],
      [rw, -1, 0],
      [rh, 0, -1],
    ];
    let px = x;
    let py = y;
    for (const [l, dx, dy] of segs) {
      const d = Math.min(l, len);
      px += dx * d;
      py += dy * d;
      ctx.lineTo(px, py);
      len -= d;
      if (len <= 0) break;
    }
    ctx.stroke();
    ctx.globalAlpha = tr;
    setFont(ctx, FONTS.smallBold, size);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(labelCopy.trim, x + size * 0.4, y - size * 0.3);
    ctx.globalAlpha = 1;
  }

  // Bleed: dashed rectangle outside the trim.
  const bl = draw(1);
  if (bl > 0) {
    ctx.globalAlpha = bl;
    ctx.setLineDash([size * 0.5, size * 0.35]);
    ctx.strokeRect(w * 0.008, trimInset * 0.4, w * 0.984, h - trimInset * 0.8);
    ctx.setLineDash([]);
    setFont(ctx, FONTS.smallBold, size);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(labelCopy.bleed, w * 0.98, trimInset * 0.4 - size * 0.2 + size);
    ctx.globalAlpha = 1;
  }

  // Seam: the two edges that meet at the back of the can.
  const sm = draw(2);
  if (sm > 0) {
    ctx.globalAlpha = sm;
    ctx.lineWidth = lw * 1.4;
    ctx.setLineDash([size * 0.25, size * 0.25]);
    ctx.beginPath();
    ctx.moveTo(w * 0.035, h * 0.5 - h * 0.3 * sm);
    ctx.lineTo(w * 0.035, h * 0.5 + h * 0.3 * sm);
    ctx.moveTo(w * 0.965, h * 0.5 - h * 0.3 * sm);
    ctx.lineTo(w * 0.965, h * 0.5 + h * 0.3 * sm);
    ctx.stroke();
    ctx.setLineDash([]);
    setFont(ctx, FONTS.smallBold, size);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(labelCopy.seam, w * 0.045, h * 0.5);
    ctx.textAlign = 'right';
    ctx.fillText(labelCopy.seam, w * 0.955, h * 0.5);
  }
  ctx.restore();
}
