/**
 * Everything a visitor types is plain text: trimmed, length-capped, and stripped of
 * control characters. Render it with textContent only.
 */

// C0 and C1 control characters, plus bidi overrides that could spoof text direction.
// Matching control characters is the whole point of these two patterns.
/* eslint-disable no-control-regex */
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;
const CONTROL_ALL = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;

/** Caps by code points so an emoji or surrogate pair is never cut in half. */
export function capLength(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join('') : s;
}

/** Single-line text: control characters removed, whitespace runs collapsed, trimmed, capped. */
export function cleanLine(input: unknown, max: number): string {
  const s = String(input ?? '')
    .replace(CONTROL_ALL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return capLength(s, max).trim();
}

/** Multi-line text: keeps line breaks (at most two in a row), removes other control characters. */
export function cleanMultiline(input: unknown, max: number): string {
  const s = String(input ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_EXCEPT_NEWLINE, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return capLength(s, max).trim();
}

/** A string safe to use as a file name. */
export function slugify(input: string, fallback = 'your-brand'): string {
  const s = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || fallback;
}
