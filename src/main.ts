import './styles/index.css';
import { initBriefForm } from './form/brief';
import { prefersReducedMotion } from './lib/dom';
import { initChrome } from './ui/chrome';
import { initTakeover } from './ui/takeover';
import { initTryIt } from './ui/tryit';

const reducedMotion = prefersReducedMotion();
document.documentElement.classList.toggle('is-reduced', reducedMotion);

initChrome();
initTakeover();
initTryIt({ reducedMotion });
initBriefForm();
