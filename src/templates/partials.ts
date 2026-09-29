import { contactEmail, socialLinks, wordmark } from '../config.ts';
import { chrome, footer } from '../content.ts';
import { sceneList } from '../scenes.ts';
import { html, type Raw } from './html.ts';

export const cropMarks = (extra = ''): Raw =>
  html`<div class="crop ${extra}" aria-hidden="true">
    <span></span><span></span><span></span><span></span>
  </div>`;

/** Header shared by every page. On sub-pages the links point back to the home page. */
export function header(home: boolean): Raw {
  const base = home ? '' : '/';
  return html`<a class="skip-link" href="${base}#brief" data-start-brief>${chrome.skip}</a>
    <header class="site-header">
      <a class="wordmark" href="/" data-wordmark>${wordmark}</a>
      <a class="button button--brand site-header__cta" href="${base}#brief" data-start-brief
        >${chrome.startBrief}</a
      >
    </header>`;
}

/** Printer's colour bar progress strip plus the scene index it opens. */
export function progress(): Raw {
  const first = sceneList[0];
  return html`<div class="progress" data-progress>
    <button class="progress__toggle" type="button" popovertarget="scene-index">
      <span class="progress__bar" aria-hidden="true"
        >${sceneList.map(
          (s) =>
            html`<span class="progress__patch" style="--ink:${s.ink}"
              ><span class="progress__fill" data-fill="${s.id}"></span
            ></span>`,
        )}</span
      >
      <span class="progress__label" id="progress-label" data-progress-label
        >${chrome.sceneLabel(1, sceneList.length, first?.name ?? '')}</span
      >
      <span class="visually-hidden">${chrome.sceneIndex}</span>
    </button>
    <nav class="scene-index" id="scene-index" popover aria-label="${chrome.sceneIndex}">
      <ol class="scene-index__list">
        ${sceneList.map(
          (s, i) =>
            html`<li>
              <a href="#${s.id}" data-scene-link="${s.id}"
                ><span class="scene-index__n" aria-hidden="true" style="--ink:${s.ink}"></span
                ><span class="visually-hidden">Scene ${i + 1}: </span>${s.name}</a
              >
            </li>`,
        )}
      </ol>
    </nav>
  </div>`;
}

export function siteFooter(): Raw {
  const year = new Date().getFullYear();
  return html`<footer class="site-footer" id="contact" aria-labelledby="footer-title">
    <div class="footer__label" data-footer-label>
      <h2 class="footer__headline" id="footer-title" data-footer-headline>${footer.headline}</h2>
    </div>
    <div class="footer__grid">
      ${
        contactEmail
          ? html`<div class="footer__block">
              <h3 class="footer__heading">${footer.email}</h3>
              <p><a class="footer__email" href="mailto:${contactEmail}">${contactEmail}</a></p>
              <p class="footer__row">
                <button
                  class="button button--line button--small"
                  type="button"
                  data-copy-email="${contactEmail}"
                >
                  ${footer.copyEmail}
                </button>
                <span class="footer__copied smallprint" role="status" data-copy-status></span>
              </p>
            </div>`
          : ''
      }
      ${
        socialLinks.length
          ? html`<div class="footer__block">
              <h3 class="footer__heading">${footer.social}</h3>
              <ul class="footer__links">
                ${socialLinks.map((s) => html`<li><a href="${s.href}" rel="me noopener" target="_blank">${s.label}</a></li>`)}
              </ul>
            </div>`
          : ''
      }
      <div class="footer__block">
        <h3 class="footer__heading">${footer.based}</h3>
        <p>
          <time class="footer__clock" data-clock></time> <span class="smallprint">${footer.clockLabel}</span>
        </p>
        <p>${footer.availability}</p>
      </div>
    </div>
    <div class="footer__base smallprint">
      <a href="/privacy.html">${footer.privacy}</a>
      <span>© <span data-year>${year}</span> ${wordmark}</span>
    </div>
  </footer>`;
}
