/**
 * Fits a brand name into a box: tries one, two (and optionally three) lines, breaking
 * only between words, and keeps whichever layout gives the largest type. The measuring
 * function is injected so fitting can be tested without a canvas.
 */

/** Width of `text` set at `size` px. Canvas text width scales linearly with size. */
export type Measure = (text: string, size: number) => number;

export interface FitOptions {
  /** Line height as a multiple of font size. */
  lineHeight: number;
  maxLines: number;
  maxSize?: number;
}

export interface FitResult {
  lines: string[];
  size: number;
}

const REF = 100;

/** All ways to split `words` into exactly `n` non-empty lines, in order. */
function splits(words: string[], n: number): string[][] {
  if (n === 1) return [[words.join(' ')]];
  const out: string[][] = [];
  for (let i = 1; i <= words.length - n + 1; i++) {
    const head = words.slice(0, i).join(' ');
    for (const rest of splits(words.slice(i), n - 1)) out.push([head, ...rest]);
  }
  return out;
}

export function fitText(
  text: string,
  maxWidth: number,
  maxHeight: number,
  measure: Measure,
  opts: FitOptions,
): FitResult {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || maxWidth <= 0 || maxHeight <= 0) return { lines: [], size: 0 };

  const cache = new Map<string, number>();
  const width = (line: string) => {
    let w = cache.get(line);
    if (w === undefined) {
      w = measure(line, REF) / REF;
      cache.set(line, w);
    }
    return w;
  };

  let best: FitResult = { lines: [words.join(' ')], size: 0 };
  const maxLines = Math.max(1, Math.min(opts.maxLines, words.length));
  for (let n = 1; n <= maxLines; n++) {
    for (const lines of splits(words, n)) {
      const widest = Math.max(...lines.map(width));
      const byWidth = widest > 0 ? maxWidth / widest : Infinity;
      const byHeight = maxHeight / (n * opts.lineHeight);
      const size = Math.min(byWidth, byHeight, opts.maxSize ?? Infinity);
      // Strictly larger wins, so ties keep the layout with fewer lines.
      if (size > best.size + 0.01) best = { lines, size };
    }
  }
  return { lines: best.lines, size: Math.floor(best.size * 100) / 100 };
}
