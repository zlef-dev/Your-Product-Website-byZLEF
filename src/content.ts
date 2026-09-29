/**
 * Every word on the site. Edit copy here; components only read it.
 * Sentence case, plain active verbs, no exclamation marks around money.
 */
import { priceRange, site, studioName, wordmark } from './config.ts';

/** "Acme" → "Acme’s", "Bliss" → "Bliss’". */
export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

export const meta = {
  title: studioName ? `Websites for brands | ${studioName}` : 'Websites for brands',
  description:
    'Cinematic, fast websites for brands, designed and built by an independent studio in Manila, Philippines.',
  personalisedTitle: (brand: string) => `${brand} × ${wordmark}`,
};

export const chrome = {
  skip: 'Skip to the brief',
  startBrief: 'Start a brief',
  sceneIndex: 'Scenes',
  sceneLabel: (n: number, total: number, name: string) => `Scene ${n} of ${total}: ${name}`,
};

export const scenes = {
  hero: 'White label',
  tryIt: 'Try it on',
  lineup: 'Can, bottle, jar or box',
  process: 'From white label to launch',
  build: 'What I build',
  work: 'Selected work',
  brief: 'The brief',
  footer: 'Contact',
} as const;

export const hero = {
  h1: 'Let’s build your brand’s website.',
  sub: 'I design and build websites for brands: cinematic, fast and made to sell.',
  tryIt: 'Try your brand on the can',
  startBrief: 'Start a brief',
  location: 'Independent studio in Manila, Philippines. Working with brands everywhere.',
};

export const tryIt = {
  heading: 'Go on, try it on.',
  body: 'Type your brand name, pick a colour and watch it print. Your website can feel like this.',
  brandName: 'Brand name',
  brandPlaceholder: 'Your brand name',
  colour: 'Label colour',
  custom: 'Custom',
  customHint: 'Pick any colour',
  finish: 'Finish',
  style: 'Label style',
  logo: 'Add a logo (it stays on your device)',
  logoHint: 'PNG, JPG or WebP, up to 5 MB.',
  logoRemove: 'Remove logo',
  logoTooBig: 'That file is over 5 MB. Try a smaller one.',
  logoWrongType: 'Use a PNG, JPG or WebP file.',
  logoUnreadable: 'That image couldn’t be read. Try another file.',
  print: 'Print it',
  download: 'Download your can',
  share: 'Share',
  shareText: (brand: string) => `${brand}, printed on a can.`,
  turnLeft: 'Turn left',
  turnRight: 'Turn right',
  dragHint: 'Drag to spin',
  stageLabel: 'Your can. Use the left and right arrow keys to turn it.',
  rotationText: (deg: number) => `Turned ${deg} degrees`,
  printed: (name: string) => `Printed: ${name}`,
  sampleName: 'Your brand',
  blankLabel: 'INSERT YOUR BRAND HERE',
};

export const presets = [
  { name: 'Cherry', hex: '#D7263D' },
  { name: 'Citrus', hex: '#F9A620' },
  { name: 'Lagoon', hex: '#1B98E0' },
  { name: 'Mint', hex: '#3DDC97' },
  { name: 'Grape', hex: '#6B2D5C' },
  { name: 'Ink', hex: '#231F20' },
] as const;

export const finishes = [
  { id: 'gloss', name: 'Gloss' },
  { id: 'satin', name: 'Satin' },
  { id: 'matte', name: 'Matte' },
] as const;

export const labelStyles = [
  { id: 'wide', name: 'Wide' },
  { id: 'tall', name: 'Tall' },
  { id: 'classic', name: 'Classic' },
] as const;

export const lineup = {
  heading: 'Can, bottle, jar or box.',
  body: 'Whatever you make, your website should feel as good as holding it.',
  captions: ['355 mL can', '750 mL bottle', '50 mL jar', 'Mailer box'],
};

export const process = {
  heading: 'From white label to launch.',
  steps: [
    {
      n: '01',
      title: 'Brief',
      body: 'You tell me about your brand, who it’s for and when the site needs to go live.',
    },
    {
      n: '02',
      title: 'Direction',
      body: 'We choose one idea worth remembering and a look that could only be yours.',
    },
    { n: '03', title: 'Design', body: 'Every page designed around your brand, starting on mobile.' },
    { n: '04', title: 'Build', body: 'Fast, accessible code, with content you can update yourself.' },
    { n: '05', title: 'Launch', body: 'Tested on real phones, then live. I stay on after launch for fixes.' },
  ],
};

export const build = {
  heading: 'What I build',
  items: [
    { term: 'Brand websites', desc: 'A home for your brand that people remember.' },
    { term: 'Landing pages', desc: 'One focused page for a launch, a product or a campaign.' },
    { term: 'Online stores', desc: 'Shops that look like your brand and are easy to buy from.' },
    { term: 'Redesigns', desc: 'Keep what works, rebuild what doesn’t, and make it fast.' },
  ],
  manila:
    'I work from Manila, Philippines. You get the craft of a design studio at a fairer price than most, with one person handling your project from first sketch to launch.',
};

export const work = {
  heading: 'Selected work',
  visit: (title: string) => `Visit ${title}`,
};

export const brief = {
  heading: 'Let’s build your website.',
  headingFor: (brand: string) => `Let’s build ${possessive(brand)} website.`,
  intro:
    'Tell me about your brand. It takes about two minutes and lands straight in my inbox. No bots, no mailing lists.',
  ticket: 'Job ticket',
  jobLabel: 'Job no.',
  stampsLabel: 'Checked',
  stamp: 'Checked',
  steps: ['The brand', 'The website', 'The details', 'You'],
  stepAnnounce: (n: number, total: number, title: string) => `Step ${n} of ${total}: ${title}`,
  required: 'required',
  optional: 'optional',
  fields: {
    brand: 'Brand name',
    current: 'Current website or Instagram',
    currentHint: 'A link or an @handle.',
    does: 'What does your brand do?',
    doesOptions: [
      'Drinks',
      'Food',
      'Beauty & skincare',
      'Fashion',
      'Home',
      'Tech',
      'Services',
      'Something else',
    ],
    need: 'What do you need?',
    needHint: 'Choose at least one.',
    needOptions: ['New website', 'Landing page', 'Online store', 'Redesign', 'Not sure yet'],
    goal: 'What should the website do for you?',
    goalMax: 160,
    counter: (used: number, max: number) => `${used} of ${max} characters`,
    budget: 'Budget',
    budgetOptions: [
      `Under ${priceRange.min}`,
      `${priceRange.min}–${priceRange.max}`,
      `${priceRange.max}–${site.price.currency}3,000`,
      `${site.price.currency}3,000+`,
      'Not sure yet',
    ],
    timeline: 'Timeline',
    timelineOptions: ['As soon as possible', 'In 1–2 months', 'In 3+ months', 'Flexible'],
    notes: 'Anything else?',
    name: 'Your name',
    email: 'Email',
    based: 'Where are you based?',
    assets: 'Link to brand assets',
    assetsHint: 'Google Drive, Dropbox or similar.',
  },
  priceNote: `Most websites I build land between ${priceRange.min} and ${priceRange.max}, depending on pages and features. I’ll confirm a fixed quote after reading your brief.`,
  next: 'Next',
  back: 'Back',
  send: 'Send brief',
  sending: 'Sending…',
  copy: 'Copy brief',
  copied: 'Brief copied.',
  privacyLine: 'I’ll only use your details to reply to this brief.',
  noKeyNote: 'Your email app will open with the brief filled in.',
  mailtoOpened:
    'Your email app should open with the brief filled in. If it doesn’t, copy the brief and email it.',
  success: `Brief sent. I’ll reply within ${site.replyWithin} with a fixed quote and next steps.`,
  successJob: (job: string) => `Your job number is ${job}.`,
  error: (email: string | null) =>
    email
      ? `The brief didn’t send. Check your connection and try again, or email ${email}.`
      : 'The brief didn’t send. Check your connection and try again.',
  summary: (n: number) => (n === 1 ? 'Fix 1 thing to continue:' : `Fix ${n} things to continue:`),
  errors: {
    brand: 'Enter your brand name.',
    does: 'Choose what your brand does.',
    need: 'Choose at least one thing you need.',
    goal: 'Tell me what the website should do.',
    goalLong: 'Keep it to 160 characters.',
    budget: 'Choose a budget.',
    timeline: 'Choose a timeline.',
    name: 'Enter your name.',
    email: 'Enter your email address.',
    emailInvalid: 'Enter an email address like name@example.com.',
    url: 'Enter a link like example.com or an @handle.',
    assetsUrl: 'Enter a link like drive.google.com/…',
  },
};

export const footer = {
  headline: 'Your brand here.',
  headlineFor: (brand: string) => `${brand}. Launching soon.`,
  email: 'Email',
  copyEmail: 'Copy email',
  copied: 'Email copied.',
  based: `Based in ${site.basedIn}`,
  clockLabel: 'Local time in Manila',
  availability: `${site.availability}.`,
  privacy: 'Privacy',
  social: 'Elsewhere',
};

export const notFound = {
  title: 'Out of stock',
  h1: 'This page is out of stock.',
  line: 'The can you’re after isn’t on this shelf.',
  back: 'Back to the shelf',
};

export const privacy = {
  title: 'Privacy',
  h1: 'Privacy',
  body: 'This site doesn’t use cookies or analytics. If you send a brief, it’s delivered to my inbox by Web3Forms so I can reply. I don’t add you to any list, and I’ll delete your details whenever you ask.',
  askLine: (email: string) => `To see or delete what I hold, email ${email}.`,
  back: 'Back to the site',
};

/** Label small print. Packaging, not interface, so capitals are allowed here. */
export const labelCopy = {
  volume: '355 mL',
  bottleVolume: '750 mL',
  jarVolume: '50 mL',
  ingredients: 'Ingredients: one good idea, a deadline, taste.',
  bestBefore: 'Best before: launch day.',
  serving: 'Serving suggestion: share it.',
  boxNote: 'Contents: one website, ready to launch.',
  printedIn: `Printed in Manila by ${wordmark}`,
  proofTitle: 'Proof',
  trim: 'Trim',
  bleed: 'Bleed',
  seam: 'Seam',
};
