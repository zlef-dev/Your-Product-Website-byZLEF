# Progress

Live checklist. Each milestone is one git commit.

- [x] M0 Scaffold: Vite + TS strict, ESLint, Prettier, Vitest, Playwright, folders, config, content, tokens
- [x] M1 Static site: every scene's DOM and copy, layout, working form (steps, validation, mailto), takeover, footer clock; screenshot critique in QA.md
- [x] M2 Stage: renderer, sweep, lighting, can, label renderer (all modes/layouts), live label, drag and keyboard rotation, PNG download
- [x] M3 Print run with worker separation
- [x] M4 Scroll director: Lenis + ScrollTrigger, Stage state, S1–S4 choreography, unwrap, line-up, launch, progress strip, scene index
- [x] M5 Form submission states, footer personalisation, 404 and privacy pages
- [x] M6 Mobile compositions, reduced motion, no-WebGL fallback, quality tiers
- [x] M7 Performance: bundle analysis, lazy loading, render on demand, compileAsync
- [x] M8 QA: unit and e2e suites, two screenshot critique passes, Lighthouse, frame times, fixes
- [x] M9 Docs and deploy config: README, DECISIONS, QA, `_headers`, favicon, touch icon, OG image

## Open items

- Mobile Lighthouse performance is 65–69 (median), just under the 70 target; what was tried is in QA.md.
- Firefox e2e wasn't run here (its Playwright build can't start on this machine).
- The owner's fill-ins in `src/config.ts` (see README, "Before you launch").
