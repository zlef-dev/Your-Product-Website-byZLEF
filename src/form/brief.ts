/**
 * The brief form: four fieldsets shown one at a time on a job ticket, validated on blur
 * and on Next, delivered by Web3Forms or, without a key, as a pre-filled email draft.
 */
import { contactEmail, studioName, web3formsKey, wordmark } from '../config';
import { brief } from '../content';
import { brand } from '../lib/brand';
import { copyText } from '../lib/clipboard';
import { $, $$ } from '../lib/dom';
import { jobNumber } from '../lib/job';
import { mailtoUrl } from './mailto';
import { briefText, readBrief, subjectFor, toPayload, type LabelSettings } from './serialize';
import { sendBrief } from './submit';
import { STEP_FIELDS, validateField, type FieldName } from './validate';

export const BRIEF_SENT = 'site:brief-sent';

type Control = HTMLInputElement | HTMLTextAreaElement;

export function initBriefForm(): void {
  const form = $<HTMLFormElement>('#brief-form');
  const ticket = $('[data-ticket]');
  if (!form || !ticket) return;

  const steps = $$<HTMLFieldSetElement>('fieldset.step', form);
  const total = steps.length;
  const backBtn = $<HTMLButtonElement>('[data-back]', form)!;
  const nextBtn = $<HTMLButtonElement>('[data-next]', form)!;
  const sendBtn = $<HTMLButtonElement>('[data-send]', form)!;
  const copyBtn = $<HTMLButtonElement>('[data-copy-brief]', form);
  const mailtoNote = $('[data-mailto-note]', form);
  const privacyLine = $('[data-privacy-line]', form)!;
  const stepStatus = $('[data-step-status]', form)!;
  const formStatus = $('[data-form-status]', form)!;
  const sendError = $('[data-send-error]', form)!;
  const summary = $('[data-summary]', form)!;
  const summaryTitle = $('[data-summary-title]', form)!;
  const summaryList = $('[data-summary-list]', form)!;
  const result = $('[data-result]', ticket)!;
  const resultJob = $('[data-result-job]', ticket)!;
  const jobEl = $('[data-job]', ticket)!;
  const stamps = $$('[data-stamp]', ticket);
  const brandInput = $<HTMLInputElement>('#f-brand', form)!;
  const goal = $<HTMLTextAreaElement>('#f-goal', form)!;
  const counter = $('[data-counter]', form);

  const mode: 'web3forms' | 'mailto' = web3formsKey ? 'web3forms' : 'mailto';
  const job = jobNumber();
  jobEl.textContent = job;

  let current = 0;
  const dirty = new Set<FieldName>();
  const shown = new Set<FieldName>();
  let brandEdited = false;

  // ---------- Field access ----------

  const fieldRoot = (name: FieldName) => $<HTMLElement>(`[data-field="${name}"]`, form)!;

  const valueOf = (name: FieldName): string | string[] => {
    const root = fieldRoot(name);
    const group = root.dataset.group;
    if (group === 'checkbox') return $$<HTMLInputElement>('input:checked', root).map((i) => i.value);
    if (group === 'radio') return $<HTMLInputElement>('input:checked', root)?.value ?? '';
    return $<Control>('input, textarea', root)?.value ?? '';
  };

  const focusTarget = (name: FieldName): HTMLElement => {
    const root = fieldRoot(name);
    if (root.dataset.group) {
      return $<HTMLInputElement>('input:checked', root) ?? $<HTMLInputElement>('input', root)!;
    }
    return $<Control>('input, textarea', root)!;
  };

  const describe = (el: HTMLElement, id: string, on: boolean) => {
    const ids = new Set((el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
    if (on) ids.add(id);
    else ids.delete(id);
    if (ids.size) el.setAttribute('aria-describedby', [...ids].join(' '));
    else el.removeAttribute('aria-describedby');
  };

  const setError = (name: FieldName, message: string | null) => {
    const root = fieldRoot(name);
    const err = $('[data-error]', root)!;
    err.textContent = message ?? '';
    err.hidden = !message;
    if (root.dataset.group) {
      root.classList.toggle('is-invalid', !!message);
      describe(root, err.id, !!message);
    } else {
      const control = $<Control>('input, textarea', root)!;
      if (message) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
      describe(control, err.id, !!message);
    }
    if (message) shown.add(name);
    else shown.delete(name);
  };

  const check = (name: FieldName) => {
    const message = validateField(name, valueOf(name));
    setError(name, message);
    return message;
  };

  // ---------- Steps ----------

  const clearSummary = () => {
    summary.hidden = true;
    summaryList.replaceChildren();
  };

  const showSummary = (errors: Array<[FieldName, string]>) => {
    summaryTitle.textContent = brief.summary(errors.length);
    summaryList.replaceChildren(
      ...errors.map(([name, message]) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        const target = focusTarget(name);
        a.href = `#${target.id}`;
        a.textContent = message;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          target.focus();
        });
        li.append(a);
        return li;
      }),
    );
    summary.hidden = false;
  };

  const validateStep = (index: number): Array<[FieldName, string]> => {
    const errors: Array<[FieldName, string]> = [];
    (STEP_FIELDS[index] ?? []).forEach((name) => {
      const message = check(name);
      if (message) errors.push([name, message]);
    });
    return errors;
  };

  const stamp = (index: number, on: boolean) => {
    const mark = $('[data-stamp-mark]', stamps[index] ?? document.body);
    if (!mark) return;
    if (on && mark.hidden) {
      mark.hidden = false;
      mark.classList.add('is-new');
      mark.addEventListener('animationend', () => mark.classList.remove('is-new'), { once: true });
    } else if (!on) {
      mark.hidden = true;
    }
  };

  const render = (focus: boolean) => {
    steps.forEach((s, i) => (s.hidden = i !== current));
    stamps.forEach((s, i) => s.classList.toggle('is-current', i === current));
    const last = current === total - 1;
    backBtn.hidden = current === 0;
    nextBtn.hidden = last;
    sendBtn.hidden = !last;
    privacyLine.hidden = !last;
    if (copyBtn) copyBtn.hidden = !(last && mode === 'mailto');
    if (mailtoNote) mailtoNote.hidden = !(last && mode === 'mailto');
    clearSummary();
    if (focus) {
      const legend = $<HTMLElement>('legend', steps[current]!);
      legend?.focus({ preventScroll: true });
      legend?.scrollIntoView({ block: 'nearest' });
      stepStatus.textContent = brief.stepAnnounce(current + 1, total, brief.steps[current] ?? '');
    }
  };

  const goTo = (index: number) => {
    current = Math.max(0, Math.min(total - 1, index));
    render(true);
  };

  const failStep = (errors: Array<[FieldName, string]>) => {
    showSummary(errors);
    const first = errors[0];
    if (first) focusTarget(first[0]).focus();
  };

  const next = () => {
    const errors = validateStep(current);
    if (errors.length) {
      failStep(errors);
      return;
    }
    stamp(current, true);
    goTo(current + 1);
  };

  // ---------- Events ----------

  nextBtn.addEventListener('click', next);
  backBtn.addEventListener('click', () => goTo(current - 1));

  // Enter in a single-line field moves on instead of submitting early.
  form.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Enter' && t instanceof HTMLInputElement && (t.type === 'text' || t.type === 'email')) {
      if (current < total - 1) {
        e.preventDefault();
        next();
      }
    }
  });

  form.addEventListener('input', (e) => {
    const t = e.target as Control;
    const name = t.closest<HTMLElement>('[data-field]')?.dataset.field as FieldName | undefined;
    if (!name) return;
    dirty.add(name);
    if (name === 'brand') brandEdited = true;
    if (t === goal && counter)
      counter.textContent = brief.fields.counter(Array.from(goal.value).length, brief.fields.goalMax);
  });

  // Chips are clicks, not typing: re-check a group straight away once it has shown an error.
  form.addEventListener('change', (e) => {
    const root = (e.target as HTMLElement).closest<HTMLElement>('[data-field]');
    const name = root?.dataset.field as FieldName | undefined;
    if (!name || !root?.dataset.group) return;
    dirty.add(name);
    if (shown.has(name)) check(name);
  });

  form.addEventListener('focusout', (e) => {
    const root = (e.target as HTMLElement).closest<HTMLElement>('[data-field]');
    const name = root?.dataset.field as FieldName | undefined;
    if (!name || !root) return;
    const next = e.relatedTarget as Node | null;
    if (next && root.contains(next)) return;
    if (dirty.has(name) || shown.has(name)) check(name);
  });

  const labelSettings = (): LabelSettings => {
    const s = brand.get();
    return { colour: s.colour, finish: s.finish, style: s.style };
  };

  const collect = () => readBrief(new FormData(form));

  const openMailto = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
  };

  const succeed = () => {
    stamp(total - 1, true);
    form.hidden = true;
    resultJob.textContent = brief.successJob(job);
    result.hidden = false;
    result.focus();
    window.dispatchEvent(new CustomEvent(BRIEF_SENT, { detail: { job } }));
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (current < total - 1) {
      next();
      return;
    }
    // Re-check every step; jump back to the first one that fails.
    for (let i = 0; i < total; i++) {
      const errors = validateStep(i);
      if (errors.length) {
        if (i !== current) goTo(i);
        failStep(errors);
        return;
      }
    }
    sendError.hidden = true;
    const bot = $<HTMLInputElement>('input[name="botcheck"]', form);
    if (bot?.checked) {
      succeed();
      return;
    }
    const data = collect();

    if (mode === 'mailto') {
      openMailto(mailtoUrl(contactEmail, subjectFor(data, job), briefText(data, labelSettings(), job)));
      formStatus.textContent = brief.mailtoOpened;
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = brief.sending;
    form.setAttribute('aria-busy', 'true');
    formStatus.textContent = brief.sending;
    const res = await sendBrief(toPayload(data, labelSettings(), job, web3formsKey, studioName ?? wordmark));
    form.removeAttribute('aria-busy');
    sendBtn.disabled = false;
    sendBtn.textContent = brief.send;
    formStatus.textContent = '';
    if (res.ok) {
      succeed();
    } else {
      sendError.textContent = brief.error(contactEmail);
      sendError.hidden = false;
    }
  });

  copyBtn?.addEventListener('click', async () => {
    const ok = await copyText(briefText(collect(), labelSettings(), job));
    formStatus.textContent = ok ? brief.copied : '';
  });

  // Prefill the brand from the try-it can until the visitor edits the field themselves.
  brand.subscribe((s, meta) => {
    if (!meta.personalised || brandEdited || !s.name) return;
    brandInput.value = s.name;
    if (shown.has('brand')) check('brand');
  }, true);

  render(false);
}
