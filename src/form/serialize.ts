/** Turns the brief into clean data, a Web3Forms payload, and a plain-text email body. */
import { brief } from '../content';
import { cleanLine, cleanMultiline } from '../lib/sanitize';
import type { FieldName } from './validate';

export interface BriefData {
  brand: string;
  current: string;
  does: string;
  need: string[];
  goal: string;
  budget: string;
  timeline: string;
  notes: string;
  name: string;
  email: string;
  based: string;
  assets: string;
}

export interface LabelSettings {
  colour: string;
  finish: string;
  style: string;
}

const LIMITS: Record<Exclude<FieldName, 'need'>, number> = {
  brand: 80,
  current: 200,
  does: 40,
  goal: brief.fields.goalMax,
  budget: 40,
  timeline: 40,
  notes: 2000,
  name: 100,
  email: 200,
  based: 100,
  assets: 300,
};

/** Anything with FormData's get/getAll shape, so it can be unit-tested without a DOM. */
export interface FormLike {
  get(name: string): unknown;
  getAll(name: string): unknown[];
}

export function readBrief(fd: FormLike): BriefData {
  const line = (k: Exclude<FieldName, 'need'>) => cleanLine(fd.get(k) ?? '', LIMITS[k]);
  const allowedNeeds = new Set<string>(brief.fields.needOptions);
  return {
    brand: line('brand'),
    current: line('current'),
    does: line('does'),
    need: fd
      .getAll('need')
      .map((v) => cleanLine(v, 40))
      .filter((v) => allowedNeeds.has(v)),
    goal: cleanMultiline(fd.get('goal') ?? '', LIMITS.goal).replace(/\n+/g, ' '),
    budget: line('budget'),
    timeline: line('timeline'),
    notes: cleanMultiline(fd.get('notes') ?? '', LIMITS.notes),
    name: line('name'),
    email: line('email'),
    based: line('based'),
    assets: line('assets'),
  };
}

export function subjectFor(d: BriefData, job: string): string {
  return `New website brief: ${d.brand}, ${d.budget} (${job})`;
}

const LABELS: Array<[keyof BriefData, string]> = [
  ['brand', brief.fields.brand],
  ['current', brief.fields.current],
  ['does', brief.fields.does],
  ['need', brief.fields.need],
  ['goal', brief.fields.goal],
  ['budget', brief.fields.budget],
  ['timeline', brief.fields.timeline],
  ['notes', brief.fields.notes],
  ['name', brief.fields.name],
  ['email', brief.fields.email],
  ['based', brief.fields.based],
  ['assets', brief.fields.assets],
];

const show = (v: string | string[]) => (Array.isArray(v) ? v.join(', ') : v) || '(none)';

/** The whole brief as plain text, for the mailto body and the "Copy brief" button. */
export function briefText(d: BriefData, label: LabelSettings, job: string): string {
  const lines = [`Job number: ${job}`, ''];
  LABELS.forEach(([k, l]) => lines.push(`${l}: ${show(d[k])}`));
  lines.push('', `Label they tried: ${label.colour}, ${label.finish}, ${label.style}`);
  return lines.join('\n');
}

export function toPayload(
  d: BriefData,
  label: LabelSettings,
  job: string,
  accessKey: string,
  fromName: string,
): Record<string, string | boolean> {
  return {
    access_key: accessKey,
    subject: subjectFor(d, job),
    from_name: fromName,
    // Web3Forms uses "email" as the reply-to address.
    email: d.email,
    name: d.name,
    job_number: job,
    brand: d.brand,
    current_website: d.current,
    brand_does: d.does,
    needs: d.need.join(', '),
    website_goal: d.goal,
    budget: d.budget,
    timeline: d.timeline,
    notes: d.notes,
    based_in: d.based,
    brand_assets: d.assets,
    label_colour: label.colour,
    label_finish: label.finish,
    label_style: label.style,
    botcheck: false,
  };
}
