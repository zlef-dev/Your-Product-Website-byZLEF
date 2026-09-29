/**
 * Signature moment 3: once the visitor sets a brand, the interface re-colours to their
 * label and speaks their name back (tab title, brief heading, footer headline).
 */
import { brief, footer, meta } from '../content';
import { brand } from '../lib/brand';
import { onPaper, pickInk } from '../lib/contrast';
import { $ } from '../lib/dom';

export function applyBrandColour(hex: string): void {
  const root = document.documentElement.style;
  root.setProperty('--brand', hex);
  root.setProperty('--brand-ink', pickInk(hex));
  root.setProperty('--brand-on-paper', onPaper(hex, 4.5));
  root.setProperty('--focus', onPaper(hex, 3));
}

export function initTakeover(): void {
  const baseTitle = document.title;
  const headline = $('[data-footer-headline]');
  const label = $('[data-footer-label]');
  const briefTitle = $('[data-brief-title]');

  brand.subscribe((s, m) => {
    if (!m.personalised) return;
    applyBrandColour(s.colour);
    const name = s.name;
    document.title = name ? meta.personalisedTitle(name) : baseTitle;
    if (headline) headline.textContent = name ? footer.headlineFor(name) : footer.headline;
    label?.classList.toggle('is-branded', !!name);
    if (briefTitle) briefTitle.textContent = name ? brief.headingFor(name) : brief.heading;
  }, true);
}
