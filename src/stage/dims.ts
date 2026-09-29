/**
 * Product dimensions. 1 unit = 100 mm. Shared by the 3D stage and the label renderer
 * so every label texture maps 1:1 onto its geometry. No three.js import here.
 */

export const CAN = {
  /** 66 mm wide. */
  radius: 0.33,
  /** 122 mm tall. */
  height: 1.22,
  /** The straight wall the label covers. */
  wallBottom: 0.112,
  wallTop: 1.102,
} as const;

/** The label sleeve sits 0.2% outside the wall. */
export const SLEEVE_RADIUS = CAN.radius * 1.002;
export const SLEEVE_HEIGHT = CAN.wallTop - CAN.wallBottom;
/** Circumference ÷ wall height ≈ 2.1. */
export const SLEEVE_ASPECT = (2 * Math.PI * SLEEVE_RADIUS) / SLEEVE_HEIGHT;
/** Real-world sizes printed on the proof, in millimetres. */
export const SLEEVE_MM = {
  width: Math.round(2 * Math.PI * SLEEVE_RADIUS * 100),
  height: Math.round(SLEEVE_HEIGHT * 100),
};

export const BOTTLE = {
  radius: 0.37,
  height: 2.42,
  labelBottom: 0.36,
  labelHeight: 0.78,
  /** How far round the bottle the band label wraps, in radians. */
  labelArc: 3.2,
} as const;

export const JAR = {
  radius: 0.34,
  bodyHeight: 0.36,
  lidHeight: 0.15,
  labelBottom: 0.07,
  labelHeight: 0.22,
  labelArc: 2.4,
} as const;

export const BOX = {
  width: 1.3,
  height: 1.3,
  depth: 0.5,
} as const;

/** Band label aspect (arc length ÷ height) for each product. */
export const BOTTLE_BAND_ASPECT = (BOTTLE.labelArc * BOTTLE.radius * 1.003) / BOTTLE.labelHeight;
export const JAR_BAND_ASPECT = (JAR.labelArc * JAR.radius * 1.004) / JAR.labelHeight;
