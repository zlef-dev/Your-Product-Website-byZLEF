/** Pure validation rules for the brief form. Messages come from content.ts. */
import { brief } from '../content';

export type FieldName =
  | 'brand'
  | 'current'
  | 'does'
  | 'need'
  | 'goal'
  | 'budget'
  | 'timeline'
  | 'notes'
  | 'name'
  | 'email'
  | 'based'
  | 'assets';

/** Which fields each of the four steps owns, in order. */
export const STEP_FIELDS: FieldName[][] = [
  ['brand', 'current', 'does'],
  ['need', 'goal'],
  ['budget', 'timeline', 'notes'],
  ['name', 'email', 'based', 'assets'],
];

export const GOAL_MAX = brief.fields.goalMax;

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export function isEmail(s: string): boolean {
  return s.length <= 254 && EMAIL.test(s);
}

/** Accepts full URLs, bare domains with an optional path, and @handles. */
export function isLinkOrHandle(s: string, allowHandle = true): boolean {
  if (allowHandle && /^@[a-z0-9._]{1,30}$/i.test(s)) return true;
  if (/\s/.test(s)) return false;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(u.hostname);
  } catch {
    return false;
  }
}

export type FieldValue = string | string[];

/** Returns the error message for a field, or null when it is valid. */
export function validateField(name: FieldName, value: FieldValue): string | null {
  const v = Array.isArray(value) ? value : value.trim();
  const e = brief.errors;
  switch (name) {
    case 'brand':
      return v.length ? null : e.brand;
    case 'current':
      return !v.length || isLinkOrHandle(v as string) ? null : e.url;
    case 'does':
      return v.length ? null : e.does;
    case 'need':
      return v.length ? null : e.need;
    case 'goal':
      if (!v.length) return e.goal;
      return Array.from(v as string).length > GOAL_MAX ? e.goalLong : null;
    case 'budget':
      return v.length ? null : e.budget;
    case 'timeline':
      return v.length ? null : e.timeline;
    case 'name':
      return v.length ? null : e.name;
    case 'email':
      if (!v.length) return e.email;
      return isEmail(v as string) ? null : e.emailInvalid;
    case 'assets':
      return !v.length || isLinkOrHandle(v as string, false) ? null : e.assetsUrl;
    case 'notes':
    case 'based':
      return null;
  }
}
