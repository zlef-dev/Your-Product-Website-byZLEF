/**
 * "Download your can": frames a rendered can as a proof card (paper, crop marks, a
 * caption) and encodes it as PNG. Shared by the 3D stage and the 2D fallback.
 */
import { labelCopy } from '../content';
import { drawCropMarks } from '../label/draw';
import { FONTS, setFont } from '../label/fonts';

export const CARD = { width: 1200, height: 1500 };

export function composeCard(can: CanvasImageSource, brandName: string): HTMLCanvasElement {
  const { width: w, height: h } = CARD;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#F1F2EE';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(can, 0, 0, w, h);

  const m = 70;
  drawCropMarks(ctx, m, m, w - m * 2, h - m * 2, 34, 12);

  ctx.fillStyle = '#231F20';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  setFont(ctx, FONTS.wide, 54);
  let size = 54;
  while (size > 24 && ctx.measureText(brandName).width > w - m * 2 - 40) {
    size -= 2;
    setFont(ctx, FONTS.wide, size);
  }
  ctx.fillText(brandName, m + 20, h - m - 72);
  setFont(ctx, FONTS.small, 26);
  ctx.fillText(`${labelCopy.volume} can. ${labelCopy.printedIn}.`, m + 20, h - m - 30);
  return out;
}

export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png');
  });
}
