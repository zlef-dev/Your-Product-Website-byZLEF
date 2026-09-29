# Plan: "Insert your brand here"

## Architecture

One persistent WebGL canvas sits fixed behind the DOM. The DOM owns every word, control and landmark; the canvas only illustrates. Scroll never touches Three.js directly:

```
 DOM input ──► BrandState store ──► label renderer (2D canvas) ──► CanvasTexture ─┐
 (try-it, form)     │                     ▲                                        │
                    │                print run (worker CMYK plates)                 │
                    ▼                                                               ▼
               takeover (CSS vars,              ScrollTrigger timelines ──► Stage state ──► render loop (damped) ──► WebGLRenderer
               title, footer, form)              (gsap.matchMedia)            (plain object)     on demand only
```

- **BrandState** (`src/lib/brand.ts`): name, colour, finish, style, logo, plus whether the visitor set it (personalised) or it is the sample print. Persisted to sessionStorage (logo excluded). Everything else subscribes.
- **Label renderer** (`src/label/`): pure 2D canvas. `drawLabel(ctx, layout, mode, brand, opts)` for `sleeve | band | box-top` × `blank | proof | final`. Text fitting takes an injected `measure()` so it is unit-testable. CMYK separation is a pure function shared by the worker and the main-thread fallback.
- **Stage** (`src/stage/`): renderer, paper sweep, lights, can, lazy line-up, fizz, unwrap morph, crushed can (404). The camera is described as an orbit (target, yaw, pitch) plus a _frame_: where the target lands on screen and how tall the reference height appears. Distance and a projection-matrix lens shift are derived from the frame, so compositions follow CSS layout slots at every breakpoint instead of hand-tuned numbers per viewport.
- **Director** (`src/scroll/`): Lenis on GSAP's ticker, ScrollTrigger timelines per scene writing only to the Stage state, the progress strip and the scene index. Reduced motion swaps timelines for per-scene static poses glued to DOM slots.
- **Fallbacks**: no WebGL → SVG can silhouette with the label canvas drawn flat inside; reduced motion → no Lenis, no pins, no scrubbing, instant print.

## File tree

```
index.html  404.html  privacy.html        entry pages; bodies rendered from src/templates at build time
build/          site-plugin.ts (pages, head tags, JSON-LD, robots, sitemap, manifest, _headers, font preload, CSS inlining), headers.ts (CSP)
public/         favicon.svg, apple-touch-icon.png, og.png
scripts/        screenshots.mjs, lighthouse.mjs, perf.mjs, og.mjs, icons.mjs, font-metrics.mjs, lib/ (preview server, Chromium flags)
src/
  config.ts  content.ts  scenes.ts  env.d.ts
  main.ts  page-404.ts  page-privacy.ts
  templates/   html.ts (escaping), partials.ts, home.ts, pages.ts
  styles/      index.css tokens.css fonts.css base.css layout.css scenes.css form.css pages.css
  lib/         brand.ts contrast.ts sanitize.ts dom.ts job.ts ease.ts clipboard.ts
  label/       fit.ts barcode.ts cmyk.ts separate.ts separation.worker.ts fonts.ts draw.ts surfaces.ts print-run.ts logo.ts
  stage/       index.ts stage.ts state.ts dims.ts set.ts can.ts clip.ts unwrap.ts quality.ts lineup.ts fizz.ts crushed.ts
  scroll/      director.ts progress.ts split.ts
  ui/          chrome.ts tryit.ts takeover.ts card.ts fallback-2d.ts
  form/        brief.ts validate.ts serialize.ts mailto.ts submit.ts
  debug/       debug.ts (lazy, ?debug only)
tests/unit/    label, lib, form, print
tests/e2e/     helpers, site, form, fallbacks, pages
qa/            screenshots/, lighthouse-*.json, perf.json
```

## Milestones

- [x] M0 Scaffold: Vite + TS strict, ESLint, Prettier, Vitest, Playwright, folders, config, content, tokens
- [x] M1 Static site: all scene DOM, copy, layout, working form (no motion, no 3D); screenshot + critique
- [x] M2 Stage: renderer, sweep, lights, can, label renderer (all modes/layouts), try-it live label, drag + keyboard rotation, PNG download
- [x] M3 Print run with worker separation
- [x] M4 Scroll director: Lenis + ScrollTrigger, Stage state, S1–S4, unwrap, line-up, launch, progress strip, scene index
- [x] M5 Form submission states, footer personalisation, 404 and privacy pages
- [x] M6 Mobile compositions, reduced motion, no-WebGL fallback, quality tiers
- [x] M7 Performance: bundle analysis, lazy loading, render on demand, compileAsync
- [x] M8 QA loop (§16) and fixes
- [x] M9 Docs and deploy config
