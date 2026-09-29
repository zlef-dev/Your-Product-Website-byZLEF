/**
 * CMYK separation, in a Web Worker when possible (the ImageData buffer is transferred,
 * not copied), falling back to the main thread when Workers are unavailable or fail.
 */
import { allocatePlates, separate, type Plates } from './cmyk';

interface Pending {
  resolve: (p: Plates) => void;
  /** Kept so the main thread can finish the job if the worker dies. */
  copy: Uint8ClampedArray;
  timer: ReturnType<typeof setTimeout>;
}

type Reply = { id: number; c: ArrayBuffer; m: ArrayBuffer; y: ArrayBuffer; k: ArrayBuffer };

let worker: Worker | null | undefined;
let nextId = 0;
const pending = new Map<number, Pending>();

const onMainThread = (pixels: Uint8ClampedArray) => separate(pixels, allocatePlates(pixels.length));

function finishOnMainThread(id: number): void {
  const job = pending.get(id);
  if (!job) return;
  pending.delete(id);
  clearTimeout(job.timer);
  job.resolve(onMainThread(job.copy));
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === 'undefined') throw new Error('no workers');
    worker = new Worker(new URL('./separation.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<Reply>) => {
      const { id, c, m, y, k } = e.data;
      const job = pending.get(id);
      if (!job) return;
      pending.delete(id);
      clearTimeout(job.timer);
      job.resolve({
        c: new Uint8ClampedArray(c),
        m: new Uint8ClampedArray(m),
        y: new Uint8ClampedArray(y),
        k: new Uint8ClampedArray(k),
      });
    };
    worker.onerror = (e) => {
      e.preventDefault();
      worker?.terminate();
      worker = null;
      [...pending.keys()].forEach(finishOnMainThread);
    };
  } catch {
    worker = null;
  }
  return worker;
}

/** Separates RGBA pixels into four plates. */
export function separatePlates(pixels: Uint8ClampedArray): Promise<Plates> {
  const w = getWorker();
  if (!w) return Promise.resolve(onMainThread(pixels));
  const id = ++nextId;
  return new Promise<Plates>((resolve) => {
    const copy = new Uint8ClampedArray(pixels);
    const timer = setTimeout(() => finishOnMainThread(id), 4000);
    pending.set(id, { resolve, copy, timer });
    w.postMessage({ id, buffer: pixels.buffer }, [pixels.buffer]);
  });
}
