// Small math helpers shared by gameplay, animation and FX. No Three imports.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp(invLerp(a, b, v), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Frame-rate independent exponential approach. `rate` ~ 1/seconds-to-63%. */
export const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export const dampAngle = (a: number, b: number, rate: number, dt: number) =>
  a + angleDelta(a, b) * (1 - Math.exp(-rate * dt));

/**
 * Damped spring toward a target (default 0). `stiffness` is k, `damping` is c.
 * Sub-stepped semi-implicit Euler so high stiffness stays stable at low frame rates.
 */
export class Spring {
  x = 0;
  v = 0;
  target = 0;
  constructor(public stiffness = 200, public damping = 20) {}
  impulse(dv: number) {
    this.v += dv;
  }
  step(dt: number) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.stiffness * (this.x - this.target) - this.damping * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }
  reset(x = 0) {
    this.x = x;
    this.v = 0;
  }
}

/** Three-axis spring (for positional or euler-angle offsets). */
export class Spring3 {
  x = new Spring();
  y = new Spring();
  z = new Spring();
  constructor(stiffness = 200, damping = 20) {
    this.set(stiffness, damping);
  }
  set(stiffness: number, damping: number) {
    for (const s of [this.x, this.y, this.z]) {
      s.stiffness = stiffness;
      s.damping = damping;
    }
  }
  impulse(x: number, y: number, z: number) {
    this.x.impulse(x);
    this.y.impulse(y);
    this.z.impulse(z);
  }
  step(dt: number) {
    this.x.step(dt);
    this.y.step(dt);
    this.z.step(dt);
  }
  reset() {
    this.x.reset();
    this.y.reset();
    this.z.reset();
  }
}

/** Cheap smooth 1D value noise in [-1, 1], used for camera shake. */
export function noise1(t: number, seed = 0): number {
  const i = Math.floor(t);
  const f = t - i;
  const h = (n: number) => {
    let x = Math.imul((n + seed * 7919) | 0, 0x27d4eb2d);
    x ^= x >>> 15;
    x = Math.imul(x, 0x165667b1);
    x ^= x >>> 13;
    return ((x >>> 0) / 4294967295) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}
