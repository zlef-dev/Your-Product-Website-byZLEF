/**
 * The 3D stage: one persistent full-viewport canvas behind the DOM. It renders on
 * demand, reads the Stage state with light damping, and never listens to scroll itself.
 */
import {
  NeutralToneMapping,
  Color,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Object3D,
  Texture,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type { Finish } from '../lib/brand';
import { mixHex } from '../lib/contrast';
import type { Plates } from '../label/cmyk';
import type { PlateFrame } from '../label/print-run';
import { LabelSurfaces, type SurfaceName } from '../label/surfaces';
import { Can } from './can';
import { CAN } from './dims';
import { FrameMonitor, lower, TIERS, type Tier, type TierSettings } from './quality';
import { createContactShadow, createLightRig, createSweep, PAPER } from './set';
import { createState, damp, type StageState } from './state';

export const FOV = 32;
const TAN_HALF = Math.tan(((FOV / 2) * Math.PI) / 180);
const IDLE_AMPLITUDE = (8 * Math.PI) / 180;

export interface LineupLike {
  readonly group: Group;
  update(state: StageState, time: number): void;
  setTextures(get: (name: SurfaceName) => Texture): void;
  setBrandColour(hex: string): void;
  setTransmission(on: boolean): void;
  dispose(): void;
}

export interface FizzLike {
  readonly object: Object3D;
  update(t: number, origin: { x: number; y: number; z: number }): void;
  dispose(): void;
}

/** Tries WebGL2 without letting three.js log an error when it isn't there. */
export function probeWebGL(canvas: HTMLCanvasElement, antialias: boolean): WebGL2RenderingContext | null {
  try {
    return canvas.getContext('webgl2', {
      alpha: true,
      antialias,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null;
  } catch {
    return null;
  }
}

/** Reads the default framebuffer through a pixel buffer and a fence (WebGL2, no stall). */
function readPixelsAsync(gl: WebGL2RenderingContext, w: number, h: number): Promise<Uint8Array> {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
  gl.bufferData(gl.PIXEL_PACK_BUFFER, w * h * 4, gl.STREAM_READ);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const status = sync ? gl.clientWaitSync(sync, 0, 0) : gl.ALREADY_SIGNALED;
      if (status === gl.TIMEOUT_EXPIRED) {
        setTimeout(poll, 4);
        return;
      }
      if (status === gl.WAIT_FAILED) {
        reject(new Error('readPixels failed'));
        return;
      }
      const out = new Uint8Array(w * h * 4);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.deleteBuffer(buf);
      if (sync) gl.deleteSync(sync);
      resolve(out);
    };
    poll();
  });
}

export class Stage {
  /** What timelines write (owned by the director, shared in). */
  readonly target: StageState;
  /** What is rendered, damped toward target. */
  readonly current: StageState = createState();

  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(FOV, 1, 0.05, 80);
  readonly can: Can;
  readonly surfaces: LabelSurfaces;
  readonly settings: TierSettings;

  private sweep = createSweep();
  private rig: Group;
  private shadow: Mesh;
  private shadowCore: Mesh;
  private textures = new Map<SurfaceName, Texture>();
  private dirtyTextures = new Set<SurfaceName>();
  private running = false;
  private visible = true;
  private lastT = 0;
  private clock = 0;
  private spin = 0;
  private spinTarget = 0;
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private anchor: { el: HTMLElement; fill: number } | null = null;
  private lastAnchor = '';
  private busy = 0;
  private monitor = new FrameMonitor(20, 1000);
  private brand = '#D7263D';
  private sweepColour = new Color();
  private lineup: LineupLike | null = null;
  private fizz: FizzLike | null = null;
  private firstFrame: (() => void) | null = null;
  private shadowOffset = 0;
  private disposed = false;
  private snap = false;
  tier: Tier;

  constructor(
    readonly canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    tier: Tier,
    private readonly reducedMotion: boolean,
    target: StageState = createState(),
    canRows = 1,
  ) {
    this.target = target;
    Object.assign(this.current, target);
    this.tier = tier;
    this.settings = { ...TIERS[tier] };
    this.renderer = new WebGLRenderer({
      canvas,
      context: gl,
      alpha: true,
      antialias: this.settings.antialias,
    });
    const r = this.renderer;
    r.outputColorSpace = SRGBColorSpace;
    // Khronos PBR Neutral keeps label colours closest to the visitor's --brand (see DECISIONS.md).
    r.toneMapping = NeutralToneMapping;
    r.toneMappingExposure = 1;
    r.localClippingEnabled = true;
    // Production skips the synchronous shader status checks: faster compiles, and D3D11's
    // harmless HLSL compiler notes don't surface as console warnings.
    r.debug.checkShaderErrors = import.meta.env.DEV;
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.dpr));
    this.resize();

    if (this.settings.rectLights) RectAreaLightUniformsLib.init();
    const pmrem = new PMREMGenerator(r);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.85;
    room.dispose();
    pmrem.dispose();

    this.scene.add(this.sweep);
    this.rig = createLightRig(this.settings.rectLights);
    this.scene.add(this.rig);

    this.can = new Can({
      latheSegments: this.settings.latheSegments,
      radialSegments: this.settings.radialSegments,
      anisotropy: tier !== 'low',
      rows: canRows,
    });
    this.scene.add(this.can.group);
    this.shadow = createContactShadow(1.15, 1.15, 0.8);
    this.shadowCore = createContactShadow(0.66, 0.66, 0.9);
    this.scene.add(this.shadow, this.shadowCore);

    this.surfaces = new LabelSurfaces(this.settings.sleeveWidth);
    this.can.setLabelTexture(this.texture('sleeve'));
    this.surfaces.onChange((name) => {
      this.dirtyTextures.add(name);
      this.invalidate();
    });

    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', this.onResize);
  }

  // ---------- Setup ----------

  /** Compiles every shader off the main thread where supported, then renders once. */
  async warm(): Promise<void> {
    await this.surfaces.setArt(null);
    this.surfaces.drawSleeve('blank');
    this.applyState(0);
    await this.compile();
  }

  /**
   * Compiles shaders without blocking where KHR_parallel_shader_compile exists. Without it
   * (three.js would warn) the first render compiles them instead.
   */
  compile(): Promise<void> {
    if (!this.renderer.extensions.has('KHR_parallel_shader_compile')) return Promise.resolve();
    return this.renderer.compileAsync(this.scene, this.camera).then(
      () => undefined,
      () => undefined,
    );
  }

  onFirstFrame(cb: () => void): void {
    this.firstFrame = cb;
  }

  texture(name: SurfaceName): Texture {
    let t = this.textures.get(name);
    if (!t) {
      t = new Texture(this.surfaceImage(name));
      t.colorSpace = SRGBColorSpace;
      // flipY with mipmaps makes re-uploads stall the GPU; label geometry flips V instead.
      t.flipY = false;
      t.needsUpdate = true;
      t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      t.minFilter = LinearMipmapLinearFilter;
      this.textures.set(name, t);
    }
    return t;
  }

  attachLineup(lineup: LineupLike): void {
    this.lineup = lineup;
    lineup.setTextures((n) => this.texture(n));
    lineup.setBrandColour(this.brand);
    lineup.setTransmission(this.settings.transmission);
    this.scene.add(lineup.group);
    void this.compile().then(() => this.invalidate());
  }

  hasLineup(): boolean {
    return !!this.lineup;
  }

  attachFizz(fizz: FizzLike): void {
    this.fizz = fizz;
    this.can.group.add(fizz.object);
  }

  hasFizz(): boolean {
    return !!this.fizz;
  }

  // ---------- Inputs ----------

  setBrandColour(hex: string): void {
    this.brand = hex;
    this.lineup?.setBrandColour(hex);
    this.invalidate();
  }

  setFinish(f: Finish): void {
    this.can.setFinish(f);
    this.invalidate();
  }

  setInk(v: number): void {
    this.can.setInk(v);
    this.invalidate();
  }

  showPlates(plates: Plates | null, width: number, height: number): void {
    this.can.setPlates(plates, width, height);
    this.invalidate();
  }

  setPlateFrame(frame: PlateFrame): void {
    this.can.setPlateFrame(frame);
    this.invalidate();
  }

  /** Moves and stretches the contact shadow (a can lying on its side). */
  setShadow(offsetX: number, scaleX: number): void {
    this.shadowOffset = offsetX;
    this.shadow.scale.x = scaleX;
    this.shadowCore.scale.x = scaleX;
    this.invalidate();
  }

  /** Keeps the loop running while a print run or other 2D animation is in progress. */
  hold(on: boolean): void {
    this.busy = Math.max(0, this.busy + (on ? 1 : -1));
    this.invalidate();
  }

  turn(deg: number, immediate = false): void {
    this.spinTarget += deg;
    if (immediate || this.reducedMotion) this.spin = this.spinTarget;
    this.invalidate();
  }

  rotation(): number {
    return (((Math.round(this.spinTarget) % 360) + 360) % 360) as number;
  }

  resetSpin(): void {
    this.spinTarget = Math.round(this.spinTarget / 360) * 360;
  }

  setPointer(x: number, y: number): void {
    this.pointer.tx = x;
    this.pointer.ty = y;
    if (this.current.idle > 0.01) this.invalidate();
  }

  /** Glue the product to a DOM element each frame (brief scene, reduced motion). */
  setAnchor(el: HTMLElement | null, fill = 0.8): void {
    this.anchor = el ? { el, fill } : null;
    this.lastAnchor = '';
    this.invalidate();
  }

  /** Next frame jumps straight to the target instead of easing (reduced motion, scene jumps). */
  snapNext(): void {
    this.snap = true;
    this.invalidate();
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.canvas.classList.toggle('is-hidden', !v);
    if (v) this.invalidate();
  }

  isVisible(): boolean {
    return this.visible;
  }

  // ---------- Loop ----------

  invalidate(): void {
    if (this.running || this.disposed || !this.visible || document.hidden) return;
    this.running = true;
    this.lastT = performance.now();
    this.renderer.setAnimationLoop(this.tick);
  }

  private stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private tick = (now: number) => {
    const dtMs = Math.min(100, now - this.lastT);
    this.lastT = now;
    const dt = dtMs / 1000;
    this.clock += dt;

    if (this.anchor) this.readAnchor();
    let moving: boolean;
    if (this.snap) {
      Object.assign(this.current, this.target);
      this.spin = this.spinTarget;
      this.snap = false;
      moving = false;
    } else {
      moving = damp(this.current, this.target, dt, 10);
    }
    const ds = this.spinTarget - this.spin;
    if (Math.abs(ds) > 0.05) {
      this.spin += ds * (1 - Math.exp(-dt * 10));
      moving = true;
    } else this.spin = this.spinTarget;
    const p = this.pointer;
    p.x += (p.tx - p.x) * (1 - Math.exp(-dt * 4));
    p.y += (p.ty - p.y) * (1 - Math.exp(-dt * 4));
    const idle = this.current.idle > 0.01 && !this.reducedMotion;
    if (idle && (Math.abs(p.tx - p.x) > 0.001 || Math.abs(p.ty - p.y) > 0.001)) moving = true;

    this.applyState(this.clock);
    this.uploadTextures();
    this.renderer.render(this.scene, this.camera);

    if (this.firstFrame) {
      const cb = this.firstFrame;
      this.firstFrame = null;
      cb();
    }

    if (this.monitor.push(dtMs, now)) this.stepDown();
    if (!moving && !idle && this.busy === 0 && !this.anchor) this.stop();
  };

  /**
   * Uploads changed label surfaces as ImageData from their CPU-backed canvases: handing
   * WebGL the canvas element itself makes Chrome read pixels back from the GPU and log
   * a stall warning on every re-upload.
   */
  private uploadTextures(): void {
    if (!this.dirtyTextures.size) return;
    this.dirtyTextures.forEach((n) => {
      const t = this.textures.get(n);
      if (t) {
        t.image = this.surfaceImage(n);
        t.needsUpdate = true;
      }
    });
    this.dirtyTextures.clear();
  }

  private surfaceImage(name: SurfaceName): ImageData {
    const s = name === 'sleeve' ? this.surfaces.sleeve : this.surfaces.get(name);
    return s.ctx.getImageData(0, 0, s.width, s.height);
  }

  private stepDown(): void {
    if (this.tier === 'low') return;
    this.tier = lower(this.tier);
    const next = TIERS[this.tier];
    this.settings.dpr = next.dpr;
    this.settings.transmission = next.transmission;
    this.settings.particles = next.particles;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, next.dpr));
    this.resize();
    this.lineup?.setTransmission(next.transmission);
  }

  private readAnchor(): void {
    if (!this.anchor) return;
    const r = this.anchor.el.getBoundingClientRect();
    const key = `${r.left | 0},${r.top | 0},${r.width | 0},${r.height | 0},${innerWidth},${innerHeight}`;
    if (key === this.lastAnchor) return;
    this.lastAnchor = key;
    const fill = this.anchor.fill;
    const vals = {
      fx: (r.left + r.width / 2) / innerWidth,
      fy: (r.top + r.height / 2) / innerHeight,
      fh: (r.height / innerHeight) * fill,
      fw: (r.width / innerWidth) * fill,
    };
    Object.assign(this.target, vals);
    Object.assign(this.current, vals);
  }

  // ---------- Applying state ----------

  private applyState(time: number): void {
    const s = this.current;
    const cam = this.camera;

    // Camera: orbit distance from the frame, then a lens shift to place the target.
    const pYaw = s.idle * this.pointer.x * 0.05;
    const pPitch = s.idle * this.pointer.y * 0.03;
    const yaw = s.yaw + pYaw;
    const pitch = s.pitch + pPitch;
    const fh = Math.max(0.05, s.fh);
    let d = s.ref / (2 * TAN_HALF * fh);
    if (s.refW > 0) {
      const fw = Math.max(0.05, s.fw);
      d = Math.max(d, s.refW / (2 * TAN_HALF * cam.aspect * fw));
    }
    cam.position.set(
      s.tx + d * Math.sin(yaw) * Math.cos(pitch),
      s.ty + d * Math.sin(pitch),
      s.tz + d * Math.cos(yaw) * Math.cos(pitch),
    );
    cam.lookAt(s.tx, s.ty, s.tz);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    cam.projectionMatrix.elements[8] = -(2 * s.fx - 1);
    cam.projectionMatrix.elements[9] = -(1 - 2 * s.fy);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    // Can.
    const g = this.can.group;
    const rise = s.rise * s.rise * 3.2;
    g.position.set(s.canX + s.ship * s.ship * 5, s.canY + rise, 0);
    const idle = this.reducedMotion ? 0 : s.idle * Math.sin(time * 0.5) * IDLE_AMPLITUDE;
    this.can.spinner.rotation.y = s.canRot + idle + s.spinWeight * ((this.spin * Math.PI) / 180);
    this.can.setUnwrap(s.unwrap);
    const proof = s.proof > 0.5;
    this.can.setLabelTexture(this.texture(proof ? 'proof' : 'sleeve'));
    if (s.annotate > 0.002) {
      this.can.overlay.visible = true;
      this.can.setOverlayTexture(this.texture('annotations'));
      this.surfaces.setAnnotation(s.annotate);
    } else {
      this.can.overlay.visible = false;
    }
    this.can.setReveal(s.solid, s.wire, s.label);
    this.can.setRingPull(s.ringPull);
    this.fizz?.update(s.fizz, { x: 0, y: CAN.height, z: 0.12 });

    // Shadows follow the can and fade as it lifts off.
    const lift = Math.max(0, 1 - rise * 1.6) * (1 - s.ship);
    for (const m of [this.shadow, this.shadowCore]) {
      m.position.x = g.position.x + this.shadowOffset;
      (m.material as { opacity: number }).opacity = 0.9 * lift * (0.35 + 0.65 * s.solid);
    }

    this.lineup?.update(s, time);
    this.rig.position.x = s.tx;

    // Sweep: paper, tinted a touch toward the label, washed fully at launch.
    const tinted = mixHex('#F1F2EE', this.brand, s.tint * 0.06);
    const washed = mixHex(tinted, this.brand, Math.min(1, s.wash));
    this.sweepColour.set(washed);
    this.sweep.material.color.copy(this.sweepColour);
    if (s.wash <= 0.001 && s.tint <= 0.001) this.sweep.material.color.copy(PAPER);
  }

  // ---------- Snapshot ----------

  /**
   * Renders the can alone at a fixed pose and reads it back without stalling the GPU:
   * readPixels into a pixel buffer, a fence, then an async copy. (A synchronous
   * drawImage of the WebGL canvas stalls and makes Chrome log a performance warning.)
   */
  async renderStill(width: number, height: number): Promise<HTMLCanvasElement> {
    const r = this.renderer;
    const gl = r.getContext() as WebGL2RenderingContext;
    const prevRatio = r.getPixelRatio();
    const prevAspect = this.camera.aspect;
    const saved = { ...this.current };
    const lineupVisible = this.lineup?.group.visible ?? false;
    let pending: Promise<Uint8Array>;
    try {
      Object.assign(this.current, {
        tx: 0,
        ty: 0.62,
        tz: 0,
        yaw: 0.34,
        pitch: 0.1,
        ref: CAN.height,
        refW: 0,
        fx: 0.5,
        fy: 0.52,
        fh: 0.6,
        canX: 0,
        canY: 0,
        idle: 0,
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
        spinWeight: 1,
      });
      if (this.lineup) this.lineup.group.visible = false;
      r.setPixelRatio(1);
      r.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.uploadTextures();
      this.applyState(0);
      r.render(this.scene, this.camera);
      pending = readPixelsAsync(gl, width, height);
    } finally {
      Object.assign(this.current, saved);
      if (this.lineup) this.lineup.group.visible = lineupVisible;
      r.setPixelRatio(prevRatio);
      this.camera.aspect = prevAspect;
      this.resize();
      this.applyState(this.clock);
      r.render(this.scene, this.camera);
    }
    const pixels = await pending;
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d')!;
    const img = ctx.createImageData(width, height);
    const row = width * 4;
    // WebGL rows run bottom to top.
    for (let y = 0; y < height; y++) {
      img.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  // ---------- Housekeeping ----------

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.invalidate();
  };

  private onResize = () => {
    this.resize();
    this.invalidate();
  };

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onResize);
    this.can.dispose();
    this.lineup?.dispose();
    this.fizz?.dispose();
    this.textures.forEach((t) => t.dispose());
    this.surfaces.dispose();
    this.sweep.geometry.dispose();
    this.sweep.material.dispose();
    [this.shadow, this.shadowCore].forEach((m) => {
      m.geometry.dispose();
      (m.material as { dispose(): void }).dispose();
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
