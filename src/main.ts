import './styles/index.css';
import { initBriefForm } from './form/brief';
import { brand } from './lib/brand';
import { $, $$, prefersReducedMotion } from './lib/dom';
import { initDirector } from './scroll/director';
import { createState } from './stage/state';
import { initChrome } from './ui/chrome';
import { initTakeover } from './ui/takeover';
import { initTryIt, samplePrintIfNeeded, setCanView } from './ui/tryit';

const reducedMotion = prefersReducedMotion();
document.documentElement.classList.toggle('is-reduced', reducedMotion);

initChrome();
initTakeover();
initTryIt({ reducedMotion });
initBriefForm();

// The Stage state: the only thing scroll timelines write. The 3D stage reads it.
const target = createState();
const director = initDirector({
  target,
  reducedMotion,
  onSampleNeeded: (instant) => samplePrintIfNeeded(instant),
});
// fireNow: a visitor returning within the session gets their tinted sweep straight away.
brand.subscribe((_s, meta) => {
  if (meta.personalised) director.printed();
}, true);

// ---------- S0 Press check: four ink levels tied to real readiness ----------

const SEEN = 'iybh:seen';
const press = $('[data-press-check]');
const inks = press ? $$('span', press) : [];
let seen = false;
try {
  seen = sessionStorage.getItem(SEEN) === '1';
  sessionStorage.setItem(SEEN, '1');
} catch {
  // Without storage the intro simply plays again.
}
if (reducedMotion || seen) press?.classList.add('is-skipped');

const ink = (i: number) => inks[i]?.classList.add('is-set');
const finishIntro = () => press?.classList.add('is-done');
// The intro never holds anything back and is over within 1.6 s.
window.setTimeout(finishIntro, 1600);
void document.fonts.ready.then(() => ink(0));

// ---------- The stage (lazy: the H1 and copy never wait for it) ----------

void import('./stage/index')
  .then(({ startStage }) =>
    startStage({
      target,
      reducedMotion,
      onReady: (step) => {
        if (step === 'renderer') ink(1);
        if (step === 'compiled') ink(2);
        if (step === 'frame') {
          ink(3);
          window.setTimeout(finishIntro, 300);
        }
      },
    }),
  )
  .then(async (handle) => {
    if (handle) {
      setCanView(handle.view);
      director.attach(handle.link);
    } else {
      // No WebGL: an SVG can with the label drawn flat inside; everything else still works.
      const { startFallback } = await import('./ui/fallback-2d');
      setCanView(await startFallback());
      finishIntro();
    }
  });
