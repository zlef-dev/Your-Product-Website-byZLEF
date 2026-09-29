import { site } from './config.ts';
import { scenes } from './content.ts';

export interface SceneDef {
  /** Element id of the scene, also its hash link. */
  id: string;
  name: string;
  /** Patch colour on the printer's colour bar. */
  ink: string;
}

/** Printer's colour bar: process inks, then overprints and a black tint. */
const INKS = ['#00AEEF', '#EC008C', '#FFF200', '#231F20', '#2E3192', '#ED1C24', '#00A651', '#7B7979'];

const defs: Array<{ id: string; name: string; when?: boolean }> = [
  { id: 'top', name: scenes.hero },
  { id: 'try', name: scenes.tryIt },
  { id: 'lineup', name: scenes.lineup },
  { id: 'process', name: scenes.process },
  { id: 'build', name: scenes.build },
  { id: 'work', name: scenes.work, when: site.work.length > 0 },
  { id: 'brief', name: scenes.brief },
  { id: 'contact', name: scenes.footer },
];

/** Only the scenes that render (S6 drops out when there is no work to show). */
export const sceneList: SceneDef[] = defs
  .filter((d) => d.when !== false)
  .map((d, i) => ({ id: d.id, name: d.name, ink: INKS[i] ?? '#231F20' }));
