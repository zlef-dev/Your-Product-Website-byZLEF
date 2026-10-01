/**
 * Boots the 3D stage (lazy-loaded so the H1 and copy paint first). Returns null when
 * WebGL2 isn't available; the caller then shows the 2D fallback.
 */
import type { BrandState } from '../lib/brand';
import { idle } from '../lib/dom';
import { Printer } from '../label/print-run';
import { toArt } from '../label/surfaces';
import type { StageLink } from '../scroll/director';
import type { CanView } from '../ui/tryit';
import { composeCard, toPng, CARD } from '../ui/card';
import { detectTier, isSoftwareRenderer } from './quality';
import { probeWebGL, Stage } from './stage';
import type { StageState } from './state';

export type Readiness = 'renderer' | 'compiled' | 'frame';

export interface StageHandle {
  stage: Stage;
  view: CanView;
  link: StageLink;
}

let active: Stage | null = null;

/** The line-up and the launch fizz arrive in their own chunk, before scene 3. */
function loadExtras(stage: Stage): Promise<void> {
  if (stage.hasLineup()) return Promise.resolve();
  return Promise.all([import('./lineup'), import('./fizz')]).then(([{ Lineup }, { Fizz }]) => {
    if (stage.hasLineup()) return;
    const coarse = matchMedia('(pointer: coarse)').matches;
    stage.attachFizz(new Fizz(Math.min(stage.settings.particles, coarse ? 80 : 200)));
    stage.attachLineup(new Lineup(stage.settings.latheSegments));
  });
}

export async function startStage(opts: {
  target: StageState;
  reducedMotion: boolean;
  onReady: (step: Readiness) => void;
}): Promise<StageHandle | null> {
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let tier = detectTier();
  const gl = probeWebGL(canvas, tier !== 'low');
  if (!gl) return null;
  if (isSoftwareRenderer(gl)) tier = 'low';
  document.body.prepend(canvas);

  performance.mark('stage:start');
  const stage = new Stage(canvas, gl, tier, opts.reducedMotion, opts.target);
  active = stage;
  performance.mark('stage:constructed');
  opts.onReady('renderer');
  await stage.warm();
  performance.mark('stage:compiled');
  opts.onReady('compiled');
  stage.onFirstFrame(() => {
    performance.mark('stage:frame');
    canvas.classList.add('is-ready');
    opts.onReady('frame');
  });
  stage.snapNext();
  stage.invalidate();

  const printer = new Printer({
    surfaces: stage.surfaces,
    setInk: (v) => stage.setInk(v),
    hold: (on) => stage.hold(on),
    showPlates: (plates, w, h) => stage.showPlates(plates, w, h),
    setPlateFrame: (f) => stage.setPlateFrame(f),
  });

  let printedName = '';
  let printing: Promise<void> = Promise.resolve();
  const view: CanView = {
    print(state: Readonly<BrandState>, o) {
      printedName = state.name;
      stage.setBrandColour(state.colour);
      printing = printer.print(toArt(state), { instant: o?.instant });
      return printing;
    },
    setFinish: (f) => stage.setFinish(f),
    turn: (deg, immediate) => stage.turn(deg, immediate),
    rotation: () => stage.rotation(),
    async snapshot() {
      // Never capture a half-printed label.
      await printing;
      const still = await stage.renderStill(CARD.width, CARD.height);
      return toPng(composeCard(still, printedName || stage.surfaces.printed()?.name || ''));
    },
  };

  const link: StageLink = {
    setVisible: (v) => stage.setVisible(v),
    setAnchor: (el, fill) => stage.setAnchor(el, fill),
    snapNext: () => stage.snapNext(),
    resetSpin: () => stage.resetSpin(),
    ensureLineup: () => void loadExtras(stage),
    setPointer: (x, y) => stage.setPointer(x, y),
    wake: () => stage.invalidate(),
    sticker: (job) => {
      stage.surfaces.stickSticker(job);
      stage.invalidate();
    },
  };

  // Then, in idle time: the hidden parts' shaders, and the line-up well before scene 3,
  // so no later reveal hitches.
  void idle(2000)
    .then(() => stage.compileRest())
    .then(() => idle(4000))
    .then(() => loadExtras(stage));

  // Not when the page is only entering the back/forward cache: it may come back, and a
  // disposed stage would leave a dead canvas.
  addEventListener('pagehide', (e) => {
    if (!e.persisted) stage.dispose();
  });
  return { stage, view, link };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    active?.dispose();
    active?.canvas.remove();
    active = null;
  });
}
