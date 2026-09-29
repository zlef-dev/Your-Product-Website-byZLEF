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
index.html  404.html  privacy.html
public/        favicon.svg, apple-touch-icon.png, manifest.webmanifest, _headers, og.png, robots.txt*
scripts/       og.mjs, screenshots.mjs, perf.mjs, lighthouse.mjs, icons.mjs, serve-checks.mjs
src/
  config.ts  content.ts  env.d.ts
  main.ts  page-404.ts  page-privacy.ts
  styles/      tokens.css fonts.css base.css layout.css scenes.css form.css pages.css
  lib/         brand.ts contrast.ts sanitize.ts dom.ts motion.ts job.ts clock.ts tier.ts events.ts
  label/       types.ts fit.ts barcode.ts cmyk.ts separate.ts separation.worker.ts fonts.ts draw.ts surface.ts print-run.ts logo.ts
  stage/       index.ts state.ts renderer.ts set.ts can.ts materials.ts unwrap.ts lineup.ts fizz.ts frame.ts quality.ts crushed.ts capture.ts
  scroll/      director.ts poses.ts progress.ts split.ts
  ui/          chrome.ts tryit.ts takeover.ts footer.ts fallback-2d.ts download.ts share.ts
  form/        brief.ts validate.ts serialize.ts mailto.ts submit.ts
  debug/       debug.ts (lazy, ?debug only)
tests/unit/    fit, contrast, cmyk, barcode, job, serialize, mailto, sanitize, validate, unwrap
tests/e2e/     site.spec.ts form.spec.ts fallbacks.spec.ts pages.spec.ts
qa/            screenshots/, lighthouse-*.json, perf.json
```

(*robots.txt and sitemap.xml are generated at build time from config so the canonical URL never ships as a placeholder.)

## Milestones

- [ ] M0 Scaffold: Vite + TS strict, ESLint, Prettier, Vitest, Playwright, folders, config, content, tokens
- [ ] M1 Static site: all scene DOM, copy, layout, working form (no motion, no 3D); screenshot + critique
- [ ] M2 Stage: renderer, sweep, lights, can, label renderer (all modes/layouts), try-it live label, drag + keyboard rotation, PNG download
- [ ] M3 Print run with worker separation
- [ ] M4 Scroll director: Lenis + ScrollTrigger, Stage state, S1–S4, unwrap, line-up, launch, progress strip, scene index
- [ ] M5 Form submission states, footer personalisation, 404 and privacy pages
- [ ] M6 Mobile compositions, reduced motion, no-WebGL fallback, quality tiers
- [ ] M7 Performance: bundle analysis, lazy loading, render on demand, compileAsync
- [ ] M8 QA loop (§16) and fixes
- [ ] M9 Docs and deploy config
