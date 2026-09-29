import { contactEmail } from '../config.ts';
import { notFound, privacy } from '../content.ts';
import { html } from './html.ts';
import { header, siteFooter } from './partials.ts';

export function notFoundBody(): string {
  return html`${header(false)}
    <main id="main" class="page page--404">
      <section class="oos" aria-labelledby="oos-title">
        <div class="stage-slot oos__slot" data-slot="crushed" aria-hidden="true"></div>
        <div class="oos__copy">
          <h1 class="display oos__title" id="oos-title">${notFound.h1}</h1>
          <p class="lede">${notFound.line}</p>
          <p><a class="button button--brand" href="/">${notFound.back}</a></p>
        </div>
      </section>
    </main>
    ${siteFooter()}`.__raw;
}

export function privacyBody(): string {
  return html`${header(false)}
    <main id="main" class="page page--privacy">
      <article class="prose" aria-labelledby="privacy-title">
        <h1 class="heading" id="privacy-title">${privacy.h1}</h1>
        <p>${privacy.body}</p>
        ${contactEmail ? html`<p>${privacy.askLine(contactEmail)}</p>` : ''}
        <p><a class="button button--line" href="/">${privacy.back}</a></p>
      </article>
    </main>
    ${siteFooter()}`.__raw;
}
