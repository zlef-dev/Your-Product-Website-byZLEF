import { describe, expect, it } from 'vitest';
import { mailtoUrl } from '../../src/form/mailto';
import { briefText, readBrief, subjectFor, toPayload, type BriefData } from '../../src/form/serialize';
import { sendBrief, WEB3FORMS_ENDPOINT } from '../../src/form/submit';
import { isEmail, isLinkOrHandle, STEP_FIELDS, validateField } from '../../src/form/validate';

function formLike(entries: Array<[string, string]>) {
  return {
    get: (k: string) => entries.find(([n]) => n === k)?.[1] ?? null,
    getAll: (k: string) => entries.filter(([n]) => n === k).map(([, v]) => v),
  };
}

const sample: Array<[string, string]> = [
  ['brand', '  Kopi Kalye  '],
  ['current', 'instagram.com/kopikalye'],
  ['does', 'Drinks'],
  ['need', 'New website'],
  ['need', 'Online store'],
  ['need', '<script>'],
  ['goal', 'Sell cold brew\r\nonline'],
  ['budget', 'A$1,250–A$1,500'],
  ['timeline', 'In 1–2 months'],
  ['notes', 'Line one\n\n\n\nLine two'],
  ['name', 'Ana Reyes'],
  ['email', 'ana@kopikalye.ph'],
  ['based', 'Quezon City'],
  ['assets', 'drive.google.com/abc'],
];

const label = { colour: '#1B98E0', finish: 'gloss', style: 'wide' };

describe('readBrief', () => {
  const d = readBrief(formLike(sample));

  it('trims and cleans every field', () => {
    expect(d.brand).toBe('Kopi Kalye');
    expect(d.goal).toBe('Sell cold brew online');
    expect(d.notes).toBe('Line one\n\nLine two');
  });

  it('keeps only known needs', () => {
    expect(d.need).toEqual(['New website', 'Online store']);
  });

  it('caps lengths', () => {
    const long = readBrief(
      formLike([
        ['goal', 'x'.repeat(500)],
        ['name', 'n'.repeat(500)],
      ]),
    );
    expect(long.goal).toHaveLength(160);
    expect(long.name).toHaveLength(100);
  });
});

describe('serialisation', () => {
  const d: BriefData = readBrief(formLike(sample));

  it('builds the subject line with brand, budget and job number', () => {
    expect(subjectFor(d, 'JT-260929-042')).toBe(
      'New website brief: Kopi Kalye, A$1,250–A$1,500 (JT-260929-042)',
    );
  });

  it('builds the Web3Forms payload', () => {
    const p = toPayload(d, label, 'JT-260929-042', 'key-123', 'Studio');
    expect(p.access_key).toBe('key-123');
    expect(p.from_name).toBe('Studio');
    expect(p.email).toBe('ana@kopikalye.ph');
    expect(p.subject).toContain('JT-260929-042');
    expect(p.needs).toBe('New website, Online store');
    expect(p.label_colour).toBe('#1B98E0');
    expect(p.label_finish).toBe('gloss');
    expect(p.label_style).toBe('wide');
    expect(p.job_number).toBe('JT-260929-042');
    expect(p.botcheck).toBe(false);
  });

  it('writes the whole brief as plain text', () => {
    const text = briefText(d, label, 'JT-260929-042');
    expect(text).toContain('Job number: JT-260929-042');
    expect(text).toContain('Brand name: Kopi Kalye');
    expect(text).toContain('What do you need?: New website, Online store');
    expect(text).toContain('Label they tried: #1B98E0, gloss, wide');
    expect(text).toContain('Where are you based?: Quezon City');
  });

  it('marks empty optional answers', () => {
    const text = briefText(readBrief(formLike([['brand', 'X']])), label, 'JT');
    expect(text).toContain('Anything else?: (none)');
  });
});

describe('mailtoUrl', () => {
  it('URL-encodes subject and body with CRLF line breaks', () => {
    const url = mailtoUrl('hello@studio.com', 'Brief: A&B', 'Line 1\nLine 2 & more?');
    expect(url).toBe(
      'mailto:hello@studio.com?subject=Brief%3A%20A%26B&body=Line%201%0D%0ALine%202%20%26%20more%3F',
    );
  });

  it('leaves the recipient empty when no email is configured', () => {
    expect(mailtoUrl(null, 's', 'b').startsWith('mailto:?subject=')).toBe(true);
  });

  it('cannot be broken out of by visitor input', () => {
    const url = mailtoUrl('a@b.co', 'x', 'evil&cc=someone@else.com\n?bcc=x');
    expect(url).not.toMatch(/&cc=/);
    expect(url).not.toMatch(/\?bcc=/);
  });
});

describe('validation', () => {
  it('requires the right fields in each step', () => {
    expect(STEP_FIELDS).toHaveLength(4);
    expect(validateField('brand', '')).not.toBeNull();
    expect(validateField('does', '')).not.toBeNull();
    expect(validateField('need', [])).not.toBeNull();
    expect(validateField('need', ['Redesign'])).toBeNull();
    expect(validateField('goal', '   ')).not.toBeNull();
    expect(validateField('goal', 'x'.repeat(161))).not.toBeNull();
    expect(validateField('goal', 'x'.repeat(160))).toBeNull();
    expect(validateField('budget', '')).not.toBeNull();
    expect(validateField('timeline', '')).not.toBeNull();
    expect(validateField('name', '')).not.toBeNull();
    expect(validateField('notes', '')).toBeNull();
    expect(validateField('based', '')).toBeNull();
  });

  it('checks email addresses', () => {
    expect(isEmail('ana@kopikalye.ph')).toBe(true);
    expect(isEmail('ana@kopikalye')).toBe(false);
    expect(isEmail('ana kopi@x.com')).toBe(false);
    expect(validateField('email', 'nope')).not.toBeNull();
  });

  it('accepts links, bare domains and handles for the current site', () => {
    expect(isLinkOrHandle('https://kopikalye.ph')).toBe(true);
    expect(isLinkOrHandle('instagram.com/kopikalye')).toBe(true);
    expect(isLinkOrHandle('@kopi.kalye')).toBe(true);
    expect(isLinkOrHandle('not a link')).toBe(false);
    expect(isLinkOrHandle('javascript:alert(1)')).toBe(false);
    expect(validateField('current', '')).toBeNull();
    expect(validateField('assets', '@handle')).not.toBeNull();
  });
});

describe('sendBrief', () => {
  const ok = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('posts JSON to Web3Forms and reports success', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const res = await sendBrief({ a: 1 }, f);
    expect(res).toEqual({ ok: true });
    expect(seen!.url).toBe(WEB3FORMS_ENDPOINT);
    expect(seen!.init.method).toBe('POST');
    expect(JSON.parse(String(seen!.init.body))).toEqual({ a: 1 });
  });

  it('reports rejection when Web3Forms says no', async () => {
    expect(await sendBrief({}, ok({ success: false }, 200))).toEqual({ ok: false, reason: 'rejected' });
    expect(await sendBrief({}, ok({ success: false }, 400))).toEqual({ ok: false, reason: 'rejected' });
  });

  it('reports network failures without throwing', async () => {
    const f = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await sendBrief({}, f)).toEqual({ ok: false, reason: 'network' });
  });

  it('times out', async () => {
    const f = ((_u: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        );
      })) as unknown as typeof fetch;
    expect(await sendBrief({}, f, 20)).toEqual({ ok: false, reason: 'timeout' });
  });
});
