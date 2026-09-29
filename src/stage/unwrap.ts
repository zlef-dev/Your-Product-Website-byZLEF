/**
 * Signature moment 2, the unwrap: the label peels off the can from its back seam and
 * flattens into a dieline facing the camera.
 *
 * A vertex at angle θ (−π…π, 0 facing the camera, ±π at the back seam) and height y sits
 * on the cylinder at (r·sinθ, y, r·cosθ) and on the flat dieline at (r·θ, y, r). The peel
 * front φ sweeps from the seam (π) to the front (0): vertices with |θ| ≤ φ stay wrapped,
 * the rest leave along the tangent at ±φ. That gives each vertex its own progress,
 * delayed by |θ|, keeps arc length (the label never stretches) and never cuts through
 * the can.
 */

export function peelPoint(theta: number, r: number, phi: number): [number, number] {
  const a = Math.abs(theta);
  const s = theta < 0 ? -1 : 1;
  if (a <= phi) return [r * Math.sin(theta), r * Math.cos(theta)];
  const px = s * r * Math.sin(phi);
  const pz = r * Math.cos(phi);
  const t = r * (a - phi);
  return [px + s * Math.cos(phi) * t, pz - Math.sin(phi) * t];
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Peel front angle for unwrap progress 0–1. */
export const peelFront = (progress: number) => Math.PI * (1 - smooth(Math.min(1, Math.max(0, progress))));

/**
 * Rewrites a sleeve's positions for unwrap progress `p`. `thetas` holds each vertex's θ
 * and `ys` its height, captured once from the original cylinder. `lift` floats the flat
 * dieline forward so it clears the can.
 */
export function applyUnwrap(
  positions: Float32Array,
  thetas: Float32Array,
  ys: Float32Array,
  r: number,
  p: number,
  lift: number,
): void {
  const phi = peelFront(p);
  const zOff = lift * smooth(Math.min(1, Math.max(0, p)));
  for (let i = 0; i < thetas.length; i++) {
    const [x, z] = peelPoint(thetas[i] ?? 0, r, phi);
    positions[i * 3] = x;
    positions[i * 3 + 1] = ys[i] ?? 0;
    positions[i * 3 + 2] = z + zOff;
  }
}
