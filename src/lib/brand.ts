/**
 * BrandState: the visitor's label. One store, many subscribers (label renderer,
 * takeover, form prefill). Kept in sessionStorage for this session only; the logo
 * never leaves memory.
 */
import { normaliseHex } from './contrast';
import { cleanLine } from './sanitize';

export type Finish = 'gloss' | 'satin' | 'matte';
export type LabelStyle = 'wide' | 'tall' | 'classic';

export interface Logo {
  image: CanvasImageSource;
  width: number;
  height: number;
}

export interface BrandState {
  name: string;
  colour: string;
  finish: Finish;
  style: LabelStyle;
  logo: Logo | null;
}

export interface BrandMeta {
  /** The visitor set something themselves (not the sample print). */
  personalised: boolean;
}

export type BrandChange = Partial<Record<keyof BrandState | 'personalised', boolean>>;
type Listener = (state: Readonly<BrandState>, meta: Readonly<BrandMeta>, changed: BrandChange) => void;

export const NAME_MAX = 32;
export const DEFAULT_COLOUR = '#D7263D';
const KEY = 'iybh:brand';
const FINISHES: Finish[] = ['gloss', 'satin', 'matte'];
const STYLES: LabelStyle[] = ['wide', 'tall', 'classic'];

export const cleanBrandName = (s: string) => cleanLine(s, NAME_MAX);

function initial(): { state: BrandState; meta: BrandMeta } {
  const state: BrandState = { name: '', colour: DEFAULT_COLOUR, finish: 'gloss', style: 'wide', logo: null };
  const meta: BrandMeta = { personalised: false };
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<BrandState & BrandMeta>;
      if (typeof saved.name === 'string') state.name = cleanBrandName(saved.name);
      const hex = typeof saved.colour === 'string' ? normaliseHex(saved.colour) : null;
      if (hex) state.colour = hex;
      if (FINISHES.includes(saved.finish as Finish)) state.finish = saved.finish as Finish;
      if (STYLES.includes(saved.style as LabelStyle)) state.style = saved.style as LabelStyle;
      meta.personalised = saved.personalised === true;
    }
  } catch {
    // Storage can be unavailable (private mode, blocked). The session simply won't persist.
  }
  return { state, meta };
}

function createStore() {
  const { state, meta } = initial();
  const listeners = new Set<Listener>();

  const persist = () => {
    try {
      const { name, colour, finish, style } = state;
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ name, colour, finish, style, personalised: meta.personalised }),
      );
    } catch {
      // Ignore: see initial().
    }
  };

  return {
    get: (): Readonly<BrandState> => state,
    meta: (): Readonly<BrandMeta> => meta,
    /** Visitor edits pass personalised: true; the sample print passes false. */
    set(patch: Partial<BrandState>, opts: { personalised?: boolean } = {}) {
      const changed: BrandChange = {};
      (Object.keys(patch) as Array<keyof BrandState>).forEach((k) => {
        let v = patch[k];
        if (k === 'name') v = cleanBrandName(String(v ?? ''));
        if (k === 'colour') v = normaliseHex(String(v ?? '')) ?? state.colour;
        if (state[k] !== v) {
          (state as unknown as Record<string, unknown>)[k] = v;
          changed[k] = true;
        }
      });
      if (opts.personalised && !meta.personalised) {
        meta.personalised = true;
        changed.personalised = true;
      }
      if (Object.keys(changed).length === 0) return;
      persist();
      listeners.forEach((l) => l(state, meta, changed));
    },
    subscribe(listener: Listener, fireNow = false) {
      listeners.add(listener);
      if (fireNow)
        listener(state, meta, { name: true, colour: true, finish: true, style: true, personalised: true });
      return () => listeners.delete(listener);
    },
  };
}

export const brand = createStore();
export type BrandStore = typeof brand;
