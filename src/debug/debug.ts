/**
 * ?debug only (lazy-loaded, absent from normal loads): a frame-time readout, ScrollTrigger
 * markers, and the stage on window.__stage for poking at states from the console.
 */
import type { Stage } from '../stage/stage';

export function startDebug(stage: Stage | null): void {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'fixed',
    right: '8px',
    bottom: '8px',
    zIndex: '99',
    padding: '4px 8px',
    font: '600 12px/1.3 ui-monospace, monospace',
    background: '#231F20',
    color: '#F1F2EE',
    pointerEvents: 'none',
  });
  document.body.append(el);
  let last = performance.now();
  let acc = 0;
  let n = 0;
  let worst = 0;
  const loop = (now: number) => {
    const dt = now - last;
    last = now;
    acc += dt;
    n++;
    worst = Math.max(worst, dt);
    if (acc > 500) {
      el.textContent = `${(acc / n).toFixed(1)} ms avg, ${worst.toFixed(1)} ms worst, tier ${stage?.tier ?? 'none'}`;
      acc = 0;
      n = 0;
      worst = 0;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const w = window as unknown as {
    __stage?: Stage | null;
    __stageFrames?: () => number;
    __stageEnvironment?: () => boolean;
    __stageTarget?: () => { wash: number; rise: number; lineup: number };
  };
  w.__stage = stage;
  // Read-only probes the end-to-end tests use to check the stage is still rendering.
  w.__stageFrames = () => stage?.renderer.info.render.frame ?? -1;
  w.__stageEnvironment = () => !!stage?.scene.environment;
  w.__stageTarget = () => {
    const t = stage?.target;
    return { wash: t?.wash ?? -1, rise: t?.rise ?? -1, lineup: t?.lineup ?? -1 };
  };
}
