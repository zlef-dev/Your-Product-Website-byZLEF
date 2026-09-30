# QA

Everything here was run on the build in this repository on 2026-09-30, on Windows 11 with an AMD Radeon integrated GPU, Node 24.20. Chromium in scripts and tests renders WebGL on that GPU through ANGLE D3D11, like desktop Chrome on Windows (`SOFTWARE_GL=1` switches to SwiftShader).

## Checks

| Check                           | Command                                                         | Result                                                                |
| ------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Types (strict), app and tooling | `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.node.json` | 0 errors                                                              |
| Lint                            | `npm run lint`                                                  | 0 errors, 0 warnings                                                  |
| Unit tests (Vitest)             | `npm run test`                                                  | 75 passed in 5 files                                                  |
| Build                           | `npm run build`                                                 | passes                                                                |
| End-to-end (Playwright)         | `npm run test:e2e`                                              | 62 passed, 2 skipped (Chromium and WebKit; Firefox not runnable here) |

### Unit tests (`tests/unit/`)

Text fitting (one/two lines, balanced breaks, never overflowing, 32-character names), the contrast ink choice for every preset, RGB→CMYK and plate separation, the decorative barcode (deterministic, never a valid EAN-13), job numbers, the print-run timeline (plate order, 6–12 px misregistration, snap to register, low-tier scaling), easing, the unwrap geometry (no stretch, never inside the can, seam peels first), sanitising, form serialisation, the Web3Forms payload and subject, the mailto URL (encoding, CRLF, no header injection), validation rules, `sendBrief` success, refusal, network error and timeout, and the quality tiers (starting-tier heuristics, dpr caps, and the frame monitor: healthy scenes stay put, sustained slowness steps down, single stalls and hidden-tab gaps don't).

### End-to-end tests (`tests/e2e/`)

Every test fails on any console error or warning, or uncaught page error. They run against production builds served with the production headers (the CSP from `build/headers.ts`). Three builds are served: with a test Web3Forms key, without a key, and fully configured (studio name, email, site URL and social links set through the optional `VITE_*` overrides in `src/config.ts`).

- **Home:** hero renders; typing a brand updates the live region, tab title, footer headline, brief heading and form prefill; choosing a colour updates `--brand` and `--brand-ink`; "Download your can" produces a PNG; the can turns by keyboard and buttons; "Start a brief" moves focus to the brief heading; the progress strip opens a `<nav>` scene index whose links move focus; the skip link is the first tab stop; no request leaves the site before a brief is sent; `/#brief` lands on the brief and the progress label says so; Tab reaches the footer through the pinned scenes with no trap and focus always on screen; the stage keeps rendering, with its reflections, after a lost and restored WebGL context.
- **Form:** errors are text linked with `aria-describedby`, summarised at the top of the step, focus goes to the first invalid field; validation waits for blur; steps change by keyboard with focus on the legend and "Step 2 of 4: The website" announced; the price note exists once and shows only in the details step; mocked Web3Forms success (payload checked) shows the success message and job number; a refusal and a dropped connection each show the error and keep every field; without a key, "Send brief" opens a mailto draft with the whole brief and "Copy brief" appears.
- **Configured site:** title, canonical, `og:url`, `og:image`, `twitter:image` and `og:site_name` use the configured values; JSON-LD carries name, url, email, image, address and `sameAs` and no price; `sitemap.xml` lists both pages and `robots.txt` points to it; the footer shows the email with a working copy button and the social links; the mailto fallback is addressed to the studio.
- **Fallbacks:** reduced-motion emulation gives no pins, no Lenis, all process steps and line-up captions on the page, an instant print and no intro strip; with `getContext` stubbed to return null for WebGL, the SVG can shows, prints, takes over the page and downloads a PNG.
- **Pages:** the 404 page renders with the squeezed headline (`font-stretch: 62%`) and `noindex`; the privacy page renders; with placeholders, meta tags and JSON-LD carry no placeholder text and no price.

### Browsers

- **Chromium:** all tests pass.
- **WebKit** (Playwright's Windows build): all pass except two skips. The skip-link and the tab-order tests are skipped because WebKit only moves Tab to links when the macOS "all controls" keyboard setting is on. WebKit also refetches the font preload (it won't reuse a preload with `crossorigin`, which Chromium and Firefox need) and logs a warning; the console guard ignores that single message in WebKit only (`tests/e2e/helpers.ts`). WebKit applies its native anchor scroll after ours, honouring `scroll-padding`, so `/#brief` lands 88 px from the top there (0 in Chromium).
- **Firefox:** not run on this machine. Playwright's Firefox build fails to start here ("The application has failed to start because its side-by-side configuration is incorrect", a missing Visual C++ runtime). `playwright.config.ts` checks once whether Firefox starts and includes it wherever it does.
- One WebKit test failed once in a full run with a console message I couldn't capture, and passed in the 5 isolated and 3 full reruns that followed. Under load WebKit (software rendering) is the slowest target; the suite uses two workers and generous timeouts for that reason.

## Lighthouse

`npm run lighthouse -- --runs=3` (median by performance score) against `vite preview` of the build, Playwright's Chromium on the GPU. Reports: `qa/lighthouse-desktop.json`, `qa/lighthouse-mobile.json`, `qa/lighthouse-summary.json`.

| Preset  | Performance | Accessibility | Best Practices | SEO | FCP   | LCP   | TBT    | CLS | Speed Index |
| ------- | ----------- | ------------- | -------------- | --- | ----- | ----- | ------ | --- | ----------- |
| Desktop | **94**      | 100           | 100            | 100 | 0.6 s | 0.8 s | 170 ms | 0   | 1.4 s       |
| Mobile  | **73**      | 100           | 100            | 100 | 2.2 s | 3.2 s | 720 ms | 0   | 2.7 s       |

Both meet the targets. Scores move between runs: over the final batches desktop was 94–95 and mobile 65–73 (one desktop batch while the machine was busy scored 79). The mobile median crossed 70 only after the last fixes below, so expect it to sit near the line.

What moved the numbers (desktop TBT went from 1,530 ms to 170 ms, mobile from 3,280 ms to 720 ms):

1. Removed RectAreaLights (104 KB gzipped of lookup tables) for strip softboxes baked into the environment.
2. Replaced RoomEnvironment (~1 s of synchronous lit-shader compiles inside PMREM) with a procedural half-float studio.
3. Precompiled PMREM's filters with `compileAsync` and cut its GGX samples from 256 to 32.
4. Replaced three.js clipping planes, which `compileAsync` can't precompile, with a uniform-driven discard.
5. Stopped a render during warm-up that compiled every shader synchronously (a 500 ms task).
6. Compile visible materials in parallel first and hidden ones in idle time after the first frame.
7. Split the scroll director and stage boot into small tasks.
8. Inlined the page stylesheet (one render-blocking request fewer).
9. Upload label canvases to the GPU directly instead of copying 8 MB through `getImageData` on every update, and draw the annotation reveal in 30 steps instead of 60.

Not done: subsetting the variable font (needs Python fonttools, not installed here).

## Performance numbers

- **JavaScript on the home page (gzipped):** main 65.2 KB (GSAP, ScrollTrigger, SplitText, CustomEase, Lenis, app) + three.js core 51.7 KB + stage 94.5 KB + small shared chunks ≈ 16 KB, so about **227 KB**, under the 300 KB budget. The line-up (1.6 KB), fizz (0.9 KB), separation worker (1 KB), 2D fallback, Fraunces and the debug tools load lazily. `npm run analyze` writes the treemap to `qa/bundle.html`.
- **CSS:** 7.2 KB gzipped, inlined into each page.
- **Frame times and long tasks** (`npm run perf`, `qa/perf.json`): wheel-scrolling the whole page at 1440×900, with a `longtask` observer running throughout.

| CPU          | Frames | p50     | p95     | p99     | Worst  | > 33 ms | > 50 ms | Long tasks (> 50 ms) | Longest | > 200 ms |
| ------------ | ------ | ------- | ------- | ------- | ------ | ------- | ------- | -------------------- | ------- | -------- |
| 1×           | 815    | 16.7 ms | 16.8 ms | 16.8 ms | 33 ms  | 2       | 0       | 0                    | none    | 0        |
| 4× throttled | 811    | 16.7 ms | 16.8 ms | 33.3 ms | 100 ms | 10      | 2       | 2                    | 117 ms  | 0        |

p95 under 4× throttling is 16.8 ms (target: under 33 ms), and no task over 200 ms occurs anywhere on the page.

## Audit pass

A second pass through the brief, running each item rather than trusting the earlier notes, found and fixed:

- **`/#brief` landed in the middle of S3.** The browser jumps to the anchor before the pins add scroll space, and Lenis clamped to a stale limit. Fixed and tested.
- **The progress label said "Scene 1 of 7" after a reload or deep link.** Fixed and tested.
- **A 0.5 s stall as the bottle came into view.** Profiling showed 1.3 s inside `getProgramParameter`: with glass transmission on, three renders opaque objects into a linear offscreen buffer first, which needs a second shader variant per material, compiled synchronously at first use. They are now compiled ahead of time; the transmission buffer runs at half resolution.
- **Quality step-downs recompiled shaders, and single stalls triggered them.** The bottle now has two prebuilt glass materials, and the frame monitor uses the median over its window (unit-tested).
- **The fixed progress strip could cover the first form chips and focused fields** (WCAG 2.2 Focus Not Obscured). Scroll padding fixes keyboard focus.
- **A print queued before the stage was ready never announced "Printed: …",** and out-of-order font loads could overwrite newer label artwork with older. Both fixed.
- **The shipping sticker's text overflowed the sticker.** Now fitted.
- **The stage was disposed on `pagehide`,** which would leave a dead canvas after the back/forward cache restored the page; it also didn't survive a lost WebGL context. Both fixed and the second is tested.
- Smaller: `?debug` now draws ScrollTrigger markers, sub-pages skip to their content, reduced-motion CSS disables transitions, form-summary links are 44 px, drag inertia is capped, and the job ticket uses a container query.

Verified working during the audit: dev server (only the allowed dev-only warnings), Classic style (Fraunces requested only when chosen), logo upload (PNG accepted; SVG and over-5 MB rejected; download unaffected), drag to spin, the separation worker starting under the CSP, the success flow, and the phone S2 panel scrolling on its own.

## Critique log

### M1 static baseline (no motion, no 3D)

- Works: the white-label idea reads from type alone; the wdth axis renders (extended H1, condensed small print); the takeover recolours the page without 3D; colour stays restrained.
- Fixed later: the "Drag to spin" hint sat under the header; the phone header was tight at 360 px (checked, it fits).

### Pass 1 (all scenes, 390×844, 768×1024, 1440×900)

- **White label within three seconds?** Yes: a raw aluminium can reading INSERT YOUR BRAND HERE, beside "Let's build your brand's website."
- **Text colliding with the product?** Phones and tablets: the Turn left/right buttons overlapped the can's sides. Launch beat: the header's "Start a brief" button disappeared into the brand wash.
- **Type hierarchy and spacing:** crisp. **Colour restraint:** process black on paper until the visitor picks a colour; CMYK only in printing moments.
- **Manila and price copy:** one calm sentence under the hero buttons and one paragraph in S5; the price appears once, as plain text in the details step.
- **Anti-generic checklist:** none found.

### Fixes after pass 1

Turn buttons moved to the bottom corners of the can's slot; a 2 px paper edge on the header button keeps it distinct on the brand wash; fallback font metrics measured (`scripts/font-metrics.mjs`) and applied (CLS stays 0). Earlier passes during the build also fixed: the sweep never rendered (back-face culled), the S2 can was too large for its slot, captions showed during the line-up overview, the 404 can didn't read as crushed, and the landscape try-it panel clipped its top.

### Pass 2

Re-shot every scene from the final build (`qa/screenshots/`, `qa/screenshots/reduced/`). Buttons clear the can at every size, the wash keeps the header readable, the bottle shows its green-tinted glass, nothing collides, and nothing from the anti-generic list appears.

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

- **Firefox wasn't tested here** (its Playwright build won't start on this machine); WebKit is Playwright's Windows port, not Safari.
- **Mobile Lighthouse performance sits close to the 70 target** (73 median of three; individual batches 65–73).
- **Headless SwiftShader** (CI without a GPU) makes Chrome's GPU process log a one-off "GPU stall due to ReadPixels" about three seconds after any WebGL page loads. Run tests on a GPU, or expect that message there.
- **Dev mode logs a shader compiler note on Windows** (ANGLE/D3D reporting a harmless precision warning) because shader error checks are on in development; production builds skip them.
- **Selected work (S6) is untested with real entries:** `config.work` is empty, so the section and its scene index entry are omitted, as specified.
- **Real-device checks** (iOS Safari, Android Chrome) weren't possible here; the phone compositions were checked in emulation only.
- **Live Web3Forms delivery** hasn't been exercised: the API is mocked in every test. Send yourself a real test brief before launch (see the README).
