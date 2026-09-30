/**
 * S2 "Try it on": the controls that drive the live label. The can itself (3D or the
 * 2D fallback) plugs in as a CanView once it is ready; until then requests queue.
 */
import { presets, tryIt } from '../content';
import {
  brand,
  cleanBrandName,
  DEFAULT_COLOUR,
  type BrandState,
  type Finish,
  type LabelStyle,
} from '../lib/brand';
import { normaliseHex } from '../lib/contrast';
import { $, $$ } from '../lib/dom';
import { loadLogo, LogoError } from '../label/logo';

export interface PrintOptions {
  /** Jump straight to the finished artwork (reduced motion, restoring a session). */
  instant?: boolean;
}

export interface CanView {
  print(state: Readonly<BrandState>, opts?: PrintOptions): Promise<void>;
  setFinish(finish: Finish): void;
  /** Turn the can by a number of degrees (keyboard, buttons, drag). */
  turn(deg: number, immediate?: boolean): void;
  /** Current user rotation in degrees, 0–359. */
  rotation(): number;
  /** A PNG of the can as it is printed now. */
  snapshot(): Promise<Blob>;
}

export const SAMPLE: Readonly<BrandState> = {
  name: tryIt.sampleName,
  colour: presets[0].hex,
  finish: 'gloss',
  style: 'wide',
  logo: null,
};

const COMMIT_DELAY = 600;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

let view: CanView | null = null;
let pending: { state: BrandState; opts: PrintOptions } | null = null;
let printedOnce = false;
let statusEl: HTMLElement | null = null;

/** What the can shows for a visitor state: their name, or the sample name while empty. */
export function displayState(s: Readonly<BrandState>): BrandState {
  return { ...s, name: s.name || tryIt.sampleName };
}

let latest = 0;

function requestPrint(state: BrandState, opts: PrintOptions = {}, announce = true): void {
  printedOnce = true;
  if (!view) {
    pending = { state, opts };
    return;
  }
  const id = ++latest;
  void view.print(state, opts).then(() => {
    // A newer print supersedes this one: only the can's final state is announced.
    if (id === latest && announce && statusEl) statusEl.textContent = tryIt.printed(state.name);
  });
}

/** Attaches the can (3D stage or 2D fallback) and replays anything queued. */
export function setCanView(v: CanView): void {
  view = v;
  view.setFinish(brand.get().finish);
  if (pending) {
    const { state, opts } = pending;
    pending = null;
    requestPrint(state, opts, false);
  }
}

export function getCanView(): CanView | null {
  return view;
}

/** Leaving the try-it scene without printing: print the sample once so everyone sees it. */
export function samplePrintIfNeeded(instant = false): void {
  if (printedOnce) return;
  requestPrint({ ...SAMPLE }, { instant }, false);
}

export function hasPrinted(): boolean {
  return printedOnce;
}

export function initTryIt(opts: { reducedMotion: boolean }): void {
  const form = $<HTMLFormElement>('#try-form');
  if (!form) return;
  const nameInput = $<HTMLInputElement>('#brand-name', form)!;
  const customRadio = $<HTMLInputElement>('[data-custom-radio]', form)!;
  const customInput = $<HTMLInputElement>('[data-custom-colour]', form)!;
  const customChip = $('[data-custom-chip]', form)!;
  const logoInput = $<HTMLInputElement>('[data-logo-input]', form)!;
  const logoRemove = $<HTMLButtonElement>('[data-logo-remove]', form)!;
  const logoError = $('[data-logo-error]', form)!;
  const shareBtn = $<HTMLButtonElement>('[data-share]', form);
  statusEl = $('[data-print-status]', form);

  const instant = () => opts.reducedMotion;
  let timer = 0;

  const printCurrent = () => requestPrint(displayState(brand.get()), { instant: instant() });

  const commitName = () => {
    window.clearTimeout(timer);
    const name = cleanBrandName(nameInput.value);
    const s = brand.get();
    if (!name && !s.name && !brand.meta().personalised) return;
    brand.set({ name }, { personalised: true });
    printCurrent();
  };

  // ---------- Restore this session ----------
  const s = brand.get();
  nameInput.value = s.name;
  const preset = $$<HTMLInputElement>('input[name="colour"]', form).find((i) => i.value === s.colour);
  if (brand.meta().personalised) {
    if (preset) preset.checked = true;
    else {
      customRadio.checked = true;
      customInput.value = s.colour.toLowerCase();
      customChip.style.setProperty('--swatch', s.colour);
      customChip.classList.add('has-colour');
    }
  } else {
    $<HTMLInputElement>('input[name="colour"][data-default]', form)!.checked = true;
  }
  $$<HTMLInputElement>('input[name="finish"]', form).forEach((i) => (i.checked = i.value === s.finish));
  $$<HTMLInputElement>('input[name="style"]', form).forEach((i) => (i.checked = i.value === s.style));
  if (brand.meta().personalised) requestPrint(displayState(s), { instant: true }, false);

  // ---------- Name ----------
  nameInput.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(commitName, COMMIT_DELAY);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    commitName();
  });

  // ---------- Colour, finish, style ----------
  const setColour = (hex: string) => {
    const colour = normaliseHex(hex) ?? DEFAULT_COLOUR;
    brand.set({ colour }, { personalised: true });
    printCurrent();
  };

  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'colour') {
      setColour(t.value === 'custom' ? customInput.value : t.value);
    } else if (t.name === 'finish') {
      brand.set({ finish: t.value as Finish }, { personalised: true });
      view?.setFinish(t.value as Finish);
    } else if (t.name === 'style') {
      brand.set({ style: t.value as LabelStyle }, { personalised: true });
      printCurrent();
    }
  });

  let colourTimer = 0;
  customInput.addEventListener('input', () => {
    customRadio.checked = true;
    customChip.style.setProperty('--swatch', customInput.value);
    customChip.classList.add('has-colour');
    window.clearTimeout(colourTimer);
    colourTimer = window.setTimeout(() => setColour(customInput.value), 250);
  });

  // ---------- Logo (never leaves the device) ----------
  logoInput.addEventListener('change', async () => {
    const file = logoInput.files?.[0];
    logoError.hidden = true;
    if (!file) return;
    try {
      const logo = await loadLogo(file, MAX_LOGO_BYTES);
      brand.set({ logo }, { personalised: true });
      logoRemove.hidden = false;
      printCurrent();
    } catch (err) {
      const code = err instanceof LogoError ? err.code : 'unreadable';
      logoError.textContent =
        code === 'size' ? tryIt.logoTooBig : code === 'type' ? tryIt.logoWrongType : tryIt.logoUnreadable;
      logoError.hidden = false;
    } finally {
      logoInput.value = '';
    }
  });

  logoRemove.addEventListener('click', () => {
    brand.set({ logo: null }, { personalised: true });
    logoRemove.hidden = true;
    printCurrent();
    $<HTMLLabelElement>('.logo__button', form)?.focus();
  });

  // ---------- Download and share ----------
  const fileName = () => {
    const n = brand.get().name || tryIt.sampleName;
    return `${
      n
        .normalize('NFKD')
        .replace(/[^\w-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'your-brand'
    }-can.png`;
  };

  const download = async () => {
    if (!view) return;
    if (!printedOnce) printCurrent();
    const blob = await view.snapshot();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  $$<HTMLButtonElement>('[data-download]').forEach((b) => b.addEventListener('click', () => void download()));

  if (shareBtn && typeof navigator.canShare === 'function') {
    try {
      const probe = new File([new Uint8Array(1)], 'can.png', { type: 'image/png' });
      if (navigator.canShare({ files: [probe] })) {
        shareBtn.hidden = false;
        shareBtn.addEventListener('click', async () => {
          if (!view) return;
          const blob = await view.snapshot();
          const file = new File([blob], fileName(), { type: 'image/png' });
          const name = brand.get().name || tryIt.sampleName;
          try {
            await navigator.share({ files: [file], title: name, text: tryIt.shareText(name) });
          } catch {
            // Cancelled by the visitor, or the share sheet failed; nothing to do.
          }
        });
      }
    } catch {
      // canShare can throw on some platforms; Share simply stays hidden.
    }
  }

  // ---------- Turning the can: keyboard, buttons and drag ----------
  const spin = $('[data-spin]');
  if (!spin) return;

  const syncSlider = () => {
    const deg = view ? Math.round(view.rotation()) : 0;
    spin.setAttribute('aria-valuenow', String(deg));
    spin.setAttribute('aria-valuetext', tryIt.rotationText(deg));
  };

  const turn = (deg: number, immediate = false) => {
    view?.turn(deg, immediate);
    syncSlider();
  };

  spin.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 45 : 15;
    const map: Record<string, number> = {
      ArrowLeft: -step,
      ArrowDown: -step,
      ArrowRight: step,
      ArrowUp: step,
      PageDown: -90,
      PageUp: 90,
    };
    if (e.key in map) {
      e.preventDefault();
      turn(map[e.key] ?? 0);
    } else if (e.key === 'Home') {
      e.preventDefault();
      turn(-(view?.rotation() ?? 0));
    }
  });

  $$<HTMLButtonElement>('[data-turn]').forEach((b) =>
    b.addEventListener('click', () => turn(Number(b.dataset.turn) * 30)),
  );

  let dragging = false;
  let lastX = 0;
  let velocity = 0;
  let lastT = 0;
  let inertia = 0;

  spin.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastT = performance.now();
    velocity = 0;
    cancelAnimationFrame(inertia);
    spin.setPointerCapture(e.pointerId);
    spin.classList.add('is-dragging');
  });

  spin.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const deg = dx * 0.6;
    velocity = deg / Math.max(1, now - lastT);
    lastX = e.clientX;
    lastT = now;
    turn(deg, true);
  });

  const release = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    spin.classList.remove('is-dragging');
    if (spin.hasPointerCapture(e.pointerId)) spin.releasePointerCapture(e.pointerId);
    if (opts.reducedMotion) return;
    // A short, damped coast after release.
    // Capped so a fast flick coasts a little, never a full spin.
    let v = Math.max(-10, Math.min(10, velocity * 16));
    const coast = () => {
      if (Math.abs(v) < 0.05) return;
      turn(v, true);
      v *= 0.92;
      inertia = requestAnimationFrame(coast);
    };
    inertia = requestAnimationFrame(coast);
  };

  spin.addEventListener('pointerup', release);
  spin.addEventListener('pointercancel', release);
}
