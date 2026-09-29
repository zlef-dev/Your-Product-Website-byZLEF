/**
 * The site's one text reveal: scene titles rise out of line masks (SplitText lines,
 * autoSplit, the tween created and returned inside onSplit). Headings only.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { $$ } from '../lib/dom';

gsap.registerPlugin(SplitText, ScrollTrigger);

export function initSplit(): () => void {
  const splits = $$('[data-split]').map((el) =>
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 100,
          duration: 0.9,
          stagger: 0.08,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      },
    }),
  );
  return () => splits.forEach((s) => s.revert());
}
