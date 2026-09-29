/**
 * Boots the 3D stage (lazy-loaded so the H1 and copy paint first). Returns null when
 * WebGL2 isn't available; the caller then shows the 2D fallback.
 */
import type { BrandState } from '../lib/brand';
import { Printer } from '../label/print-run';
import { toArt } from '../label/surfaces';
import type { CanView } from '../ui/tryit';
import { composeCard, toPng, CARD } from '../ui/card';
import { detectTier, isSoftwareRenderer } from './quality';
import { probeWebGL, Stage } from './stage';

export type Readiness = 'renderer' | 'compiled' | 'frame';

export interface StageHandle {
  stage: Stage;
  view: CanView;
}

let active: Stage | null = null;

export async function startStage(opts: {
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

  const stage = new Stage(canvas, gl, tier, opts.reducedMotion);
  active = stage;
  opts.onReady('renderer');
  await stage.warm();
  opts.onReady('compiled');
  stage.onFirstFrame(() => {
    canvas.classList.add('is-ready');
    opts.onReady('frame');
  });
  stage.invalidate();

  const printer = new Printer({
    surfaces: stage.surfaces,
    setInk: (v) => stage.setInk(v),
    hold: (on) => stage.hold(on),
  });

  let printedName = '';
  const view: CanView = {
    async print(state: Readonly<BrandState>, o) {
      printedName = state.name;
      stage.setBrandColour(state.colour);
      await printer.print(toArt(state), { instant: o?.instant });
    },
    setFinish: (f) => stage.setFinish(f),
    turn: (deg, immediate) => stage.turn(deg, immediate),
    rotation: () => stage.rotation(),
    async snapshot() {
      const still = await stage.renderStill(CARD.width, CARD.height);
      return toPng(composeCard(still, printedName || stage.surfaces.printed()?.name || ''));
    },
  };

  addEventListener('pagehide', () => stage.dispose(), { once: true });
  return { stage, view };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    active?.dispose();
    active?.canvas.remove();
    active = null;
  });
}
