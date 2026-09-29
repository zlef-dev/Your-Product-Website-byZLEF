/**
 * Site configuration. Edit the values in `site` before launch.
 *
 * Anything still wrapped in [square brackets] counts as unset: it never reaches
 * the UI, meta tags or JSON-LD, and the fallbacks described next to each field apply.
 * README.md ("Before you launch") lists every field.
 */

export interface WorkItem {
  title: string;
  year: number;
  role: string;
  /** One line about the outcome. */
  outcome: string;
  href: string;
  /** Optional path to an image in /public, e.g. "/work/acme.webp". */
  image?: string;
  imageAlt?: string;
}

export interface SocialLink {
  label: string;
  href: string;
}

export const site = {
  /** Unset → the wordmark reads "Your studio here". */
  studioName: '[Your studio name]',
  /** Unset → the email UI is hidden (a warning is logged in development). */
  contactEmail: '[you@example.com]',
  basedIn: 'Manila, Philippines',
  locality: 'Manila',
  countryCode: 'PH',
  timeZone: 'Asia/Manila',
  /** Shown only in the brief form's price note and the brief email subject. */
  price: { currency: 'A$', min: 1250, max: 1500 },
  /** Unset links are hidden. */
  social: [
    { label: 'Instagram', href: '[Instagram URL]' },
    { label: 'LinkedIn', href: '[LinkedIn URL]' },
    { label: 'GitHub', href: '[GitHub URL]' },
  ] satisfies SocialLink[],
  /** Public origin, e.g. "https://studio.com". Unset → no canonical, og:url, robots sitemap line or sitemap.xml. */
  siteUrl: '[https://your-domain.com]',
  replyWithin: 'one business day',
  availability: 'Booking website projects for next month',
  /** Selected work. Leave empty to hide the section and its scene index entry. */
  work: [] as WorkItem[],
};

const env: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

/** Web3Forms access key (public by design). Set VITE_WEB3FORMS_KEY at build time. */
export const web3formsKey = (env.VITE_WEB3FORMS_KEY ?? '').trim();

/** True when a value is empty or still a [bracketed] placeholder. */
export function isUnset(value: string | undefined | null): boolean {
  if (!value) return true;
  const v = value.trim();
  return v === '' || (v.startsWith('[') && v.endsWith(']'));
}

export const studioName: string | null = isUnset(site.studioName) ? null : site.studioName.trim();
/** What the interface prints where the studio name goes. */
export const wordmark = studioName ?? 'Your studio here';
export const contactEmail: string | null = isUnset(site.contactEmail) ? null : site.contactEmail.trim();
export const siteUrl: string | null = isUnset(site.siteUrl) ? null : site.siteUrl.trim().replace(/\/+$/, '');
export const socialLinks: SocialLink[] = site.social.filter((s) => !isUnset(s.href));

const money = (n: number) => `${site.price.currency}${n.toLocaleString('en-AU')}`;
export const priceRange = { min: money(site.price.min), max: money(site.price.max) };
