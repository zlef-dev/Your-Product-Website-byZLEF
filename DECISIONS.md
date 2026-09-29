# Decisions

One line of reasoning per judgement call. Newest at the bottom of each section.

## Tooling

- **TypeScript 6.0, not 7.0.** `typescript@latest` is 7.0 (the native port), but `typescript-eslint` 8.71 supports only `<6.1.0`; zero ESLint errors needs a supported pair.
- **Nested git repository.** The project folder sat inside a git repo rooted at the user's home directory; milestone commits belong to the project, so it has its own `git init`.
- **Project `.npmrc` with `legacy-peer-deps=false`.** This machine's global npm config skips peer dependencies, which leaves ESLint and Vitest trees incomplete.
- **`.ts` extensions in files loaded by `vite.config.ts`.** Vite 8 warns that extensionless imports won't work with the native config loader it plans to make the default; `allowImportingTsExtensions` keeps the type checker happy.
- **Static HTML rendered from `content.ts` at build time.** A small Vite plugin renders the pages from template functions, so all copy lives in `content.ts` while the H1 (the LCP element) and all text ship as real HTML for SEO and first paint.
- **Head tags, robots.txt, sitemap.xml and manifest are generated from `config.ts`.** That is the only way to guarantee placeholders never reach meta tags or JSON-LD; the canonical URL, og:url and sitemap are omitted until `siteUrl` is set.
- **Meta title without a studio name reads "Websites for brands".** "Websites for brands | Your studio here" would look like a placeholder in search results; the UI wordmark still uses "Your studio here".
- **Playwright serves two production builds** (with and without a Web3Forms key) because the key is baked in at build time and the mailto fallback needs a keyless build; tests run against production so dev-only warnings can't leak into "no console warnings".

## Content and interface

- **The progress strip sits in the header on phones.** At the bottom-left it would collide with S2's sticky control panel and the iOS toolbar; it keeps its colour bar and hides its text there, as the brief asks.
- **"What I build" terms are not focusable.** Making non-interactive definition terms tab stops only to show a decorative swatch would add dead stops for keyboard users; the swatch shows on hover for fine pointers.
- **Footer headline sits in a dashed dieline box that fills with the brand colour after the takeover.** An empty label area waiting for a brand is the concept in miniature; it turns solid `--brand` with `--brand-ink` text once a brand is set.
- **The brief heading also speaks the brand back** ("Let's build Kopi Kalye's website.") as part of the takeover; the H1 stays fixed because it is the LCP element and the first thing everyone reads.
- **Stamps and focus rings use derived tokens.** `--brand-on-paper` (brand if ≥ 4.5:1 on paper, else process black) colours the "Checked" stamps; `--focus` (brand if ≥ 3:1) colours focus rings, so light brands like Citrus never produce an invisible ring.
- **Optional URL fields accept bare domains and @handles.** Founders type "instagram.com/acme" or "@acme", not full URLs; strict `type=url` would reject both.
- **The sample print is kept out of BrandState.** The store only holds what the visitor chose, so the sample can't trigger the takeover, prefill the form or persist as if they had typed it.
