# QA

Everything here was run on the build in this repository on 2026-09-30, on Windows 11 with an AMD Radeon integrated GPU, Node 24.20. Chromium in scripts and tests renders WebGL on that GPU through ANGLE D3D11, like desktop Chrome on Windows (`SOFTWARE_GL=1` switches to SwiftShader).

## Checks

| Check                           | Command                                                         | Result                                              |
| ------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| Types (strict), app and tooling | `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.node.json` | 0 errors                                            |
| Lint                            | `npm run lint`                                                  | 0 errors, 0 warnings                                |
| Unit tests (Vitest)             | `npm run test`                                                  | 64 passed in 4 files                                |
| Build                           | `npm run build`                                                 | passes                                              |
| End-to-end (Playwright)         | `npm run test:e2e`                                              | 43 passed, 1 skipped (Chromium 22/22, WebKit 21/22) |

### Unit tests (`tests/unit/`)

Text fitting (one/two lines, balanced breaks, never overflowing, 32-character names), the contrast ink choice for every preset, RGB→CMYK and plate separation, the decorative barcode (deterministic, never a valid EAN-13), job numbers, the print-run timeline (plate order, 6–12 px misregistration, snap to register, low-tier scaling), easing, the unwrap geometry (no stretch, never inside the can, seam peels first), sanitising, form serialisation, the Web3Forms payload and subject, the mailto URL (encoding, CRLF, no header injection), validation rules, and `sendBrief` success, refusal, network error and timeout.

### End-to-end tests (`tests/e2e/`)

Every test fails on any console error or warning, or uncaught page error. They run against production builds served with the production headers (the CSP from `build/headers.ts`), one built with a test Web3Forms key and one without.

- Home: hero renders; typing a brand updates the live region, the tab title, the footer headline, the brief heading and the form prefill; choosing a colour updates `--brand` and `--brand-ink`; "Download your can" produces a PNG; the can turns by keyboard and buttons (`role="slider"` value); "Start a brief" moves focus to the brief heading; the progress strip opens a `<nav>` scene index whose links move focus; the skip link is the first tab stop; no request leaves the site before a brief is sent.
- Form: errors are text linked with `aria-describedby`, summarised at the top of the step, and focus goes to the first invalid field; validation waits for blur; steps change by keyboard with focus on the legend and "Step 2 of 4: The website" announced; the price note exists once and shows only in the details step; mocked Web3Forms success (payload checked: key, reply-to email, subject with budget and job number, label settings) shows the success message and job number; a refusal shows the error and keeps every field; without a key, "Send brief" opens a mailto draft with the whole brief and "Copy brief" appears.
- Fallbacks: reduced-motion emulation gives no pins, no Lenis, all process steps and line-up captions on the page, an instant print and no intro strip; with `getContext` stubbed to return null for WebGL, the SVG can shows, prints, takes over the page and downloads a PNG.
- Pages: the 404 page renders with the squeezed headline (`font-stretch: 62%`) and `noindex`; the privacy page renders; meta tags and JSON-LD carry no placeholders and no price.

### Browsers

- **Chromium**: all 22 tests pass.
- **WebKit** (Playwright's Windows build): 21 pass, 1 skipped. The skip-link test is skipped because WebKit only moves Tab to links when the macOS "all controls" keyboard setting is on. WebKit refetches the font preload, because it won't reuse a preload with `crossorigin`, which Chromium and Firefox need, and logs a warning. The console guard ignores that single message in WebKit only (`tests/e2e/helpers.ts`); nothing else is ignored anywhere.
- **Firefox**: not run on this machine. Playwright's Firefox build fails to start here ("The application has failed to start because its side-by-side configuration is incorrect", a missing Visual C++ runtime). `playwright.config.ts` checks once whether Firefox starts and includes it wherever it does.

## Lighthouse

`npm run lighthouse -- --runs=3` (median by performance score) against `vite preview` of the build, Playwright's Chromium on the GPU. Reports: `qa/lighthouse-desktop.json`, `qa/lighthouse-mobile.json`, `qa/lighthouse-summary.json`.

| Preset  | Performance | Accessibility | Best Practices | SEO | FCP   | LCP   | TBT    | CLS | Speed Index |
| ------- | ----------- | ------------- | -------------- | --- | ----- | ----- | ------ | --- | ----------- |
| Desktop | **95**      | 100           | 100            | 100 | 0.6 s | 0.7 s | 180 ms | 0   | 1.1 s       |
| Mobile  | **69**      | 100           | 100            | 100 | 2.1 s | 3.4 s | 860 ms | 0   | 2.7 s       |

Desktop meets the targets. Mobile lands just under 70: across the last three batches of runs the mobile median was 65, 68 and 69 (single runs 53–72). One desktop batch while the machine was busy scored 79; the rerun scored 94 and then 95.

What limits mobile: Lighthouse's simulated 4× CPU slowdown multiplies the WebGL boot (WebGL context creation ~150–200 ms, the environment bake ~140 ms, script evaluation ~150 ms on this machine, each ×4), and the 90 KB variable woff2 is on the LCP path over simulated slow 4G.

What I tried, in order (desktop TBT went from 1,530 ms to 180 ms, mobile from 3,280 ms to about 860 ms):

1. Removed RectAreaLights (104 KB gzipped of lookup tables) for strip softboxes baked into the environment.
2. Replaced RoomEnvironment (~1 s of synchronous lit-shader compiles inside PMREM) with a procedural half-float studio.
3. Precompiled PMREM's filters with `compileAsync` and cut its GGX samples from 256 to 32 (the HLSL compile took most of a second).
4. Replaced three.js clipping planes, which `compileAsync` can't precompile, with a uniform-driven discard.
5. Stopped a render during warm-up that compiled every shader synchronously (a 500 ms task).
6. Compile visible materials in parallel first and hidden ones in idle time after the first frame.
7. Split the scroll director and stage boot into small tasks.
8. Inlined the page stylesheet (one render-blocking request fewer).

Not done: subsetting the variable font (needs Python fonttools, not installed here) and deferring the 3D until after interaction (it would hide the concept from first-time visitors).

## Performance numbers

- **JavaScript on the home page (gzipped):** main 65.0 KB (GSAP, ScrollTrigger, SplitText, CustomEase, Lenis, app) + three.js core 51.7 KB + stage 94.2 KB + small shared chunks ≈ 15 KB, so about 226 KB, under the 300 KB budget. The line-up (1.6 KB), fizz (0.9 KB), separation worker (1 KB), 2D fallback, Fraunces and the debug tools load lazily. `npm run analyze` writes the treemap to `qa/bundle.html`.
- **CSS:** 7.1 KB gzipped, inlined into each page.
- **Frame times** (`npm run perf`, `qa/perf.json`): wheel-scrolling the whole page at 1440×900.

| CPU          | Frames | p50     | p95     | p99     | Worst  | > 33 ms | > 50 ms |
| ------------ | ------ | ------- | ------- | ------- | ------ | ------- | ------- |
| 1×           | 817    | 16.7 ms | 16.8 ms | 33.4 ms | 500 ms | 9       | 8       |
| 4× throttled | 809    | 16.7 ms | 16.8 ms | 33.4 ms | 117 ms | 15      | 5       |

p95 under 4× throttling is 16.8 ms, well inside the 33 ms target. The worst single frames happen at scroll 2,370–2,990 px, where leaving S2 prints the sample label (full-size artwork redraw and upload) and the line-up first appears. Plates at 1024 px and one label redraw per frame brought the unthrottled worst frame down from 650 ms to 500 ms in this run (283 ms in an earlier one); a stall of that size remains once, at that moment.

## Critique log

### M1 static baseline (no motion, no 3D)

- Works: the white-label idea reads from type alone; the wdth axis renders (extended H1 at wdth 116, condensed small print at wdth 72); the takeover recolours the page without 3D; colour stays restrained.
- Fixed later: the "Drag to spin" hint sat under the header; the phone header was tight at 360 px (checked, it fits); the custom colour chip and picker read as two controls (kept, the picker is labelled "Pick any colour").

### Pass 1 (all scenes, 390×844, 768×1024, 1440×900)

Against §2 and §5:

- **White label within three seconds?** Yes: a raw aluminium can reading INSERT YOUR BRAND HERE, beside "Let's build your brand's website."
- **Text colliding with the product?** Phones and tablets: the Turn left/right buttons overlapped the can's sides. Launch beat: the header's "Start a brief" button disappeared into the brand wash (brand on brand).
- **Type hierarchy and spacing:** crisp. One family, extended display, condensed small print.
- **Colour restraint:** process black on paper until the visitor picks a colour; CMYK only in printing moments (plates, colour bars, the progress strip).
- **Manila and price copy:** the Manila line is one calm sentence under the hero buttons and one paragraph in S5; the price appears once, as plain text in the details step.
- **Anti-generic checklist:** none found (no eyebrows, no gradient washes, no card grids, no arrows on links, no italic accent word).

### Fixes after pass 1

- Turn buttons moved to the bottom corners of the can's slot on phones and tablets.
- A 2 px paper edge on the header button keeps it distinct on the brand wash.
- Fallback font metrics measured (`scripts/font-metrics.mjs`) and applied; CLS stays 0.
- Earlier passes during the build also fixed: the sweep never rendered (back-face culled), the S2 can was too large for its slot, captions showed during the line-up overview, the 404 can didn't read as crushed, and the landscape try-it panel clipped its top.

### Pass 2

Re-shot every scene (`qa/screenshots/`, `qa/screenshots/reduced/`). Buttons now clear the can at every size, the wash keeps the header readable, and nothing collides. Nothing from the anti-generic list.

## Screenshot index

`npm run screenshots` writes 63 PNGs to `qa/screenshots/` (and `-- --reduced` another 63 to `qa/screenshots/reduced/`): each of the three viewports (`390x844`, `768x1024`, `1440x900`) times these shots:

| Shot                                           | What it shows                                                  |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `s1-hero`                                      | S1 White label: blank can, H1, location line                   |
| `s2-try`, `s2-try-brand`                       | S2 Try it on, before and after printing "Kopi Kalye" in Lagoon |
| `s3-lineup-a`, `-b`, `-c`, `s3-lineup-b-brand` | S3 line-up joining, trucking to the bottle, the box; branded   |
| `s4-01-brief`                                  | Wireframe can                                                  |
| `s4-02-direction`                              | Proof label unwrapping into a dieline, crop marks on           |
| `s4-03-design`, `-brand`                       | Flat dieline with trim, bleed and seam annotations             |
| `s4-04-build`                                  | Label wrapped back, wireframe resolving into metal             |
| `s4-05-launch`, `-brand`                       | Ring-pull up, can rising, sweep washed to the label colour     |
| `s5-build`                                     | What I build                                                   |
| `s7-brief`, `-brand`                           | The job ticket, with the can beside it on desktop              |
| `s8-footer`, `-brand`                          | Dieline headline box; "Kopi Kalye. Launching soon."            |
| `404`, `privacy`                               | The other pages                                                |

## Known limitations

- **Mobile Lighthouse is just under 70** (see above), and scores vary a lot between runs.
- **Firefox wasn't tested here** (its Playwright build won't start on this machine); WebKit is Playwright's Windows port, not Safari.
- **One visible stall of up to ~0.5 s** when the sample label prints on leaving S2 on a fast machine; p95 is unaffected.
- **Headless SwiftShader** (CI without a GPU) makes Chrome's GPU process log a one-off "GPU stall due to ReadPixels" about three seconds after any WebGL page loads. Run tests on a GPU, or expect that message there.
- **Selected work (S6) is untested with real entries:** `config.work` is empty, so the section and its scene index entry are omitted, as specified.
- **Real-device checks** (iOS Safari, Android Chrome) weren't possible here; the phone compositions were checked in emulation only.
