/**
 * Optional logo: PNG, JPG or WebP up to 5 MB, read locally through an object URL.
 * SVG is refused so the label canvas never becomes tainted (download and plate
 * separation both need clean pixel access). Nothing is uploaded anywhere.
 */
import type { Logo } from '../lib/brand';

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export class LogoError extends Error {
  constructor(public readonly code: 'type' | 'size' | 'unreadable') {
    super(code);
  }
}

export async function loadLogo(file: File, maxBytes: number): Promise<Logo> {
  if (!LOGO_TYPES.includes(file.type)) throw new LogoError('type');
  if (file.size > maxBytes) throw new LogoError('size');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new LogoError('unreadable');
    // Rasterise once at a sensible size; the object URL can then be released.
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new LogoError('unreadable');
    ctx.drawImage(img, 0, 0, w, h);
    return { image: canvas, width: w, height: h };
  } catch (err) {
    throw err instanceof LogoError ? err : new LogoError('unreadable');
  } finally {
    URL.revokeObjectURL(url);
  }
}
