// Verlet ribbon: a pinned chain of points for cloth tails (the blindfold's two ends). Pure, no Three.
// Fixed substeps keep it stable at any frame rate; distance constraints keep its length.

export interface RibbonParams {
  /** Downward acceleration (m/s²). */
  gravity: number;
  /** Velocity lost per substep, 0..1. */
  drag: number;
  /** Pull of each segment toward the rest direction (1/s). 0 = hangs like rope. */
  stiffness: number;
}

const SUBSTEP = 1 / 120;
const MAX_SUBSTEPS = 8;
const ITERATIONS = 4;

export class Ribbon {
  /** Point positions, xyz interleaved. Point 0 is pinned to the anchor. */
  readonly pos: Float64Array;
  private prev: Float64Array;
  private acc = 0;

  constructor(
    readonly count: number,
    readonly segLen: number,
  ) {
    this.pos = new Float64Array(count * 3);
    this.prev = new Float64Array(count * 3);
  }

  get length() {
    return this.segLen * (this.count - 1);
  }

  /** Lay the ribbon straight out from `anchor` along `dir` (unit), at rest. */
  reset(anchor: ArrayLike<number>, dir: ArrayLike<number>) {
    for (let i = 0; i < this.count; i++) {
      for (let k = 0; k < 3; k++) {
        const v = anchor[k] + dir[k] * this.segLen * i;
        this.pos[i * 3 + k] = v;
        this.prev[i * 3 + k] = v;
      }
    }
    this.acc = 0;
  }

  /**
   * Advance by `dt` with point 0 pinned at `anchor`. `restDir` (unit) is where the ribbon trails when nothing
   * moves; stiffness bends it back toward that shape.
   */
  step(dt: number, anchor: ArrayLike<number>, restDir: ArrayLike<number>, p: RibbonParams) {
    if (!(dt > 0) || !Number.isFinite(dt)) {
      this.pin(anchor);
      return;
    }
    this.acc = Math.min(this.acc + dt, SUBSTEP * MAX_SUBSTEPS);
    while (this.acc >= SUBSTEP) {
      this.acc -= SUBSTEP;
      this.substep(SUBSTEP, anchor, restDir, p);
    }
    this.pin(anchor);
    if (!this.finite()) this.reset(anchor, restDir);
  }

  private pin(anchor: ArrayLike<number>) {
    for (let k = 0; k < 3; k++) {
      this.pos[k] = anchor[k];
      this.prev[k] = anchor[k];
    }
  }

  private substep(h: number, anchor: ArrayLike<number>, restDir: ArrayLike<number>, p: RibbonParams) {
    const x = this.pos;
    const o = this.prev;
    const keep = 1 - Math.min(1, Math.max(0, p.drag));
    for (let i = 1; i < this.count; i++) {
      const j = i * 3;
      for (let k = 0; k < 3; k++) {
        const v = (x[j + k] - o[j + k]) * keep;
        o[j + k] = x[j + k];
        x[j + k] += v;
      }
      x[j + 1] -= p.gravity * h * h;
    }
    this.pin(anchor);
    // Bend toward the rest shape: each point eases toward its parent + restDir · segLen.
    const s = Math.min(1, Math.max(0, p.stiffness) * h);
    if (s > 0) {
      for (let i = 1; i < this.count; i++) {
        const j = i * 3;
        for (let k = 0; k < 3; k++) {
          const want = x[j - 3 + k] + restDir[k] * this.segLen;
          x[j + k] += (want - x[j + k]) * s;
        }
      }
    }
    for (let it = 0; it < ITERATIONS; it++) {
      for (let i = 1; i < this.count; i++) {
        const a = (i - 1) * 3;
        const b = i * 3;
        const dx = x[b] - x[a];
        const dy = x[b + 1] - x[a + 1];
        const dz = x[b + 2] - x[a + 2];
        const d = Math.hypot(dx, dy, dz);
        if (d < 1e-9) continue;
        const diff = (d - this.segLen) / d;
        // The parent end only moves if it isn't the pinned point.
        const wa = i === 1 ? 0 : 0.5;
        const wb = 1 - wa;
        x[a] += dx * diff * wa;
        x[a + 1] += dy * diff * wa;
        x[a + 2] += dz * diff * wa;
        x[b] -= dx * diff * wb;
        x[b + 1] -= dy * diff * wb;
        x[b + 2] -= dz * diff * wb;
      }
    }
  }

  private finite() {
    for (let i = 0; i < this.pos.length; i++) if (!Number.isFinite(this.pos[i])) return false;
    return true;
  }
}
