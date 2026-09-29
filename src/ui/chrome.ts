/** Header, skip link, in-page links and the footer's live bits. Shared by every page. */
import { contactEmail, site } from '../config';
import { footer } from '../content';
import { copyText } from '../lib/clipboard';
import { $, $$, devWarn, scrollToElement } from '../lib/dom';

/** "Start a brief" and the skip link: scroll to the brief, then move focus to its heading. */
function initStartBrief(): void {
  const target = $('#brief');
  const heading = $('[data-brief-title]');
  if (!target || !heading) return;
  $$<HTMLAnchorElement>('[data-start-brief]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToElement(target, () => heading.focus({ preventScroll: true }));
      history.replaceState(null, '', '#brief');
    });
  });
}

/** Plain in-page links (hero button, scene index) use the same scroller. */
function initScrollLinks(): void {
  $$<HTMLAnchorElement>('[data-scroll-link], [data-scene-link]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.hash.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      const popover = a.closest<HTMLElement>('[popover]');
      if (popover?.matches(':popover-open')) popover.hidePopover();
      scrollToElement(target, () => {
        const focusable = target.querySelector<HTMLElement>('h1, h2');
        if (focusable) {
          if (!focusable.hasAttribute('tabindex')) focusable.setAttribute('tabindex', '-1');
          focusable.focus({ preventScroll: true });
        }
      });
    });
  });
}

function initFooter(): void {
  const clock = $<HTMLTimeElement>('[data-clock]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-PH', {
      timeZone: site.timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const iso = new Intl.DateTimeFormat('en-GB', {
      timeZone: site.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const tick = () => {
      const now = new Date();
      clock.textContent = fmt.format(now);
      clock.dateTime = iso.format(now);
    };
    tick();
    window.setInterval(tick, 30_000);
  }

  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  const copy = $<HTMLButtonElement>('[data-copy-email]');
  const status = $('[data-copy-status]');
  if (copy && status) {
    let timer = 0;
    copy.addEventListener('click', async () => {
      const ok = await copyText(copy.dataset.copyEmail ?? '');
      status.textContent = ok ? footer.copied : '';
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (status.textContent = ''), 4000);
    });
  }

  if (!contactEmail) devWarn('CONTACT_EMAIL is not set in src/config.ts, so the email UI is hidden.');
}

export function initChrome(): void {
  initStartBrief();
  initScrollLinks();
  initFooter();
}
