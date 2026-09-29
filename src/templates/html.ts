/** Tiny escaping template helper used at build time to render static HTML from content.ts. */

export interface Raw {
  readonly __raw: string;
}

export const raw = (s: string): Raw => ({ __raw: s });

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}

function render(v: unknown): string {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (typeof v === 'object' && '__raw' in (v as object)) return (v as Raw).__raw;
  return esc(String(v));
}

/** Interpolated values are escaped unless wrapped with raw() or produced by html``. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = strings[0] ?? '';
  values.forEach((v, i) => {
    out += render(v) + (strings[i + 1] ?? '');
  });
  return raw(out);
}

export const attr = (cond: boolean, name: string, value = ''): Raw =>
  raw(cond ? (value ? ` ${name}="${esc(value)}"` : ` ${name}`) : '');
