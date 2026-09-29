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

## 3D stage

- **Khronos PBR Neutral tone mapping instead of ACES or AgX.** Side-by-side renders (Cherry label, same light) showed AgX washing the red to salmon and greying white ink, and ACES shifting it toward orange; Neutral keeps the printed label closest to the visitor's `--brand`, which is the whole point of the concept.
- **Compositions come from CSS layout slots via a lens shift.** The camera orbits a target and a projection-matrix lens shift places that target on a slot's centre, with distance derived from the slot's height. Layout stays in CSS at every breakpoint, and the brief scene's "anchor to a placeholder" is the same mechanism read live each frame, instead of unprojecting onto a depth plane.
- **The unwrap is a tangent peel.** Vertices beyond a peel front that sweeps from the back seam to the front leave along the tangent; each vertex effectively has its own progress delayed by |θ|, arc length is preserved (no stretching), and the label never passes through the can (unit-tested).
- **Label stock is bare metal until printed.** The sleeve's metalness and roughness move from raw aluminium to ink-on-metal with the selected finish, so the blank can reads as unprinted aluminium and the print run can "ink" it.
- **Clearcoat never drops to exactly 0.** three.js recompiles a material when clearcoat crosses zero; a floor of 0.001 keeps the Matte finish switch instant.
- **Label canvases are CPU-backed and upload as ImageData, without flipY (the geometry flips V).** The print run reads their pixels for CMYK separation, which is fast on a CPU canvas. (I first suspected these uploads of causing a "GPU stall due to ReadPixels" warning; that turned out to be headless SwiftShader itself, see the last entry. The upload path stayed because it works and needs no special cases.)
- **"Download your can" reads pixels through a pixel buffer and a fence.** The async WebGL2 readback doesn't block the main thread on the GPU the way a synchronous drawImage of the WebGL canvas does.
- **`renderer.debug.checkShaderErrors` is off in production.** Chrome on Windows (ANGLE D3D11) returns harmless HLSL compiler notes that three.js logs as console warnings; skipping the synchronous status checks also speeds up compiles, as the three.js docs recommend.
- **`compileAsync` only runs when `KHR_parallel_shader_compile` exists.** Without it three.js logs a warning; the first render compiles instead.
- **Real tangents on the can body.** Anisotropy with derivative-based tangents faceted the shoulder reflections per triangle.
- **Headless Chromium in scripts and tests renders on the machine's GPU** (`--use-angle=d3d11` on Windows, `SOFTWARE_GL=1` for SwiftShader). Under SwiftShader, Chrome's GPU process itself logs a one-off "GPU stall due to ReadPixels" around three seconds after load, from headless software compositing, even on a page that does nothing; it isn't caused by the site.
- **The print run composites its plates in the label shader.** Four plate textures (uploaded one per frame, as each plate first appears) are multiplied over the bare stock colour with per-plate offsets and opacity as uniforms, so animating 1.1 s of plates costs no per-frame canvas work or texture uploads. The 2D fallback composites the same `printFrame()` timeline on a small canvas.
- **Plates land 6–12 px out of register (at 2048 px, scaled for the low tier), feed in from the left, and snap together over the last 16% with the `press` ease.** The original artwork crossfades in over the last 10%, which is where "swap in the exact original" happens; the separation's multiply approximation is visibly darker until then, which reads as wet ink drying to its true colour.
- **The separation worker keeps a copy of each job.** If the worker fails to load (CSP, old browser) or never answers within 4 s, the main thread finishes the job, so a print can't hang.

## Scroll direction

- **One master timeline in scene units (0–6), not one scrubbed timeline per scene.** Several scenes write the same Stage fields (camera target, frame); separate scrubbed timelines fight over them when scrolling back and forth. Scroll position maps piecewise onto timeline time through the live pin boundaries and is smoothed with a 1 s `quickTo` (the equivalent of `scrub: 1`), and the timeline is rebuilt on every ScrollTrigger refresh so slot measurements and pin lengths never go stale.
- **`gsap.matchMedia` gets an always-true condition.** It only runs its callback while at least one condition matches; without it phones (neither wide nor reduced motion) got no pins at all.
- **The sweep material is double-sided.** Its triangles wound away from the camera and were culled, so the launch wash never showed; the page's CSS paper had been standing in for it.
- **Line-up captions show only while a product is centred.** During the overview no single product is the subject, so no caption is.
- **The S4 title fades out as the sweep washes to the brand colour.** Process-black type on a dark label colour would fail contrast; the step card keeps its paper backing, so the launch copy stays readable.
- **The wash goes to the colour printed on the can** (the sample's Cherry when the visitor hasn't set a brand), not `--brand`, which would be process black before personalisation and wash the screen black.
- **After a brief is sent the can stays shipped for the session.** Scrolling back to the brief shows the empty sweep rather than the can reappearing as if nothing happened.

## Pages

- **The 404 can wears the visitor's brand when they set one this session**, otherwise the blank white label: their own product "out of stock" lands the joke harder.
- **The crushed can gets dense wall and label rows (32) on the 404 page only.** The main can keeps a single-row sleeve (a few hundred vertices, cheap to unwrap every frame); a crush needs rows to bend, and different row counts let the body poke through the label's folds.
- **Without WebGL the 404 page shows the headline and button alone.** The page's job is to get people back to the shelf, and the squeezed headline carries the joke.
- **The no-WebGL can is an SVG silhouette with the label projected cylindrically into a canvas inside it.** Each output column samples the angle asin(x / r) of the wrapped label, so the flat 2D can still turns with the Turn buttons, the print run composites the same plate timeline on a canvas, and "Download your can" draws the same can into the PNG. S4 shows the flat dieline in the fallback; S3 keeps its captions.
- **Short landscape screens use the phone placement for the progress strip** (in the header) and the try-it panel aligns with `safe center`, so controls taller than the screen start at the top and scroll instead of being cut off.
