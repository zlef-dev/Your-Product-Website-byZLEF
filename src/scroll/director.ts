/**
 * The scroll director. Lenis drives smooth scrolling from GSAP's ticker; ScrollTrigger
 * pins S2–S4; one master timeline, measured in scene units (0–6), writes the Stage state.
 * Scroll position maps onto timeline time piecewise through the live pin boundaries,
 * smoothed like `scrub: 1`, so resizes and pin changes can never desync the choreography.
 *
 *   0–1  S1 → S2   dolly in, can turns to face front
 *   1–2  S2 pinned  small orbit while the visitor plays with the label
 *   2–3  S2 → S3   the line-up joins
 *   3–4  S3 pinned  truck along the row, one caption at a time
 *   4–5  S3 → S4   back to the can
 *   5–6  S4 pinned  Brief, Direction (unwrap), Design, Build, Launch
 *
 * Reduced motion: no Lenis, no pins, no scrubbing. Each scene snaps the stage to a static
 * composition glued to that scene's layout slot.
 */
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { BRIEF_SENT } from '../form/brief';
import { $, $$, finePointer, reducedMotionQuery, setScrollImpl, wideQuery } from '../lib/dom';
import { CAN } from '../stage/dims';
import { DEFAULT_STATE, type StageState } from '../stage/state';
import { initProgress } from './progress';
import { initSplit } from './split';

gsap.registerPlugin(ScrollTrigger, CustomEase);
CustomEase.create('press', '0.7,0,0.2,1');
CustomEase.create('glide', '0.33,0,0.2,1');

/** What the director needs from the stage; calls queue until the stage exists. */
export interface StageLink {
  setVisible(v: boolean): void;
  setAnchor(el: HTMLElement | null, fill?: number): void;
  snapNext(): void;
  resetSpin(): void;
  ensureLineup(): void;
  setPointer(x: number, y: number): void;
  /** The stage state changed: make sure the render loop is running (restarts a dead one). */
  wake(): void;
  /** Prints the shipping sticker onto the label. */
  sticker(job: string): void;
}

/** Line-up positions and framing heights (mirrors stage/lineup.ts without importing three). */
const ROW = [
  { x: 0, ref: CAN.height * 1.25 },
  { x: 2.2, ref: 2.42 * 1.12 },
  { x: 4.3, ref: 0.95 },
  { x: 6.4, ref: 1.3 * 1.3 },
];
const ROW_CENTRE = 3.2;
const ROW_WIDTH = 8.6;

/** Pin lengths in viewport heights (desktop); phones use about 70%. */
const PINS = { try: 1.5, lineup: 2.5, process: 4 };
const MOBILE_PIN = 0.7;

type Frame = Pick<StageState, 'fx' | 'fy' | 'fh' | 'fw'>;

/** A slot's composition as it sits when its (pinned) section is at the top of the viewport. */
function frameOf(slot: HTMLElement | null, fill: number): Frame {
  if (!slot) return { fx: 0.5, fy: 0.5, fh: 0.6, fw: 0.6 };
  const section = slot.closest('section') ?? document.body;
  const sr = section.getBoundingClientRect();
  const r = slot.getBoundingClientRect();
  return {
    fx: (r.left + r.width / 2) / innerWidth,
    fy: (r.top - sr.top + r.height / 2) / innerHeight,
    fh: (r.height / innerHeight) * fill,
    fw: (r.width / innerWidth) * fill,
  };
}

const RESET: Partial<StageState> = {
  unwrap: 0,
  proof: 0,
  annotate: 0,
  solid: 1,
  wire: 0,
  label: 1,
  ringPull: 0,
  fizz: 0,
  rise: 0,
  wash: 0,
  ship: 0,
  canX: 0,
  canY: 0,
};

export interface Director {
  attach(link: StageLink): void;
  /** Called when the visitor prints: the sweep may pick up a hint of their colour. */
  printed(): void;
}

export function initDirector(opts: {
  target: StageState;
  reducedMotion: boolean;
  onSampleNeeded: (instant: boolean) => void;
}): Director {
  const T = opts.target;
  let link: StageLink | null = null;
  const queued: Array<(l: StageLink) => void> = [];
  const call = (fn: (l: StageLink) => void) => (link ? fn(link) : queued.push(fn));

  const slots = {
    top: $('[data-slot="top"]'),
    try: $('[data-slot="try"]'),
    lineup: $('[data-slot="lineup"]'),
    process: $('[data-slot="process"]'),
    brief: $('[data-slot="brief"]'),
  };

  const heroPose = (): Partial<StageState> => ({
    ...DEFAULT_STATE,
    ...frameOf(slots.top, 0.78),
    tx: 0,
    ty: 0.61,
    tz: 0,
    yaw: 0.27,
    pitch: 0.08,
    ref: CAN.height,
    refW: 0,
    canRot: 0.1,
    idle: 1,
    spinWeight: 0,
    lineup: 0,
    tint: T.tint,
  });

  let shipped = false;
  const briefPose = (): Partial<StageState> => ({
    ...RESET,
    ship: shipped ? 1 : 0,
    tx: 0,
    ty: 0.61,
    tz: 0,
    yaw: 0.3,
    pitch: 0.08,
    ref: CAN.height,
    refW: 0,
    canRot: 0.1,
    idle: 0.6,
    spinWeight: 0,
    lineup: 0,
  });

  // ---------- Pointer parallax (fine pointers, hero only; the stage weighs it by idle) ----------
  if (finePointer() && !opts.reducedMotion) {
    addEventListener(
      'pointermove',
      (e) => call((l) => l.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1)),
      { passive: true },
    );
  }

  ScrollTrigger.config({ ignoreMobileResize: true });
  // ?debug draws ScrollTrigger's start/end markers (the frame-time readout is lazy-loaded
  // separately by main.ts; markers are part of ScrollTrigger itself, so this is one flag).
  if (new URLSearchParams(location.search).has('debug')) ScrollTrigger.defaults({ markers: true });
  const mm = gsap.matchMedia();

  // After first paint, in its own task: pins and timelines aren't needed to read the hero.
  // `any` always matches: gsap.matchMedia only runs the callback while some condition does.
  setTimeout(() => {
    mm.add({ any: '(min-width: 0px)', wide: wideQuery, reduce: reducedMotionQuery }, (ctx) => {
      const { wide, reduce } = ctx.conditions as { wide: boolean; reduce: boolean };
      return reduce ? staticScenes(wide) : scrollScenes(wide);
    });
  }, 0);

  // ---------- Motion: Lenis, pins and the master timeline ----------

  function scrollScenes(wide: boolean): () => void {
    document.documentElement.classList.add('is-motion');
    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.1,
      smoothWheel: true,
      // Let panels that scroll internally (S2 controls on phones, the scene index) scroll natively.
      prevent: (node: HTMLElement) => {
        const panel = node.closest<HTMLElement>('.try__panel, .scene-index');
        return !!panel && panel.scrollHeight > panel.clientHeight + 1;
      },
    });
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const scale = wide ? 1 : MOBILE_PIN;
    const pin = (sel: string, len: number, extra: ScrollTrigger.Vars = {}) =>
      ScrollTrigger.create({
        trigger: sel,
        start: 'top top',
        end: `+=${Math.round(len * scale * 100)}%`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        ...extra,
      });
    const stTry = pin('#try', PINS.try, {
      onEnter: () => call((l) => l.ensureLineup()),
      // Leaving without printing: print the sample once so everyone sees the effect.
      onLeave: () => opts.onSampleNeeded(false),
    });
    const stLineup = pin('#lineup', PINS.lineup);
    const stProcess = pin('#process', PINS.process);

    const bounds = () => [
      0,
      stTry.start,
      stTry.end,
      stLineup.start,
      stLineup.end,
      stProcess.start,
      stProcess.end,
    ];
    const timeFor = (y: number) => {
      const b = bounds();
      for (let i = 0; i < b.length - 1; i++) {
        const a = b[i]!;
        const z = b[i + 1]!;
        if (y <= z) return i + (z > a ? Math.max(0, (y - a) / (z - a)) : 0);
      }
      return b.length - 1;
    };

    const captions = $$('[data-caption]');
    const steps = $$('[data-beat]');
    const crop = $('.process__slot .crop');
    const processTitle = $('.process__copy');
    let tl = gsap.timeline({ paused: true });
    let briefMode = false;

    const syncLabels = () => {
      const t = tl.time();
      if (t >= 2.5 && t <= 4.5) {
        // A caption shows only while its product is centred (none during the overview).
        const best = ROW.findIndex((p) => Math.abs(T.tx - p.x) < 0.5 && T.refW === 0);
        captions.forEach((c, i) => c.classList.toggle('is-active', i === best));
      }
      const beat = Math.min(4, Math.max(0, Math.floor((t - 5) * 5)));
      steps.forEach((s, i) => s.classList.toggle('is-active', i === beat));
    };

    const build = () => {
      const time = tl.time();
      tl.kill();
      Object.assign(T, heroPose());
      tl = gsap.timeline({ paused: true, onUpdate: syncLabels, defaults: { ease: 'none' } });
      const to = (pos: number, dur: number, vars: Partial<StageState>, ease = 'none') =>
        tl.to(T, { ...vars, duration: dur, ease }, pos);

      const tryFrame = frameOf(slots.try, wide ? 0.6 : 0.74);
      const lineFrame = frameOf(slots.lineup, 0.82);
      const procFrame = frameOf(slots.process, 0.72);

      // 0–1 S1 → S2: dolly in and turn to face front.
      to(0, 1, { ...tryFrame, yaw: 0, pitch: 0.05, canRot: 0 }, 'glide');
      to(0, 0.5, { idle: 0 });
      to(0.7, 0.3, { spinWeight: 1 });

      // 1–2 S2 pinned: at most a ±10° orbit, never fighting the controls.
      to(1, 1, { yaw: 0.16 }, 'sine.inOut');

      // 2–3 S2 → S3: the line-up joins.
      to(2, 0.3, { spinWeight: 0 });
      to(2.1, 0.9, { lineup: 1 }, 'power2.out');
      if (wide) {
        to(
          2,
          1,
          {
            ...lineFrame,
            tx: ROW_CENTRE,
            ty: 1.05,
            ref: 2.6,
            refW: ROW_WIDTH,
            yaw: 0.08,
            pitch: 0.12,
            canRot: 0.1,
          },
          'glide',
        );
      } else {
        to(
          2,
          1,
          { ...lineFrame, tx: 0, ty: 0.7, ref: ROW[0]!.ref, refW: 0, yaw: 0.1, pitch: 0.08, canRot: 0.1 },
          'glide',
        );
      }

      // 3–4 S3 pinned: truck along the row; each product turns as it passes.
      const stops = wide ? [3.12, 3.34, 3.56, 3.78] : [3.0, 3.26, 3.52, 3.78];
      ROW.forEach((p, i) => {
        const at = stops[i]!;
        const dur = i === 0 && !wide ? 0.001 : 0.16;
        to(at, dur, { tx: p.x, ty: p.ref / 2.3, ref: p.ref, refW: 0, yaw: 0.06, pitch: 0.08 }, 'glide');
      });

      // 4–5 S3 → S4: back to the can, now a technical subject.
      to(4, 0.8, { lineup: 0 }, 'power2.in');
      to(
        4,
        1,
        { ...procFrame, tx: 0, ty: 0.61, tz: 0, ref: CAN.height, refW: 0, yaw: 0.36, pitch: 0.14, canRot: 0 },
        'glide',
      );

      // 5–6 S4 pinned: five beats of 0.2.
      // 01 Brief: the can dissolves into a clean wireframe.
      to(5, 0.08, { solid: 0, wire: 1, label: 0 }, 'power1.inOut');
      // 02 Direction: the label returns as a proof and unwraps into a flat dieline.
      tl.set(T, { proof: 1 }, 5.19);
      to(5.2, 0.04, { label: 1 });
      to(5.24, 0.14, { unwrap: 1 }, 'power1.inOut');
      to(
        5.24,
        0.14,
        { yaw: 0, pitch: 0.02, tz: 0.42, ty: CAN.wallBottom + 0.495, ref: 1.25, refW: 2.45 },
        'glide',
      );
      if (crop) {
        tl.to(crop, { opacity: 1, duration: 0.03 }, 5.26);
        tl.to(crop, { opacity: 0, duration: 0.03 }, 5.4);
      }
      // 03 Design: final artwork on the dieline; trim, bleed and seam draw in, then fade.
      tl.set(T, { proof: 0 }, 5.4);
      to(5.42, 0.1, { annotate: 1 });
      to(5.54, 0.05, { annotate: 0 });
      // 04 Build: the label wraps back while the wireframe resolves into solid aluminium.
      to(5.6, 0.12, { unwrap: 0 }, 'power1.inOut');
      to(5.6, 0.14, { yaw: 0.3, pitch: 0.1, tz: 0, ty: 0.61, ref: CAN.height, refW: 0 }, 'glide');
      to(5.64, 0.16, { solid: 1 }, 'power1.inOut');
      to(5.76, 0.04, { wire: 0 });
      // 05 Launch: ring-pull, fizz, the can rises out of frame, the sweep washes to the brand.
      to(5.8, 0.04, { ringPull: 1 }, 'back.out(2)');
      to(5.82, 0.12, { fizz: 1 });
      to(5.83, 0.12, { wash: 1 }, 'power1.inOut');
      to(5.86, 0.14, { rise: 1 }, 'power2.in');
      if (processTitle) tl.to(processTitle, { opacity: 0, duration: 0.05 }, 5.83);

      tl.time(Math.min(time, tl.duration()));
      if (briefMode) enterBrief();
      link?.wake();
    };

    // Scroll → timeline time, smoothed like scrub: 1.
    const proxy = { time: 0 };
    const toTime = gsap.quickTo(proxy, 'time', {
      duration: 1,
      ease: 'power3',
      onUpdate: () => {
        if (!briefMode) tl.time(Math.min(proxy.time, tl.duration()));
        link?.wake();
      },
    });
    const master = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        toTime(timeFor(self.scroll()));
        link?.wake();
      },
    });

    // ---------- Stage visibility: hidden for S5/S6 and the footer; the brief glues it to its slot ----------
    const enterBrief = () => {
      briefMode = true;
      if (!wide) {
        call((l) => l.setVisible(false));
        return;
      }
      // Arriving here without passing S2 (a deep link, "Start a brief"): the can beside the
      // ticket wears the sample print instead of the blank label.
      opts.onSampleNeeded(true);
      Object.assign(T, briefPose());
      call((l) => {
        l.setAnchor(slots.brief, 0.78);
        l.snapNext();
        l.setVisible(true);
      });
    };
    const leaveBrief = (toStage: boolean) => {
      briefMode = false;
      call((l) => {
        l.setAnchor(null);
        l.setVisible(toStage);
      });
      // Re-render every tween so values the brief pose touched come back.
      const t = tl.time();
      tl.time(0).time(t);
      call((l) => l.snapNext());
    };
    ScrollTrigger.create({
      trigger: '#build',
      start: 'top 55%',
      onEnter: () => call((l) => l.setVisible(false)),
      onLeaveBack: () => leaveBrief(true),
    });
    ScrollTrigger.create({
      trigger: '#brief',
      start: 'top 45%',
      end: 'bottom 45%',
      onEnter: enterBrief,
      onEnterBack: enterBrief,
      onLeave: () => leaveBrief(false),
      onLeaveBack: () => leaveBrief(false),
    });

    ScrollTrigger.addEventListener('refresh', build);
    build();
    if (new URLSearchParams(location.search).has('debug')) {
      // Debug probe: re-render the timeline from scratch at its current time and report any
      // stage value that differs from what is live. A mismatch means the live state drifted
      // from what the scroll position says it should be.
      (window as unknown as { __timelineCheck?: () => unknown }).__timelineCheck = () => {
        const keys = Object.keys(DEFAULT_STATE) as Array<keyof StageState>;
        const live = { ...T };
        const t = tl.time();
        tl.time(0).time(t);
        const diffs = keys
          .filter((k) => Math.abs((live[k] as number) - (T[k] as number)) > 0.02)
          .map(
            (k) => `${k}: live ${(live[k] as number).toFixed(2)} vs timeline ${(T[k] as number).toFixed(2)}`,
          );
        return { time: +t.toFixed(3), proxy: +proxy.time.toFixed(3), briefMode, diffs };
      };
    }
    // A reload mid-page starts at the right moment instead of replaying from the top.
    proxy.time = timeFor(scrollY);
    tl.time(Math.min(proxy.time, tl.duration()));
    // A link straight to a scene (/#brief): the browser scrolls to the anchor before the pins
    // add their scroll space, so land on the scene once the layout is final. Only during
    // load: it stops as soon as the visitor scrolls, and never re-runs on a later resize.
    const hashId = decodeURIComponent(location.hash.slice(1));
    let interacted = false;
    for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) {
      addEventListener(type, () => (interacted = true), { once: true, passive: true });
    }
    let landedAt: number | null = null;
    const jumpToHash = () => {
      const el = hashId && !interacted ? document.getElementById(hashId) : null;
      if (!el) return;
      // A later pass (after fonts load) only corrects small layout shifts. If the page has
      // since been scrolled far from where we landed (a scrollbar drag fires no wheel or key
      // event), the visitor has moved on: leave them there.
      if (landedAt !== null && Math.abs(scrollY - landedAt) > 400) return;
      const st = ScrollTrigger.getAll().find((t) => t.trigger === el && t.pin);
      const y = st ? st.start : el.getBoundingClientRect().top + scrollY;
      // Lenis clamps to the scroll limit it measured before the pins added their height.
      lenis.resize();
      lenis.scrollTo(y, { immediate: true, force: true });
      if (Math.abs(scrollY - y) > 2) window.scrollTo(0, y);
      landedAt = scrollY;
      // Land on the scene's moment without easing in from the top. The quickTo tween must be
      // left alone: killing it (killTweensOf) stops the timeline following the scroll for good.
      proxy.time = timeFor(y);
      toTime(proxy.time);
      tl.time(Math.min(proxy.time, tl.duration()));
      link?.wake();
    };
    jumpToHash();

    // The progress strip and heading reveals set up in their own tasks, after the pins.
    let progress = () => {};
    let split = () => {};
    const later = [
      setTimeout(() => (progress = initProgress()), 0),
      setTimeout(() => (split = initSplit()), 40),
    ];

    setScrollImpl((el, done) => {
      const st = ScrollTrigger.getAll().find((s) => s.trigger === el && s.pin);
      const y = st ? st.start : el.getBoundingClientRect().top + scrollY;
      lenis.scrollTo(y, { duration: 1.2, onComplete: () => done?.() });
    });

    // Refresh once fonts are in (line breaks move) and again when the stage exists.
    void document.fonts.ready.then(() => {
      ScrollTrigger.refresh();
      jumpToHash();
    });

    return () => {
      later.forEach(clearTimeout);
      ScrollTrigger.removeEventListener('refresh', build);
      master.kill();
      tl.kill();
      progress();
      split();
      gsap.ticker.remove(raf);
      lenis.destroy();
      document.documentElement.classList.remove('is-motion');
      call((l) => {
        l.setAnchor(null);
        l.setVisible(true);
      });
    };
  }

  // ---------- Reduced motion: static compositions in normal flow ----------

  function staticScenes(wide: boolean): () => void {
    const poses: Array<[string, HTMLElement | null, number, Partial<StageState> | null]> = [
      ['#top', slots.top, 0.78, { yaw: 0.27, pitch: 0.08, canRot: 0.1, spinWeight: 0 }],
      ['#try', slots.try, 0.6, { yaw: 0, pitch: 0.05, canRot: 0, spinWeight: 1 }],
      [
        '#lineup',
        slots.lineup,
        0.8,
        { tx: ROW_CENTRE, ty: 1.05, ref: 2.6, refW: ROW_WIDTH, yaw: 0.08, pitch: 0.12, lineup: 1 },
      ],
      [
        '#process',
        slots.process,
        0.8,
        {
          yaw: 0,
          pitch: 0.02,
          tz: 0.42,
          ty: CAN.wallBottom + 0.495,
          ref: 1.25,
          refW: 2.45,
          unwrap: 1,
          proof: 1,
        },
      ],
      ['#build', null, 0, null],
      ['#brief', wide ? slots.brief : null, 0.78, wide ? { yaw: 0.3, pitch: 0.08, canRot: 0.1 } : null],
      ['#contact', null, 0, null],
    ];
    const show = (slot: HTMLElement | null, fill: number, pose: Partial<StageState> | null) => {
      if (!pose || !slot) {
        call((l) => l.setVisible(false));
        return;
      }
      Object.assign(
        T,
        DEFAULT_STATE,
        RESET,
        { tx: 0, ty: 0.61, tz: 0, ref: CAN.height, refW: 0, idle: 0, lineup: 0 },
        pose,
      );
      call((l) => {
        if (pose.lineup) l.ensureLineup();
        l.setAnchor(slot, fill);
        l.snapNext();
        l.setVisible(true);
      });
    };
    const triggers = poses.map(([sel, slot, fill, pose]) =>
      ScrollTrigger.create({
        trigger: sel,
        start: 'top 50%',
        end: 'bottom 50%',
        onToggle: (self) => {
          if (self.isActive) show(slot, fill, pose);
        },
        onLeave: sel === '#try' ? () => opts.onSampleNeeded(true) : undefined,
      }),
    );
    const progress = initProgress();
    return () => {
      triggers.forEach((t) => t.kill());
      progress();
    };
  }

  // Brief sent: a shipping sticker prints onto the label, then the can slides off the sweep.
  addEventListener(BRIEF_SENT, (e) => {
    const job = (e as CustomEvent<{ job: string }>).detail.job;
    shipped = true;
    call((l) => l.sticker(job));
    if (opts.reducedMotion) return;
    gsap.to(T, { ship: 1, duration: 1.3, delay: 0.7, ease: 'power2.in', onUpdate: () => link?.wake() });
  });

  return {
    attach(l: StageLink) {
      link = l;
      queued.splice(0).forEach((fn) => fn(l));
      ScrollTrigger.refresh();
    },
    printed() {
      gsap.to(T, { tint: 1, duration: 0.8, ease: 'power2.out', onUpdate: () => link?.wake() });
    },
  };
}
