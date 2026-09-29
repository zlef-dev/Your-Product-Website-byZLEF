import './styles/index.css';
import { $ } from './lib/dom';
import { initChrome } from './ui/chrome';
import { initTakeover } from './ui/takeover';

initChrome();
initTakeover();

const slot = $('[data-slot="crushed"]');
if (slot) void import('./stage/crushed').then((m) => m.startCrushed(slot));
