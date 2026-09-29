# QA

## Critique log

### M1 static baseline (no motion, no 3D), 1440×900 and 390×844

What works:
- The white-label idea reads from type alone: extended Archivo H1 low-left, empty right half waiting for the product, crop marks at the hero corners.
- The wdth axis renders: the H1 is visibly extended (wdth 116) and small print is condensed (wdth 72), confirmed in `qa/screenshots/1440x900-s1-hero.png`.
- The takeover works without 3D: choosing Lagoon and printing "Kopi Kalye" recolours the header button, rewrites the brief heading to "Let's build Kopi Kalye's website." and fills the footer's dieline box with the brand colour.
- Colour stays restrained: process black on paper, with the brand colour only on buttons, chips and the footer label.

To fix next:
- The try-it "Drag to spin" hint sits too close to the header; move it down to the product.
- On phones the header holds the wordmark, the colour bar and the CTA; it fits at 390 px but is tight. Revisit at 360 px.
- The custom colour swatch and the native picker read as two controls; tie them together visually.
