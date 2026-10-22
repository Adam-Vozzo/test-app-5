// Pure two-bone IK. Works on any {x,y,z} (THREE.Vector3 fits structurally).

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export interface TwoBoneResult {
  /** True if the target was within reach (not clamped). */
  reached: boolean;
  /** Distance root → end after clamping. */
  distance: number;
}

const EPS = 1e-6;

/**
 * Solve a two-bone chain rooted at `root` reaching for `target`, bending toward `pole`.
 * Writes the middle joint (knee/elbow) into `outJoint` and the reached end point into `outEnd`.
 */
export function solveTwoBone(
  root: V3,
  target: V3,
  pole: V3,
  len1: number,
  len2: number,
  outJoint: V3,
  outEnd: V3,
): TwoBoneResult {
  let dx = target.x - root.x;
  let dy = target.y - root.y;
  let dz = target.z - root.z;
  const rawD = Math.hypot(dx, dy, dz);
  if (rawD < EPS) {
    dx = 0;
    dy = -1;
    dz = 0;
  } else {
    dx /= rawD;
    dy /= rawD;
    dz /= rawD;
  }
  const minD = Math.abs(len1 - len2) + 1e-4;
  const maxD = len1 + len2 - 1e-4;
  const d = Math.min(Math.max(rawD, minD), maxD);

  // Bend direction: component of (pole - root) perpendicular to the chain axis.
  let px = pole.x - root.x;
  let py = pole.y - root.y;
  let pz = pole.z - root.z;
  const pd = px * dx + py * dy + pz * dz;
  px -= dx * pd;
  py -= dy * pd;
  pz -= dz * pd;
  let pl = Math.hypot(px, py, pz);
  if (pl < EPS) {
    // Pole is collinear with the chain: pick any perpendicular.
    if (Math.abs(dy) < 0.9) {
      px = -dz;
      py = 0;
      pz = dx;
    } else {
      px = 0;
      py = dz;
      pz = -dy;
    }
    pl = Math.hypot(px, py, pz);
  }
  px /= pl;
  py /= pl;
  pz /= pl;

  const cosA = Math.min(1, Math.max(-1, (len1 * len1 + d * d - len2 * len2) / (2 * len1 * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  const along = len1 * cosA;
  const out = len1 * sinA;
  outJoint.x = root.x + dx * along + px * out;
  outJoint.y = root.y + dy * along + py * out;
  outJoint.z = root.z + dz * along + pz * out;
  outEnd.x = root.x + dx * d;
  outEnd.y = root.y + dy * d;
  outEnd.z = root.z + dz * d;
  return { reached: rawD >= minD && rawD <= maxD, distance: d };
}
