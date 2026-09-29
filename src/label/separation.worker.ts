/**
 * Splits artwork into C, M, Y and K plates off the main thread. The source buffer is
 * transferred in; the four plate buffers are transferred back.
 */
import { allocatePlates, separate } from './cmyk';

interface Job {
  id: number;
  buffer: ArrayBuffer;
}

/** The slice of DedicatedWorkerGlobalScope this worker uses (the DOM lib types `self` as Window). */
interface WorkerScope {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (e: MessageEvent<Job>) => {
  const { id, buffer } = e.data;
  const src = new Uint8ClampedArray(buffer);
  const plates = separate(src, allocatePlates(src.length));
  const out = [plates.c.buffer, plates.m.buffer, plates.y.buffer, plates.k.buffer] as ArrayBuffer[];
  scope.postMessage({ id, c: out[0], m: out[1], y: out[2], k: out[3] }, out);
};
