/**
 * Prints artwork onto the sleeve. Instant for now; the four-plate print run arrives
 * in the next milestone.
 */
import type { LabelArt } from './draw';
import type { LabelSurfaces } from './surfaces';

export interface PrintTarget {
  surfaces: LabelSurfaces;
  /** 0 = bare aluminium label stock, 1 = fully inked. */
  setInk(v: number): void;
  /** Keeps the render loop running while an animation draws into the surface. */
  hold(on: boolean): void;
}

export class Printer {
  private run = 0;

  constructor(private readonly target: PrintTarget) {}

  async print(art: LabelArt, _opts: { instant?: boolean } = {}): Promise<void> {
    const id = ++this.run;
    await this.target.surfaces.setArt(art);
    if (id !== this.run) return;
    this.target.surfaces.drawSleeve('final');
    this.target.setInk(1);
  }
}
