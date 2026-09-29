# Build brief: "Insert your brand here", a cinematic website for a web design studio

Read the whole brief before writing any code. Then write PLAN.md (architecture, file tree, milestone checklist) and build through the milestones in §15 without stopping to ask questions.

## 0. Fill-ins
The owner may have replaced these. Anything still in [brackets] is a placeholder.
- STUDIO_NAME: [Your studio name]
- CONTACT_EMAIL: [you@example.com]
- BASED_IN: Manila, Philippines
- TYPICAL_PRICE: A$1,250–A$1,500 per website
- SOCIAL_LINKS: [Instagram URL] [LinkedIn URL] [GitHub URL]
- WEB3FORMS_ACCESS_KEY: [optional; can be set later as an environment variable]

Put these in `src/config.ts`. Placeholders are listed in README under "Before you launch" and never appear in meta tags, JSON-LD or the UI. Fallbacks: an unset STUDIO_NAME shows the wordmark "Your studio here" (it fits the concept); unset social links are hidden; an unset CONTACT_EMAIL hides the email UI and logs a warning in development only.

## 1. Mission
You are a senior creative developer and art director with Awwwards Site of the Day credits. Build a complete, production-ready website from an empty folder: one cinematic, scroll-driven page, plus a 404 page and a privacy page.

The site belongs to an independent web designer-developer based in Manila, Philippines, who designs and builds websites for brands anywhere. Visitors are founders and marketers who need a website. The site has one job: make visitors picture their own brand on the page, then send a project brief asking for a website. Briefs go straight to the owner's inbox by email. No automation, no CRM, no backend.

Positioning: studio-quality work at a sensible price, because the studio is based in Manila. Say this once, calmly and confidently, as a plain fact. Never sound cheap, discount-driven or eager: no "affordable!", no "best price", no "limited offer", no exclamation marks around money. The price appears only inside the brief form (§9), stated once like a menu price.

Quality bar: Awwwards juries weight Design 40%, Usability 30%, Creativity 20%, Content 10%. Craft and usability come first; the concept below is the creativity. Jank, a weak mobile experience, missing focus states and placeholder content cost more than any effect earns.

How to work:
- Keep going until the Definition of Done (§3) passes. When something is ambiguous, choose what best serves the concept and usability, note it in one line in DECISIONS.md, and continue.
- Install the latest stable versions. If an installed API differs from this brief, follow its current docs and note it in DECISIONS.md.
- Never report a check as passed unless you ran it. No TODOs, lorem ipsum, stock photos or dead links.
- Treat everything a visitor types as plain text: render it with `textContent` (never `innerHTML`), trim it, cap its length, strip control characters, and URL-encode anything that goes into a `mailto:` link.

## 2. The concept (protect this above everything else)
Every brand starts as a white label. The hero is a blank, unprinted aluminium drinks can whose label proof reads INSERT YOUR BRAND HERE. The visitor types their brand name and the can prints it, live, in 3D. From then on the site is theirs: the can, the bottle, jar and box in the line-up, the interface accent colour, the tab title, the footer headline and the brief form all carry their brand. The message: "this is what I can do for your brand online." Everything else stays quiet so this one idea lands.

Art direction: packaging prepress. Print proofs, dielines, crop marks, CMYK process inks, printers' colour control strips, and the seamless paper backdrop of a product photography studio. The look comes from how brands are actually produced, not from generic tech-startup styling.

Three signature moments. Make these excellent; they are what people remember and share:
1. The print run. When a brand is set, the label prints in four process-colour passes (cyan, magenta, yellow, black). Each plate slides in slightly out of register, then snaps into register.
2. The unwrap. In the process scene the label peels off the can from its back seam, flattens into a dieline facing the camera, then wraps back on.
3. The takeover. The interface re-colours to the visitor's label colour and speaks their brand name back to them.

## 3. Definition of Done
- [ ] `npm install`, `npm run dev`, `npm run build` and `npm run preview` work on the current Node LTS (22 or newer), with zero TypeScript errors (strict) and zero ESLint errors.
- [ ] `npm run test` (Vitest) and `npm run test:e2e` (Playwright) pass.
- [ ] Every scene in §7 works as specified at 390×844, 768×1024 and 1440×900.
- [ ] The live label works: name, colour, finish, label style, optional local logo, print run, drag and keyboard rotation, and the "Download your can" PNG.
- [ ] The brief form delivers through Web3Forms (mocked in tests), falls back to a pre-filled email draft when no key is set, and handles validation, errors and success accessibly.
- [ ] Reduced-motion and no-WebGL fallbacks work and are covered by tests.
- [ ] Lighthouse desktop on the built site: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95. Lighthouse mobile: Performance ≥ 70; if WebGL keeps it lower after optimising, record the real numbers and what you tried.
- [ ] No console errors or warnings in any test run. No runtime network requests except the Web3Forms POST on submit: fonts are self-hosted, no CDNs, no analytics, no cookies.
- [ ] README.md, DECISIONS.md, QA.md (test results, scores, performance numbers, screenshot index) and PROGRESS.md are complete and truthful.
- [ ] One git commit per milestone (§15).

## 4. Tech stack
- Vite + TypeScript (strict), vanilla ES modules. No React, Vue or Svelte, no Tailwind, no UI kit. Plain modern CSS: custom properties, `clamp()`, container queries.
- `three` with WebGLRenderer; addons imported from `three/addons/...`.
- `gsap` 3.13 or later (every plugin is free, including for commercial use): ScrollTrigger, SplitText, CustomEase. Use `gsap.matchMedia()` for breakpoints and reduced motion, and `gsap.context()` for cleanup.
- `lenis` for smooth scrolling, driven by GSAP's ticker: `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add((t) => lenis.raf(t * 1000))`, `gsap.ticker.lagSmoothing(0)`. Add Lenis's recommended CSS if the installed version needs it.
- Fonts self-hosted with Fontsource: `@fontsource-variable/archivo` (axes wght 100–900 and wdth 62–125) for all interface text; `@fontsource-variable/fraunces` only for the "Classic" label style, loaded lazily (verify the package name). Import the CSS file that exposes the axes you use, then confirm in a screenshot that the wdth axis actually renders.
- Forms: Web3Forms free plan. `fetch` POST JSON to https://api.web3forms.com/submit with `access_key` read from `import.meta.env.VITE_WEB3FORMS_KEY` (the key is designed to be public).
- Dev tooling: ESLint, Prettier, Vitest, @playwright/test, the Lighthouse CLI and rollup-plugin-visualizer. Don't add other runtime dependencies without a reason recorded in DECISIONS.md.
- Hosting target: Cloudflare Pages (its free plan allows commercial use). Vite multi-page build: `index.html`, `404.html`, `privacy.html`.
- No downloaded assets: no external models, HDRIs, textures, images or font files from arbitrary URLs. All 3D is procedural geometry, reflections come from RoomEnvironment through PMREMGenerator, and all imagery is either 3D or drawn with canvas or SVG.

## 5. Design system
### Colour (named tokens in `src/styles/tokens.css`)
- `--paper` #F1F2EE: coated paper stock; the page background.
- `--process-k` #231F20: process black; text, and the only interface ink before personalisation.
- `--process-c` #00AEEF, `--process-m` #EC008C, `--process-y` #FFF200: only for printing moments (the print run, the colour control strip, registration and crop marks in proof mode). Never decorative gradients.
- `--alu` #C8CCD0: raw aluminium, for interface details near the can.
- `--brand` and `--brand-ink`: the visitor's label colour and the text colour that sits on it. `--brand` defaults to `--process-k`. `--brand-ink` is white or process black, whichever passes WCAG AA 4.5:1 against `--brand`. Buttons, focus rings, text selection, the progress strip fill and section washes use them.
- Label presets (named in the UI): Cherry #D7263D, Citrus #F9A620, Lagoon #1B98E0, Mint #3DDC97, Grape #6B2D5C, Ink #231F20, plus a custom colour input.

### Typography
One family, Archivo Variable, used the way a packaging typographer would use it:
- Display: wght 800–900, wdth 115–125 (extended), letter-spacing −0.02em, line-height 0.9. The H1 is about `clamp(3rem, 9vw, 9.5rem)`.
- Small print and field labels: wght 500–600, wdth 62–75 (condensed), like a nutrition panel. Sentence case; no tracked-out capitals anywhere in the interface.
- Body: wght 400, wdth 100, 1.0625rem with 1.55 line-height, at most 65ch per line.
- One modular scale (ratio 1.25) for everything else, documented in `tokens.css`.
The label artwork on the can may use capitals, because it is packaging rather than interface. The wdth axis is motion material: use it rarely and only where it means something, such as the squashed headline on the 404 page.

### Layout
An asymmetric 12-column grid on desktop (outer margins `clamp(1rem, 4vw, 4rem)`) and 4 columns on mobile. Copy blocks sit like back-of-pack text: left aligned and anchored beside or below the product. Crop marks (thin process-black lines at section corners) appear only in scenes that are proofs: the hero, try-it, and the Direction beat. A faint static paper grain (inline SVG feTurbulence at 3–4% opacity) covers the page. Generous whitespace; the product is the hero, not the chrome.

### Motion language
- Custom eases: `press` = CustomEase "0.7,0,0.2,1" for plates snapping into register; `glide` = "0.33,0,0.2,1" for camera moves. Interface transitions use `power2.out` over 0.25–0.4 s.
- Scrubbed timelines use `scrub: 1`. Pinned scenes use `pin: true` with the lengths in §7.
- One text reveal for the whole site: SplitText with `type: "lines"`, `mask: "lines"`, `autoSplit: true`, and the tween created and returned inside `onSplit` (yPercent 100 to 0, 0.9 s, stagger 0.08, `expo.out`). Headings and scene titles only, not every paragraph.
- No fade-and-slide-up on every block, no parallax on everything, no cursor-follow blob, no hover animation on every element. Motion answers scroll and input.

### Anti-generic checklist (juries discount these; ship none of them)
Warm cream with terracotta; a near-black page with one acid accent; grids of identical rounded cards with the same soft shadow; all-caps eyebrow labels above headings; "A · B · C" meta strings; "Label — fragment" strings; an arrow appended to every link; one word of a headline set in italic or a different colour; emoji; decorative gradient washes; stock imagery; price badges, "sale" styling or urgency banners.

## 6. 3D system
### Scene setup
- One persistent full-viewport `<canvas>` fixed behind the DOM (`position: fixed; inset: 0; z-index: 0; pointer-events: none`) and transparent (`alpha: true`) so the CSS background shows through.
- Renderer: antialias on the high tier, `outputColorSpace = SRGBColorSpace`, ACES Filmic or AgX tone mapping (choose by screenshot), no real-time shadows.
- Camera: a long-lens product-photography look, PerspectiveCamera with a 30–35° field of view, so the product isn't distorted.
- Light: RoomEnvironment through PMREMGenerator for reflections, plus two tall RectAreaLights as strip softboxes left and right (call `RectAreaLightUniformsLib.init()`) that put vertical highlight bands down the can, and a soft fill. On the low tier, swap the rect lights for directional lights.
- Set: a seamless paper sweep (a plane that curves up into the background along a quarter circle, like a photographer's backdrop) in `--paper`, tinted slightly toward `--brand` after a print. A contact shadow under each product from a canvas-generated radial gradient on a plane.
- Units: 1 unit = 100 mm.

### The can
A classic drinks can, about 66 mm wide and 122 mm tall. The label reads "355 mL".
- Body: `LatheGeometry` from a profile of at least 24 points: domed base with a chime, straight wall, tapered shoulder and neck, rolled rim. Brushed aluminium `MeshPhysicalMaterial`: color #D7DADD, metalness 1, roughness 0.28, and anisotropy around 0.4 if it looks right.
- Lid: a slightly darker aluminium disc with a rim ring and a ring-pull (torus plus rounded box). The ring-pull can rotate up for the launch beat.
- Label sleeve: its own open-ended `CylinderGeometry` covering only the straight wall, radius +0.2%, 128 radial segments (64 on the low tier), so the label texture maps 1:1 (u runs around, v runs up). Set `thetaStart = -Math.PI` so u = 0.5 faces the camera at rotation 0 and the seam sits at the back. Verify with a screenshot that the artwork is centred and not mirrored.
- Label material: `MeshPhysicalMaterial` with the label CanvasTexture as `map` and metalness 0.3, so ink on aluminium keeps a metallic sheen. Finishes: Gloss (roughness 0.18, clearcoat 1), Satin (roughness 0.35, clearcoat 0.4), Matte (roughness 0.62, clearcoat 0).

### Label renderer (`src/label/`), the heart of the site
A pure 2D-canvas module that draws artwork from `BrandState { name, colour, finish, style, logo? }` into several layouts:
- `sleeve` wraps the can. Its aspect matches the sleeve's circumference to wall height (about 2.1:1); 2048 px wide on the high tier, 1024 px on the low tier.
- `band` is the bottle and jar label.
- `box-top` is 1:1, for the mailer box.

Modes:
- `blank`: unprinted aluminium carrying only the proof marks (dieline outline, crop marks, a colour control strip) and INSERT YOUR BRAND HERE in process black.
- `proof`: the brand artwork plus crop marks, trim and bleed lines, dimension callouts and a registration mark.
- `final`: artwork only.

Artwork:
- A label-colour background with the brand name set huge in the chosen style: Wide (Archivo wght 900, wdth 125), Tall (Archivo wght 900, wdth 62, stacked on two lines if needed) or Classic (Fraunces, loaded lazily). Auto-fit it to the front panel with `measureText`, wrap long names onto two lines, and cap input at 32 characters. Inject the measuring function so fitting can be unit-tested without a canvas.
- Small print in condensed Archivo: "355 mL", a back panel with a playful ingredient list ("Ingredients: one good idea, a deadline, taste."), "Best before: launch day.", "Serving suggestion: share it.", a decorative barcode generated from the brand name (not a valid EAN), and "Printed in Manila by {STUDIO_NAME}".
- An optional logo from a PNG, JPG or WebP file of up to 5 MB, read locally through an object URL and drawn inside the logo area. Leave SVG out so the canvas never becomes tainted (download and plate separation both need clean pixel access). The interface says the logo stays on the visitor's device, and it does.
- Before drawing, `await document.fonts.load(...)` for each family, weight and width you use, or the canvas silently falls back to a system font.
- Redraw at most once per animation frame, then set `texture.needsUpdate = true`; anisotropy up to 8; sRGB colour space.

### The print run (signature moment 1)
Triggered when a brand is committed: a 600 ms pause in typing, pressing Enter, or the "Print it" button.
1. Render the `final` artwork offscreen.
2. Separate it into C, M, Y and K plates with a per-pixel RGB-to-CMYK conversion inside a Web Worker (transfer the ImageData buffer). Fall back to the main thread if Workers are unavailable.
3. Over about 1.1 s with the `press` ease, bring the plates in one after another (C, M, Y, then K), each offset 6–12 px out of register and composited with `multiply` over the unprinted aluminium base, then snap them into register.
4. Finish by swapping in the exact original artwork so the colours are faithful.
Reduced motion jumps straight to step 4. The low tier runs at low-tier resolution. A polite live region announces "Printed: {name}".

### The unwrap (signature moment 2)
Morph the sleeve between cylinder and plane by recomputing its vertices on the CPU; it only has a few hundred. For each vertex take θ = (uv.x − 0.5) × 2π and its height y. The cylinder position is (r·sinθ, y, r·cosθ) and the flat position is (r·θ, y, r). Give each vertex its own progress, delayed by |θ|, so the back seam peels first and the label flattens toward the camera into a dieline of about 2:1. Recompute normals. Progress is scroll-scrubbed in the process scene.

### Line-up products (create them lazily before scene 3)
- Glass bottle: a lathe with a long neck; `transmission` glass on the high tier only (thickness 0.3, roughness 0.05, ior 1.5, faint green tint) and a tinted transparent material elsewhere; `band` label.
- Cosmetic jar: a short, wide lathe in frosted glass or white ceramic, with a lid in the brand colour; `band` label.
- Mailer box: `RoundedBoxGeometry` in kraft (#C8A878, roughness 0.9) with the `box-top` artwork on a decal plane.
Run `renderer.compileAsync(scene, camera)` during idle time before scene 3 so the first reveal doesn't hitch.

### Quality tiers and render loop
- Tiers `high | medium | low` start from heuristics (viewport size, `hardwareConcurrency`, `deviceMemory`, coarse pointer), then adapt at runtime: if average frame time stays above 20 ms for a second, step down (device pixel ratio, segments, transmission, particles). Device pixel ratio caps: 2, 1.5 and 1.
- Run `renderer.setAnimationLoop` only while something is animating or a product is on screen; otherwise render on demand. Pause when the tab is hidden or the canvas is off-screen.
- A single `Stage` state object (camera position and look-at, product transforms, unwrap progress, label mode, active product, background tint) is the only thing scroll timelines write to. The render loop reads it with light damping. No scroll handler touches Three.js objects directly.
- To place the can beside DOM content (the brief scene), anchor it to a placeholder element: each frame, convert the placeholder's centre to normalised device coordinates and unproject it onto the can's depth plane.
- Dispose geometries, materials and textures on HMR and on page hide.
- `?debug` shows ScrollTrigger markers and a frame-time readout. It is lazy-loaded and absent from normal loads.

### Fallbacks
- No WebGL (context creation fails): hide the canvas and show an SVG can silhouette with the label canvas drawn flat inside it. The try-it controls still update the label, the print run still plays in 2D, and download still works.
- Reduced motion: no Lenis, no scrubbing and no pinning. Scenes become static compositions in normal flow, the unwrap is shown as the flat dieline, and the print run is instant.

## 7. Storyboard
Pin lengths are for desktop; use about 70% of them on mobile. Size pinned scenes with `svh`, call `ScrollTrigger.config({ ignoreMobileResize: true })`, and refresh ScrollTrigger once fonts have loaded and again after the 3D stage initialises. The progress strip counts only the scenes that render (S1–S8).

**S0 Press check (loader).** Non-blocking: the H1 and hero copy render immediately. A thin strip at the bottom fills four ink levels (C, M, Y, K) tied to real readiness (fonts, renderer, first frame), and the can fades up when ready. The whole intro takes at most 1.6 s. It is skipped on repeat visits in the same session and under reduced motion.

**S1 White label (hero, 100svh, not pinned).** The can at three-quarter view on the paper sweep: raw aluminium, blank proof label. The camera starts around position (0.9, 0.7, 3.2) looking at (0, 0.62, 0); tune it by screenshot. A slow idle turn (±8°) and a gentle pointer parallax on fine pointers. The copy block sits low left, with a small condensed line under the buttons: "Independent studio in Manila, Philippines. Working with brands everywhere." Scrolling into S2 dollies the camera in and turns the can to face front (scrubbed).

**S2 Try it on (pinned, 150%).** Desktop: can centre-right, controls on the left. Mobile: can in the top half, controls in a sticky bottom panel that scrolls internally. Controls: brand name, label colour (a radio group of named swatches plus custom), finish, label style, optional logo, "Print it", "Download your can", and "Share" on devices where the Web Share API accepts files. Drag the can to spin it, using pointer events on a DOM overlay (a `grab`/`grabbing` cursor and a small "Drag to spin" hint on fine pointers). Keyboard alternative: the stage is focusable and the arrow keys turn it, plus visible "Turn left" and "Turn right" buttons (WCAG 2.5.7). Scrolling within the pin adds at most a ±10° orbit and must never fight typing. If the visitor leaves the pin without printing, print once with the sample name "Your brand" in Cherry so everyone sees the effect. A sample print changes the can only; the takeover happens only when visitors set a brand themselves.

**S3 Can, bottle, jar or box (pinned, 250%).** The can joins the bottle, jar and mailer box in a row on the sweep, all wearing the visitor's artwork. Scroll trucks the camera along the row; each product turns about 20° as it passes the centre, and a condensed caption names it: "355 mL can", "750 mL bottle", "50 mL jar", "Mailer box". Mobile shows one product at a time, centred, swapping on scroll.

**S4 From white label to launch (pinned, 400%).** Five beats, each about 20% of the range. This is the website process. The steps are a real sequence, so number them, and render each as a step number, a short heading and a paragraph:
- 01 Brief: the can as a clean wireframe (EdgesGeometry lines in process black) on the paper.
- 02 Direction: the label returns in `proof` mode and unwraps from the back seam into a flat dieline facing the camera (signature moment 2). The camera pulls back to frame it.
- 03 Design: the flat dieline shows the final artwork; trim, bleed and seam annotations draw in, then fade.
- 04 Build: the label wraps back onto the can while the wireframe resolves into solid aluminium.
- 05 Launch: the ring-pull flips up, a short burst of fizz (at most 200 sprite particles on desktop and 80 on mobile, with the sprite drawn in canvas), and the can rises out of frame. The background washes to `--brand` with no flashing.

**S5 What I build (normal flow; the stage is paused and hidden).** A large, calm definition list, not cards: each type of website is a term with one sentence of description (§8). Below the list, one short paragraph about working from Manila (§8). On fine pointers, hovering or focusing an item shows a small swatch of the visitor's label colour beside it. Nothing more.

**S6 Selected work.** Render only if `config.work` has entries (title, year, role, one-line outcome, link, optional image path). Otherwise leave out the section and its entry in the scene index.

**S7 The brief (normal flow, never pinned).** Styled as a print job ticket on paper: a bordered sheet with condensed field labels, a job number generated in the browser (JT-yymmdd-three random digits) and a stamp area that gets a "Checked" stamp as each step is completed. On desktop the can returns, small, beside the ticket, wearing the visitor's brand. One `<form>` with four fieldsets shown one at a time (The brand, The website, The details, You); details in §9. On success, a shipping sticker prints onto the label, the can slides off the sweep, and the ticket shows the success message.

**S8 Footer.** A huge headline, "Your brand here.", which becomes "{Brand}. Launching soon." once the visitor sets a brand. The contact email with a copy button and a confirmation, social links, "Based in Manila, Philippines", a live local clock for Manila (`Intl.DateTimeFormat` with `Asia/Manila`, updated every 30 s), the availability line, a privacy link and the year.

Persistent interface:
- Header: the STUDIO_NAME wordmark on the left, and a "Start a brief" button on the right that scrolls to S7 with Lenis `scrollTo` and moves focus to the form heading.
- A skip link as the first focusable element: "Skip to the brief".
- Progress strip, fixed bottom-left: a printer's colour bar whose patches fill as you scroll, with the scene name beside it ("Scene 3 of 8: Can, bottle, jar or box"). Activating it opens a scene index, a `<nav>` with a list of links for jumping around. On small screens keep the strip and hide the text.
- Once the visitor sets a brand: `document.title` becomes "{Brand} × {STUDIO_NAME}", `--brand` and `--brand-ink` update, the form's brand field is prefilled, and the footer headline changes. Keep BrandState in sessionStorage for the session only.

404 page: the headline "This page is out of stock.", the line "The can you're after isn't on this shelf." and a "Back to the shelf" button. Visual: a crushed can (vertex displacement on the body) lying on the sweep, with the headline's wdth squeezed. Same header and footer.

Privacy page: short and plain; copy in §8.

## 8. Copy deck
Sentence case, plain active verbs, few em dashes. Confident, never salesy. Keep all copy in `src/content.ts` so it can be edited without touching components.
- Meta title: "Websites for brands | {STUDIO_NAME}"
- Meta description: "Cinematic, fast websites for brands, designed and built by an independent studio in Manila, Philippines."
- S1 H1: "Let's build your brand's website."
- S1 sub: "I design and build websites for brands: cinematic, fast and made to sell."
- S1 buttons: "Try your brand on the can" (scrolls to S2) and "Start a brief" (goes to S7).
- S1 location line: "Independent studio in Manila, Philippines. Working with brands everywhere."
- S2 heading: "Go on, try it on."
- S2 body: "Type your brand name, pick a colour and watch it print. Your website can feel like this."
- S2 labels: "Brand name" (placeholder "Your brand name"), "Label colour", "Finish", "Label style", "Add a logo (it stays on your device)", "Print it", "Download your can", "Share", "Turn left", "Turn right".
- S2 live region: "Printed: {name}".
- S3 heading: "Can, bottle, jar or box."
- S3 body: "Whatever you make, your website should feel as good as holding it."
- S4 heading: "From white label to launch."
- S4 steps:
  - 01 Brief: "You tell me about your brand, who it's for and when the site needs to go live."
  - 02 Direction: "We choose one idea worth remembering and a look that could only be yours."
  - 03 Design: "Every page designed around your brand, starting on mobile."
  - 04 Build: "Fast, accessible code, with content you can update yourself."
  - 05 Launch: "Tested on real phones, then live. I stay on after launch for fixes."
- S5 heading: "What I build"
  - Brand websites: "A home for your brand that people remember."
  - Landing pages: "One focused page for a launch, a product or a campaign."
  - Online stores: "Shops that look like your brand and are easy to buy from."
  - Redesigns: "Keep what works, rebuild what doesn't, and make it fast."
- S5 Manila paragraph: "I work from Manila, Philippines. You get the craft of a design studio at a fairer price than most, with one person handling your project from first sketch to launch."
- S7 heading: "Let's build your website."
- S7 intro: "Tell me about your brand. It takes about two minutes and lands straight in my inbox. No bots, no mailing lists."
- Step titles: "The brand", "The website", "The details", "You".
- Price note (in "The details" step, above the budget field): "Most websites I build land between A$1,250 and A$1,500, depending on pages and features. I'll confirm a fixed quote after reading your brief."
- Buttons: "Next", "Back", "Send brief".
- Success: "Brief sent. I'll reply within {REPLY_WITHIN} with a fixed quote and next steps."
- Error: "The brief didn't send. Check your connection and try again, or email {CONTACT_EMAIL}."
- No-key fallback note: "Your email app will open with the brief filled in."
- Under the submit button: "I'll only use your details to reply to this brief."
- Footer availability: "{AVAILABILITY}."
- 404: as in §7.
- Privacy: "This site doesn't use cookies or analytics. If you send a brief, it's delivered to my inbox by Web3Forms so I can reply. I don't add you to any list, and I'll delete your details whenever you ask."
Config defaults: REPLY_WITHIN = "one business day"; AVAILABILITY = "Booking website projects for next month".

## 9. The brief form
Fields (mark required fields in text, not only with an asterisk):
- The brand: Brand name (required; prefilled from S2); Current website or Instagram (optional URL); What does your brand do? (required; single-choice chips: Drinks, Food, Beauty & skincare, Fashion, Home, Tech, Services, Something else).
- The website: What do you need? (at least one; multi-select chips: New website, Landing page, Online store, Redesign, Not sure yet); What should the website do for you? (required; 160 characters at most, with a live counter).
- The details: the price note from §8 as plain body text (not a badge, not highlighted, no bold numbers); Budget (required: Under A$1,250, A$1,250–A$1,500, A$1,500–A$3,000, A$3,000+, Not sure yet); Timeline (required: As soon as possible, In 1–2 months, In 3+ months, Flexible); Anything else? (optional textarea).
- You: Your name (required); Email (required); Where are you based? (optional); Link to brand assets such as Google Drive or Dropbox (optional URL).
The price is mentioned nowhere else on the site except config and the email subject line of briefs.

Behaviour:
- A native `<form>` with `<fieldset>` and `<legend>`; chips are real radio and checkbox inputs styled as chips. Full keyboard support. Changing step moves focus to the legend and announces "Step 2 of 4: The website".
- Validate on blur and on Next, not while typing. Errors are text linked with `aria-describedby` and summarised at the top of the step, and focus goes to the first invalid field.
- A honeypot checkbox named `botcheck`: visually hidden, `tabindex="-1"`, `autocomplete="off"`.
- Submit POSTs JSON with `access_key`, `subject` ("New website brief: {brand}, {budget} ({job number})"), `from_name` (STUDIO_NAME), `email` (Web3Forms uses it as the reply-to address), every field, the label settings they tried (colour hex, finish, style) and the job number. Disable the button and show progress while sending. Handle network errors and unsuccessful responses without losing anything the visitor typed.
- If `VITE_WEB3FORMS_KEY` is missing, "Send brief" opens a `mailto:` draft to CONTACT_EMAIL with the whole brief in the body, and a "Copy brief" button copies it to the clipboard.
- Success replaces the form with the success message, the job number and a "Download your can" link.

## 10. Accessibility (WCAG 2.2 AA)
`lang="en"`; one H1; header, main, nav and footer landmarks; visible `:focus-visible` rings (3 px, 3 px offset, `--brand` with enough contrast); targets at least 44×44 px; AA contrast everywhere, including text over the 3D (add a paper backing where needed). The canvas is `aria-hidden="true"`, and everything it shows also exists in the DOM. No keyboard traps in pinned scenes. Nothing flashes more than three times a second. Forms as in §9. The scene index is a real `<nav>` with a list of links.

## 11. Performance budget
- Initial JavaScript ≤ 300 KB gzipped (three, gsap, lenis and the app). Lazy-load the line-up products, Fraunces, the separation worker, share and download, and the debug tools.
- The LCP element is the H1 (DOM text). CLS < 0.05: reserve space, and pair `font-display: swap` with a metric-matched fallback using `size-adjust`. No long task over 200 ms after load.
- Preload the Archivo woff2 used above the fold. In the DOM, animate only `transform` and `opacity`; use `gsap.quickSetter` for the progress strip.
- Frame time: aim for 60 fps on desktop. Under 4× CPU throttling, the p95 frame time stays under 33 ms. Measure it with `scripts/perf.mjs` (Playwright plus the Chrome DevTools Protocol) and record the numbers in QA.md.

## 12. Responsive
Design the mobile compositions on purpose rather than shrinking desktop: copy stacked under the product, sticky controls in S2, one product at a time in S3, shorter pins, simpler camera moves, no transmission and fewer particles. Test at 360, 390, 768, 1024, 1440 and 1920 px wide. Landscape phones stay usable.

## 13. SEO, security and hosting config
- The title and description from §8, a canonical URL, Open Graph and Twitter tags, `theme-color` set to the paper colour, an SVG favicon (a simple can silhouette in process black) with a 180 px PNG, `manifest.webmanifest`, `robots.txt` and `sitemap.xml`.
- JSON-LD `ProfessionalService` with `address` locality Manila, country PH, plus only other fields that are actually set in config. No price in JSON-LD.
- `npm run og` uses Playwright to screenshot the hero at 1200×630 into `public/og.png`.
- `public/_headers` for Cloudflare Pages: long-lived immutable caching for hashed assets, and a Content-Security-Policy of `default-src 'self'; connect-src 'self' https://api.web3forms.com; img-src 'self' data: blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. Confirm the built site works under it.

## 14. Non-goals
No CMS, server, accounts, analytics, cookie banner, dark mode, audio or translations. No pricing page or pricing table.

## 15. Milestones (commit after each, and keep PROGRESS.md as a live checklist)
- M0 Scaffold: Vite + TS strict, ESLint and Prettier, Vitest, Playwright, folder structure, config and content files, tokens.
- M1 Static site: every scene's DOM, copy, layout and a working form, with no motion and no 3D. This is also the reduced-motion baseline. Screenshot it and critique it.
- M2 Stage: renderer, sweep, lighting, the can, the label renderer (all modes and layouts), the try-it controls with a live label, drag and keyboard rotation, PNG download.
- M3 The print run with worker separation.
- M4 Scroll director: Lenis plus ScrollTrigger, the Stage state, the S1–S4 choreography, the unwrap, the line-up, the launch, the progress strip and the scene index.
- M5 Form submission with its success, error and fallback states; footer personalisation; the 404 and privacy pages.
- M6 Mobile compositions, reduced motion, the no-WebGL fallback, quality tiers.
- M7 Performance: bundle analysis, lazy loading, render on demand, `compileAsync`.
- M8 QA (§16), fixing everything it finds.
- M9 Docs and deploy config.
If you run out of time or budget partway through, leave PROGRESS.md accurate so the next session can continue from it.

## 16. Verification loop (do all of it)
- Unit tests (Vitest): text fitting, the contrast ink choice, RGB-to-CMYK separation, barcode generation, job numbers, form serialisation and the mailto body.
- End-to-end tests (Playwright on Chromium, WebKit and Firefox; if some browsers can't be installed where you run, use Chromium and say so in QA.md): no console errors; typing a brand updates the live region, the title, the footer and the form prefill; choosing a colour updates `--brand`; download produces a PNG; validation messages; step navigation by keyboard; the price note appears only in the details step; mocked success (intercept api.web3forms.com); mocked failure; the missing-key mailto fallback; reduced-motion emulation shows static scenes; a no-WebGL run (stub `getContext` to return null for webgl and webgl2) shows the fallback; the 404 page renders. Headless browsers may lack GPU WebGL, so tests must pass on both paths. Never disable a feature just to make a test pass.
- `npm run screenshots`: save PNGs of every scene at 390×844, 768×1024 and 1440×900 to `qa/screenshots/`. If your environment can view images, open and review them yourself. Critique them against §2 and §5: Is the white-label idea obvious within three seconds? Does any text collide with the product? Is the type hierarchy crisp and the spacing consistent? Is the colour restrained? Does the Manila and price copy read confident rather than cheap? Does anything from the anti-generic checklist appear? Fix, re-shoot, then do a second critique pass, and record what changed in QA.md.
- Lighthouse (desktop and mobile presets) against `npm run preview`, using Playwright's Chromium through CHROME_PATH if there is no system Chrome. Save the JSON to `qa/`, record the scores in QA.md, and iterate until the §3 targets are met.
- Run `scripts/perf.mjs` and record the numbers.

## 17. Deliverables
- README: what the site is; quick start; where to edit config, copy and the price range; how to get a free Web3Forms access key and set `VITE_WEB3FORMS_KEY`; deploying to Cloudflare Pages (build command `npm run build`, output directory `dist`, the environment variable); and a "Before you launch" checklist (placeholders, sending yourself a real test brief, checking the OG image, an optional custom domain).
- DECISIONS.md: every judgement call, with one line of reasoning each.
- QA.md: test results, Lighthouse scores, performance numbers, the screenshot index, and honest known limitations.
- Finish with a short report: what you built, how to run it, what I need to fill in, and anything you couldn't verify.