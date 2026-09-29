# Insert your brand here

A cinematic, scroll-driven website for an independent web design studio in Manila. Every brand starts as a white label: the hero is a blank aluminium can whose label reads INSERT YOUR BRAND HERE. Visitors type their brand name, pick a colour, and the can prints it live in 3D, in four CMYK passes. From then on the site is theirs. The bottle, jar and box wear their label, the interface takes their colour, and the brief form is prefilled with their name. The page ends with a short project brief that goes straight to the studio's inbox.

- One page (`index.html`) plus `404.html` and `privacy.html`
- Vite + TypeScript (strict), three.js, GSAP (ScrollTrigger, SplitText, CustomEase), Lenis, self-hosted Archivo Variable
- No backend, no cookies, no analytics. Briefs are sent by [Web3Forms](https://web3forms.com), or as a pre-filled email when no key is set.

## Quick start

Requires Node 22 or newer.

```bash
npm install
```

```bash
npm run dev
```

Other scripts:

| Script                            | What it does                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run build`                   | Type-checks, then builds to `dist/`                                                                      |
| `npm run preview`                 | Serves `dist/` with the production security headers                                                      |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                                                        |
| `npm run test`                    | Unit tests (Vitest)                                                                                      |
| `npm run test:e2e`                | End-to-end tests (Playwright; first run `npx playwright install`)                                        |
| `npm run screenshots`             | Every scene at 390×844, 768×1024 and 1440×900 into `qa/screenshots/` (`-- --reduced` for reduced motion) |
| `npm run lighthouse`              | Lighthouse desktop and mobile against the build, reports in `qa/` (`-- --runs=3` for a median)           |
| `npm run perf`                    | Frame times while scrolling, unthrottled and at 4× CPU throttling, into `qa/perf.json`                   |
| `npm run og`                      | Screenshots the hero at 1200×630 into `public/og.png` (run after a build, then build again)              |
| `npm run analyze`                 | Build with a bundle treemap at `qa/bundle.html`                                                          |

The scripts that need a build (`screenshots`, `lighthouse`, `perf`, `og`) run `vite preview` themselves. Add `?debug` to the URL for a frame-time readout.

## Where to edit things

| What                                                                                | Where                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Studio name, email, social links, site URL, reply time, availability, selected work | `src/config.ts` (`site`)                                                                                                  |
| **The price range**                                                                 | `src/config.ts` → `site.price` (it appears only in the brief form's price note, its budget options and the email subject) |
| Every word on the site                                                              | `src/content.ts`                                                                                                          |
| Colours, type scale, spacing                                                        | `src/styles/tokens.css`                                                                                                   |
| Label presets (Cherry, Citrus, …)                                                   | `src/content.ts` → `presets`                                                                                              |
| Label artwork                                                                       | `src/label/draw.ts`                                                                                                       |
| Scene choreography                                                                  | `src/scroll/director.ts`                                                                                                  |

The HTML is rendered from `content.ts` at build time, so the headline and all copy ship as real HTML.

Anything in `config.ts` still wrapped in `[square brackets]` counts as unset and never appears on the page, in meta tags or in JSON-LD:

- no studio name: the wordmark reads "Your studio here" and the title reads "Websites for brands";
- no email: the email block in the footer is hidden;
- no social links: they're hidden;
- no site URL: the canonical link, `og:url` and sitemap are left out.

To show selected work, add entries to `site.work` (title, year, role, one-line outcome, link, optional image in `public/`). The section and its scene-index entry appear automatically.

## Briefs by email: Web3Forms

1. Go to [web3forms.com](https://web3forms.com), enter the email address that should receive briefs, and copy the access key they send. The free plan is enough. The key is meant to be public.
2. Locally, create `.env` in the project root:

   ```
   VITE_WEB3FORMS_KEY=your-access-key
   ```

3. On Cloudflare Pages, add the same variable under **Settings → Environment variables** for Production (and Preview if you want previews to send).

Without a key the site still works: "Send brief" opens the visitor's email app with the whole brief filled in, addressed to `contactEmail`, and a "Copy brief" button copies it.

## Deploying to Cloudflare Pages

1. Push the repository to GitHub.
2. In Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, pick the repository.
3. Build settings: framework preset **None**, build command `npm run build`, build output directory `dist`.
4. Environment variables: `VITE_WEB3FORMS_KEY` (see above). Set `NODE_VERSION` to `22` if the default is older.
5. Deploy. `dist/_headers` sets the Content-Security-Policy and security headers, plus long-lived caching for hashed assets. Cloudflare serves `404.html` for unknown paths automatically.

Cloudflare's free plan allows commercial use.

## Before you launch

- [ ] Fill in every `[placeholder]` in `src/config.ts`: studio name, contact email, social links, site URL.
- [ ] Set `VITE_WEB3FORMS_KEY` on Cloudflare Pages, then **send yourself a real test brief** from the live site and check it arrives, with a working reply-to.
- [ ] Check the price range and availability line in `src/config.ts`.
- [ ] Rebuild the OG image with your name in the header: `npm run build`, `npm run og`, `npm run build`. Then check the link preview in a social card validator.
- [ ] Optional: add a custom domain in Cloudflare Pages (**Custom domains**) and set `siteUrl` to it, so the canonical URL, `og:url` and `sitemap.xml` are right.
- [ ] Optional: add selected work to `site.work`.
- [ ] Look through the site on a real phone.

## Project docs

- `PLAN.md`: architecture, file tree, milestones
- `DECISIONS.md`: every judgement call, one line each
- `QA.md`: test results, Lighthouse scores, frame times, screenshot index, known limitations
- `PROGRESS.md`: milestone checklist

Fonts: Archivo and Fraunces are under the SIL Open Font License, via Fontsource.
