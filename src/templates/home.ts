import { site } from '../config.ts';
import {
  brief,
  build,
  finishes,
  hero,
  labelStyles,
  lineup,
  presets,
  process,
  tryIt,
  work,
} from '../content.ts';
import { attr, html, type Raw } from './html.ts';
import { cropMarks, header, progress, siteFooter } from './partials.ts';

const req = (required: boolean) =>
  html`<span class="field__req">${required ? brief.required : brief.optional}</span>`;

interface TextFieldOpts {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  hint?: string;
  maxlength?: number;
  autocomplete?: string;
  inputmode?: string;
  multiline?: boolean;
  counter?: boolean;
  spellcheck?: boolean;
}

function textField(o: TextFieldOpts): Raw {
  const hintId = o.hint ? `${o.id}-hint` : '';
  const countId = o.counter ? `${o.id}-count` : '';
  const describedby = [hintId, countId].filter(Boolean).join(' ');
  const common = html`id="${o.id}"
  name="${o.name}"${attr(!!o.required, 'required')}${attr(!!o.maxlength, 'maxlength', String(o.maxlength ?? ''))}${attr(!!o.autocomplete, 'autocomplete', o.autocomplete ?? '')}${attr(!!describedby, 'aria-describedby', describedby)}${attr(o.spellcheck === false, 'spellcheck', 'false')}`;
  return html`<div class="field" data-field="${o.name}">
    <label class="field__label" for="${o.id}">${o.label} ${req(!!o.required)}</label>
    ${o.hint ? html`<p class="field__hint" id="${hintId}">${o.hint}</p>` : ''}
    ${
      o.multiline
        ? html`<textarea
            class="field__input field__input--area"
            rows="${o.counter ? 3 : 4}"
            ${common}
          ></textarea>`
        : html`<input
            class="field__input"
            type="${o.type ?? 'text'}"
            ${attr(!!o.inputmode, 'inputmode', o.inputmode ?? '')}
            ${common}
          />`
    }
    ${o.counter ? html`<p class="field__counter smallprint" id="${countId}" data-counter>${brief.fields.counter(0, o.maxlength ?? 0)}</p>` : ''}
    <p class="field__error" id="${o.id}-error" data-error hidden></p>
  </div>`;
}

function chipGroup(o: {
  id: string;
  name: string;
  legend: string;
  options: readonly string[];
  multiple?: boolean;
  required?: boolean;
  hint?: string;
}): Raw {
  const hintId = o.hint ? `${o.id}-hint` : '';
  return html`<fieldset
    class="field field--chips"
    id="${o.id}"
    data-field="${o.name}"
    data-group="${o.multiple ? 'checkbox' : 'radio'}"
    ${attr(!!o.required, 'data-required')}${attr(!!hintId, 'aria-describedby', hintId)}
  >
    <legend class="field__label">${o.legend} ${req(!!o.required)}</legend>
    ${o.hint ? html`<p class="field__hint" id="${hintId}">${o.hint}</p>` : ''}
    <div class="chips">
      ${o.options.map(
        (opt, i) =>
          html`<label class="chip"
            ><input
              type="${o.multiple ? 'checkbox' : 'radio'}"
              name="${o.name}"
              value="${opt}"
              id="${o.id}-${i}"
            /><span>${opt}</span></label
          >`,
      )}
    </div>
    <p class="field__error" id="${o.id}-error" data-error hidden></p>
  </fieldset>`;
}

function step(index: number, body: Raw): Raw {
  const title = brief.steps[index] ?? '';
  return html`<fieldset class="step" data-step="${index}" ${attr(index > 0, 'hidden')}>
    <legend class="step__legend" tabindex="-1">
      <span class="step__count"
        >${brief.stepAnnounce(index + 1, brief.steps.length, '').replace(/: $/, '')}</span
      ><span class="step__title">${title}</span>
    </legend>
    ${body}
  </fieldset>`;
}

function briefForm(): Raw {
  const f = brief.fields;
  return html`<form class="brief-form" id="brief-form" novalidate>
    <p class="visually-hidden" role="status" data-step-status></p>
    <div class="brief-form__summary" data-summary tabindex="-1" hidden>
      <p class="brief-form__summary-title" data-summary-title></p>
      <ul data-summary-list></ul>
    </div>
    ${step(
      0,
      html`${textField({ id: 'f-brand', name: 'brand', label: f.brand, required: true, maxlength: 80, autocomplete: 'organization', spellcheck: false })}
      ${textField({ id: 'f-current', name: 'current', label: f.current, hint: f.currentHint, maxlength: 200, inputmode: 'url', autocomplete: 'url', spellcheck: false })}
      ${chipGroup({ id: 'f-does', name: 'does', legend: f.does, options: f.doesOptions, required: true })}`,
    )}
    ${step(
      1,
      html`${chipGroup({ id: 'f-need', name: 'need', legend: f.need, options: f.needOptions, multiple: true, required: true, hint: f.needHint })}
      ${textField({ id: 'f-goal', name: 'goal', label: f.goal, required: true, maxlength: f.goalMax, multiline: true, counter: true })}`,
    )}
    ${step(
      2,
      html`<p class="step__note" data-price-note>${brief.priceNote}</p>
        ${chipGroup({ id: 'f-budget', name: 'budget', legend: f.budget, options: f.budgetOptions, required: true })}
        ${chipGroup({ id: 'f-timeline', name: 'timeline', legend: f.timeline, options: f.timelineOptions, required: true })}
        ${textField({ id: 'f-notes', name: 'notes', label: f.notes, maxlength: 2000, multiline: true })}`,
    )}
    ${step(
      3,
      html`${textField({ id: 'f-name', name: 'name', label: f.name, required: true, maxlength: 100, autocomplete: 'name' })}
      ${textField({ id: 'f-email', name: 'email', label: f.email, required: true, type: 'email', maxlength: 200, autocomplete: 'email', spellcheck: false })}
      ${textField({ id: 'f-based', name: 'based', label: f.based, maxlength: 100, autocomplete: 'address-level2' })}
      ${textField({ id: 'f-assets', name: 'assets', label: f.assets, hint: f.assetsHint, maxlength: 300, inputmode: 'url', spellcheck: false })}`,
    )}
    <label class="honeypot" aria-hidden="true"
      >Leave this box empty<input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off"
    /></label>
    <p class="brief-form__error" data-send-error role="alert" hidden></p>
    <div class="brief-form__nav">
      <button class="button button--line" type="button" data-back hidden>${brief.back}</button>
      <button class="button button--brand" type="button" data-next>${brief.next}</button>
      <button class="button button--brand" type="submit" data-send hidden>${brief.send}</button>
      <button class="button button--line" type="button" data-copy-brief hidden>${brief.copy}</button>
    </div>
    <p class="brief-form__note smallprint" data-mailto-note hidden>${brief.noKeyNote}</p>
    <p class="brief-form__privacy smallprint" data-privacy-line hidden>${brief.privacyLine}</p>
    <p class="brief-form__status smallprint" role="status" data-form-status></p>
  </form>`;
}

function workSection(): Raw {
  if (!site.work.length) return html``;
  return html`<section class="scene scene--work" id="work" data-scene="work" aria-labelledby="work-title">
    <div class="scene__inner work">
      <h2 class="heading" id="work-title" data-split>${work.heading}</h2>
      <ol class="work__list">
        ${site.work.map(
          (w) =>
            html`<li class="work__item">
              ${w.image ? html`<img class="work__image" src="${w.image}" alt="${w.imageAlt ?? ''}" loading="lazy" decoding="async" width="1200" height="800" />` : ''}
              <h3 class="work__title"><a href="${w.href}" rel="noopener" target="_blank">${w.title}</a></h3>
              <p class="work__meta smallprint">${String(w.year)}, ${w.role}</p>
              <p>${w.outcome}</p>
            </li>`,
        )}
      </ol>
    </div>
  </section>`;
}

export function homeBody(): string {
  return html`${header(true)} ${progress()}
    <div class="press-check" aria-hidden="true" data-press-check>
      <span style="--ink:var(--process-c)"></span><span style="--ink:var(--process-m)"></span
      ><span style="--ink:var(--process-y)"></span><span style="--ink:var(--process-k)"></span>
    </div>
    <main id="main">
      <section class="scene scene--hero" id="top" data-scene="top" aria-labelledby="hero-title">
        ${cropMarks()}
        <div class="scene__inner hero">
          <div class="hero__copy">
            <h1 class="display hero__title" id="hero-title">${hero.h1}</h1>
            <p class="lede hero__sub">${hero.sub}</p>
            <div class="actions">
              <a class="button button--brand" href="#try" data-scroll-link>${hero.tryIt}</a>
              <a class="button button--line" href="#brief" data-start-brief>${hero.startBrief}</a>
            </div>
            <p class="smallprint hero__location">${hero.location}</p>
          </div>
          <div class="stage-slot hero__slot" data-slot="top" aria-hidden="true"></div>
        </div>
      </section>

      <section class="scene scene--try" id="try" data-scene="try" aria-labelledby="try-title">
        ${cropMarks()}
        <div class="scene__inner try">
          <div class="try__panel">
            <div class="try__intro">
              <h2 class="heading" id="try-title" data-split>${tryIt.heading}</h2>
              <p class="try__body">${tryIt.body}</p>
            </div>
            <form class="try__controls" id="try-form" novalidate autocomplete="off">
              <div class="field field--brandname">
                <label class="field__label" for="brand-name">${tryIt.brandName}</label>
                <div class="brandname">
                  <input
                    class="field__input brandname__input"
                    id="brand-name"
                    name="brand"
                    type="text"
                    maxlength="32"
                    placeholder="${tryIt.brandPlaceholder}"
                    spellcheck="false"
                    autocapitalize="words"
                    enterkeyhint="done"
                  />
                  <button class="button button--brand brandname__print" type="submit">${tryIt.print}</button>
                </div>
              </div>
              <fieldset class="field swatches">
                <legend class="field__label">${tryIt.colour}</legend>
                <div class="swatches__list">
                  ${presets.map(
                    (p, i) =>
                      html`<label class="swatch"
                        ><input
                          type="radio"
                          name="colour"
                          value="${p.hex}"
                          ${attr(i === 0, 'data-default')}
                        /><span class="swatch__chip" style="--swatch:${p.hex}"></span
                        ><span class="swatch__name">${p.name}</span></label
                      >`,
                  )}
                  <label class="swatch swatch--custom"
                    ><input type="radio" name="colour" value="custom" data-custom-radio /><span
                      class="swatch__chip swatch__chip--custom"
                      data-custom-chip
                    ></span
                    ><span class="swatch__name">${tryIt.custom}</span></label
                  >
                  <label class="swatch__picker"
                    ><span class="visually-hidden">${tryIt.customHint}</span
                    ><input type="color" value="#1B98E0" data-custom-colour
                  /></label>
                </div>
              </fieldset>
              <div class="try__pair">
                <fieldset class="field segmented">
                  <legend class="field__label">${tryIt.finish}</legend>
                  <div class="segmented__list">
                    ${finishes.map(
                      (f, i) =>
                        html`<label class="segment"
                          ><input
                            type="radio"
                            name="finish"
                            value="${f.id}"
                            ${attr(i === 0, 'checked')}
                          /><span>${f.name}</span></label
                        >`,
                    )}
                  </div>
                </fieldset>
                <fieldset class="field segmented">
                  <legend class="field__label">${tryIt.style}</legend>
                  <div class="segmented__list">
                    ${labelStyles.map(
                      (s, i) =>
                        html`<label class="segment segment--${s.id}"
                          ><input
                            type="radio"
                            name="style"
                            value="${s.id}"
                            ${attr(i === 0, 'checked')}
                          /><span>${s.name}</span></label
                        >`,
                    )}
                  </div>
                </fieldset>
              </div>
              <div class="field logo">
                <label class="button button--line button--small logo__button" for="logo-file"
                  >${tryIt.logo}</label
                >
                <input
                  class="visually-hidden"
                  id="logo-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-describedby="logo-hint logo-error"
                  data-logo-input
                />
                <button class="button button--line button--small" type="button" data-logo-remove hidden>
                  ${tryIt.logoRemove}
                </button>
                <p class="field__hint" id="logo-hint">${tryIt.logoHint}</p>
                <p class="field__error" id="logo-error" data-logo-error hidden></p>
              </div>
              <div class="try__actions">
                <button class="button button--line button--small" type="button" data-download>
                  ${tryIt.download}
                </button>
                <button class="button button--line button--small" type="button" data-share hidden>
                  ${tryIt.share}
                </button>
                <p class="try__status smallprint" role="status" aria-live="polite" data-print-status></p>
              </div>
            </form>
          </div>
          <div class="stage-slot try__slot" data-slot="try">
            <div
              class="spin"
              role="slider"
              tabindex="0"
              aria-label="${tryIt.stageLabel}"
              aria-valuemin="0"
              aria-valuemax="359"
              aria-valuenow="0"
              aria-valuetext="${tryIt.rotationText(0)}"
              aria-orientation="horizontal"
              data-spin
            ></div>
            <p class="spin__hint smallprint" aria-hidden="true">${tryIt.dragHint}</p>
            <div class="spin__buttons">
              <button class="button button--line button--small" type="button" data-turn="-1">
                ${tryIt.turnLeft}
              </button>
              <button class="button button--line button--small" type="button" data-turn="1">
                ${tryIt.turnRight}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="scene scene--lineup" id="lineup" data-scene="lineup" aria-labelledby="lineup-title">
        <div class="scene__inner lineup">
          <div class="lineup__copy">
            <h2 class="heading" id="lineup-title" data-split>${lineup.heading}</h2>
            <p>${lineup.body}</p>
          </div>
          <ol class="lineup__captions smallprint">
            ${lineup.captions.map((c, i) => html`<li class="lineup__caption" data-caption="${i}">${c}</li>`)}
          </ol>
          <div class="stage-slot lineup__slot" data-slot="lineup" aria-hidden="true"></div>
        </div>
      </section>

      <section class="scene scene--process" id="process" data-scene="process" aria-labelledby="process-title">
        <div class="scene__inner process">
          <div class="process__copy">
            <h2 class="heading" id="process-title" data-split>${process.heading}</h2>
          </div>
          <ol class="process__steps">
            ${process.steps.map(
              (s, i) =>
                html`<li class="step-card" data-beat="${i}">
                  <p class="step-card__n" aria-hidden="true">${s.n}</p>
                  <h3 class="step-card__title"><span class="visually-hidden">${s.n} </span>${s.title}</h3>
                  <p class="step-card__body">${s.body}</p>
                </li>`,
            )}
          </ol>
          <div class="stage-slot process__slot" data-slot="process" aria-hidden="true">
            ${cropMarks('crop--dieline')}
          </div>
        </div>
      </section>

      <section class="scene scene--build" id="build" data-scene="build" aria-labelledby="build-title">
        <div class="scene__inner build">
          <h2 class="heading" id="build-title" data-split>${build.heading}</h2>
          <dl class="build__list">
            ${build.items.map(
              (it) =>
                html`<div class="build__item">
                  <dt class="build__term">
                    <span class="build__swatch" aria-hidden="true"></span>${it.term}
                  </dt>
                  <dd class="build__desc">${it.desc}</dd>
                </div>`,
            )}
          </dl>
          <p class="build__manila">${build.manila}</p>
        </div>
      </section>

      ${workSection()}

      <section class="scene scene--brief" id="brief" data-scene="brief" aria-labelledby="brief-title">
        <div class="scene__inner brief">
          <div class="brief__head">
            <h2 class="heading" id="brief-title" tabindex="-1" data-brief-title>${brief.heading}</h2>
            <p class="lede">${brief.intro}</p>
          </div>
          <div class="ticket" data-ticket>
            <div class="ticket__head">
              <p class="ticket__title">${brief.ticket}</p>
              <p class="ticket__job">
                <span class="field__label">${brief.jobLabel}</span>
                <span class="ticket__jobno" data-job></span>
              </p>
              <ol class="ticket__stamps" aria-label="${brief.stampsLabel}">
                ${brief.steps.map(
                  (s, i) =>
                    html`<li class="ticket__stamp" data-stamp="${i}">
                      <span class="ticket__stamp-name">${s}</span
                      ><span class="stamp" data-stamp-mark hidden>${brief.stamp}</span>
                    </li>`,
                )}
              </ol>
            </div>
            ${briefForm()}
            <div class="brief-result" data-result tabindex="-1" hidden>
              <p class="brief-result__msg">${brief.success}</p>
              <p class="brief-result__job" data-result-job></p>
              <button class="button button--brand" type="button" data-download>${tryIt.download}</button>
            </div>
          </div>
          <div class="stage-slot brief__slot" data-slot="brief" aria-hidden="true"></div>
        </div>
      </section>
    </main>
    ${siteFooter()}`.__raw;
}
