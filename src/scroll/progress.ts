/**
 * The progress strip: a printer's colour bar whose patches fill as each scene scrolls by,
 * with "Scene n of N: name" beside it. Fills use gsap.quickSetter (transform only).
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { chrome } from '../content';
import { $, $$ } from '../lib/dom';
import { sceneList } from '../scenes';

export function initProgress(): () => void {
  const label = $('[data-progress-label]');
  const links = $$<HTMLAnchorElement>('[data-scene-link]');
  const total = sceneList.length;
  let active = -1;

  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    const scene = sceneList[i];
    if (label && scene) label.textContent = chrome.sceneLabel(i + 1, total, scene.name);
    links.forEach((a, j) => {
      if (j === i) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };

  const triggers = sceneList.map((scene, i) => {
    const el = document.getElementById(scene.id);
    const fill = $(`[data-fill="${scene.id}"]`);
    if (!el || !fill) return null;
    const setFill = gsap.quickSetter(fill, 'scaleX');
    // Pinned scenes live inside a pin spacer that carries their full scroll length.
    const spacer = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el;
    return ScrollTrigger.create({
      trigger: spacer,
      start: i === 0 ? 'top top' : 'top 60%',
      end: i === total - 1 ? 'bottom bottom' : 'bottom 60%',
      onUpdate: (self) => setFill(self.progress),
      onRefresh: (self) => {
        setFill(self.progress);
        // Created (or re-measured) while already inside this scene, e.g. after a reload or a
        // deep link: onToggle won't fire, so pick the scene up here.
        if (self.isActive) setActive(i);
      },
      onToggle: (self) => {
        if (self.isActive) setActive(i);
      },
    });
  });

  const current = triggers.findIndex((t) => t?.isActive);
  setActive(current >= 0 ? current : 0);
  return () => triggers.forEach((t) => t?.kill());
}
