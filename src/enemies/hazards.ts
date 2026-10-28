// Enemy attack visuals that make danger readable: spitter globs with a ground marker that fills as impact
// approaches, and the brute's charge lane. All in telegraph magenta (STYLE.md signal colour).
import * as THREE from 'three';
import { G, groups } from '../physics/world';
import { DEVIL, MOON, MOON_FOES, SIGNAL } from '../render/palette';
import type { EnemyWorld } from './enemy';

interface Knife {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  t: number;
  damage: number;
  knockback: number;
  mesh: THREE.Mesh;
}

/**
 * What a marked zone does when its time is up: strike whoever stands in it (a verdict, a coin rain), bind them (the
 * Devil's shackles), or — a seed — sprout something unless it was trampled first (stepping in crushes it).
 */
export type ZoneKind = 'strike' | 'shackle' | 'seed';

export interface ZoneOpts {
  kind?: ZoneKind;
  /** How long a shackle holds (s). */
  bindTime?: number;
  /** Called when the zone resolves: `caught` is whether the player was in it (for a seed: crushed). */
  onDone?: (caught: boolean, at: THREE.Vector3) => void;
}

interface Verdict {
  at: THREE.Vector3;
  radius: number;
  t: number;
  delay: number;
  damage: number;
  knockback: number;
  g: THREE.Group;
  kind: ZoneKind;
  bindTime: number;
  onDone?: ZoneOpts['onDone'];
}

const knifeGeo = new THREE.OctahedronGeometry(0.1, 0).scale(0.7, 0.7, 3.2);
const _seg = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _p = new THREE.Vector3();
const SOLID = groups(G.QUERY, G.WORLD);

interface Glob {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;
  t: number;
  T: number;
  gravity: number;
  radius: number;
  damage: number;
  knockback: number;
  /** Sets the timber alight where it lands (a Firebrand's pot). */
  ignite: number;
  marker: THREE.Group;
  mesh: THREE.Mesh;
}

export interface GlobImpact {
  at: THREE.Vector3;
  radius: number;
  damage: number;
  knockback: number;
  ignite: number;
}

/**
 * A tidal wave (the King of Cups): a wall of water rolling down the room, the full width but for one gap. It hurts
 * whoever it meets outside the gap, once; a roll's i-frames carry you through it.
 */
interface Wave {
  origin: THREE.Vector3;
  fx: number;
  fz: number;
  width: number;
  gapAt: number;
  gapWidth: number;
  speed: number;
  dist: number;
  s: number;
  damage: number;
  knockback: number;
  done: boolean;
  g: THREE.Group;
}

/** The Knight of Cups' cup, set down to be drunk: moonlight heals, the dark draught poisons. */
interface Cup {
  at: THREE.Vector3;
  good: boolean;
  amount: number;
  t: number;
  life: number;
  g: THREE.Group;
}

const ringGeo = new THREE.RingGeometry(0.88, 1, 32).rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const globGeo = new THREE.IcosahedronGeometry(0.2, 1);
const waveGeo = new THREE.BoxGeometry(1, 1.5, 0.7).translate(0, 0.75, 0);
const crestGeo = new THREE.BoxGeometry(1, 0.14, 0.8).translate(0, 1.55, -0.05);
const cupFootGeo = new THREE.CylinderGeometry(0.06, 0.16, 0.06, 7).translate(0, 0.03, 0);
const cupStemGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.24, 6).translate(0, 0.18, 0);
const cupBowlGeo = new THREE.CylinderGeometry(0.22, 0.07, 0.16, 8, 1, true).translate(0, 0.36, 0);
const draughtGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.03, 10);
const beamGeo = new THREE.CylinderGeometry(0.12, 0.2, 2.6, 8, 1, true);
/** A shot's line: unit length along +Z (Object3D.lookAt turns +Z toward the target), thin. */
const tracerGeo = new THREE.BoxGeometry(0.06, 0.06, 1).translate(0, 0, 0.5);
/** A low cylinder wall around a landing strike (unit radius, 0.6 m tall, open). */
const burstWallGeo = new THREE.CylinderGeometry(1, 1, 0.6, 32, 1, true).translate(0, 0.3, 0);
const laneGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.5);

/** A marked ground strike landing: a flash that snaps outward and fades (so a strike you dodged still reads). */
interface Burst {
  g: THREE.Group;
  t: number;
  r: number;
  mats: THREE.MeshBasicMaterial[];
}
const BURST_T = 0.45;

export class Hazards {
  private globs: Glob[] = [];
  private pool: { marker: THREE.Group; mesh: THREE.Mesh }[] = [];
  private ringMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  private discMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, opacity: 0.35, depthWrite: false, fog: false });
  private globMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, fog: false });
  private lanes = new Map<object, THREE.Group>();
  private laneMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, opacity: 0.32, depthWrite: false, fog: false, side: THREE.DoubleSide });
  private laneFillMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, opacity: 0.55, depthWrite: false, fog: false, side: THREE.DoubleSide });
  private time = 0;
  private rings = new Map<object, THREE.Group>();
  readonly knives: Knife[] = [];
  readonly verdicts: Verdict[] = [];
  private verdictPool: THREE.Group[] = [];
  private seedPool: THREE.Group[] = [];
  private seedRingMat = new THREE.MeshBasicMaterial({ color: DEVIL.accent, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
  private seedDiscMat = new THREE.MeshBasicMaterial({ color: DEVIL.accent, transparent: true, opacity: 0.4, depthWrite: false, fog: false });
  private knifePool: THREE.Mesh[] = [];
  private bursts: Burst[] = [];
  private tracers: { mesh: THREE.Mesh; t: number }[] = [];
  private tracerPool: { mesh: THREE.Mesh; t: number }[] = [];
  private burstPool: Burst[] = [];
  readonly waves: Wave[] = [];
  private wavePool: THREE.Group[] = [];
  private waveMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, opacity: 0.45, depthWrite: false, fog: false, side: THREE.DoubleSide });
  private crestMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, fog: false });
  readonly cups: Cup[] = [];
  private cupPool: { good: THREE.Group[]; bad: THREE.Group[] } = { good: [], bad: [] };
  private knifeMat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, fog: false });

  constructor(private scene: THREE.Scene) {}

  /** Show / update a slam's ground ring at `at`, its fill growing with the wind-up (0..1). */
  ring(owner: object, at: THREE.Vector3, radius: number, fill: number) {
    let g = this.rings.get(owner);
    if (!g) {
      g = new THREE.Group();
      const ring = new THREE.Mesh(ringGeo, this.ringMat);
      const disc = new THREE.Mesh(discGeo, this.discMat);
      disc.name = 'fill';
      g.add(ring, disc);
      g.renderOrder = 5;
      this.scene.add(g);
      this.rings.set(owner, g);
    }
    g.visible = true;
    g.position.copy(at).setY(at.y + 0.12);
    g.scale.setScalar(radius);
    g.children[1].scale.setScalar(Math.max(0.02, fill));
  }

  hideRing(owner: object) {
    const g = this.rings.get(owner);
    if (g) g.visible = false;
  }

  /** A verdict: a marked zone that fills over `delay` seconds, then strikes whoever stands in it (see ZoneKind). */
  verdict(at: THREE.Vector3, radius: number, delay: number, damage: number, knockback: number, opts: ZoneOpts = {}) {
    const kind = opts.kind ?? 'strike';
    const pool = kind === 'seed' ? this.seedPool : this.verdictPool;
    let g = pool.pop();
    if (!g) {
      g = new THREE.Group();
      // Seeds are coin, not danger: gilt, the hoards' motif (trample them). Everything else is telegraph magenta.
      const ring = new THREE.Mesh(ringGeo, kind === 'seed' ? this.seedRingMat : this.ringMat);
      const disc = new THREE.Mesh(discGeo, kind === 'seed' ? this.seedDiscMat : this.discMat);
      g.add(ring, disc);
      g.renderOrder = 5;
      this.scene.add(g);
    }
    g.visible = true;
    g.position.copy(at).setY(at.y + 0.12);
    g.scale.setScalar(radius);
    this.verdicts.push({ at: at.clone(), radius, t: 0, delay, damage, knockback, g, kind, bindTime: opts.bindTime ?? 1.5, onDone: opts.onDone });
  }

  /** Fill verdict zones and strike the ones whose time is up. */
  updateVerdicts(dt: number, w: EnemyWorld) {
    for (let i = this.verdicts.length - 1; i >= 0; i--) {
      const v = this.verdicts[i];
      v.t += dt;
      const k = Math.min(1, v.t / v.delay);
      v.g.children[1].scale.setScalar(Math.max(0.02, k));
      v.g.children[0].scale.setScalar(1 + 0.04 * Math.sin(v.t * (8 + 20 * k)));
      const p = w.playerPos;
      const inside = Math.hypot(p.x - v.at.x, p.z - v.at.z) <= v.radius && Math.abs(p.y - v.at.y) < 1.6;
      if (v.kind === 'seed') {
        // Trampled before it ripens: crushed, nothing grows.
        if (inside && w.playerAlive) {
          w.sound('coinJingle', v.at);
          v.onDone?.(true, v.at);
          this.retire(i);
          continue;
        }
        if (v.t < v.delay) continue;
        v.onDone?.(false, v.at);
        this.retire(i);
        continue;
      }
      if (v.t < v.delay) continue;
      this.burst(v.at, v.radius);
      if (v.kind === 'shackle') {
        w.sound('chainSnap', v.at);
        if (inside) w.bindPlayer?.(v.bindTime, v.damage, v.knockback, v.at, null);
      } else {
        w.sound('slamImpact', v.at);
        w.shake(0.45, v.at);
        if (inside) w.hurtPlayer(v.damage, v.at, v.knockback);
      }
      v.onDone?.(inside, v.at);
      this.retire(i);
    }
  }

  private retire(i: number) {
    const v = this.verdicts[i];
    v.g.visible = false;
    (v.kind === 'seed' ? this.seedPool : this.verdictPool).push(v.g);
    this.verdicts.splice(i, 1);
  }

  /** A thrown blade: flies straight, stops at walls, hurts on contact. `size` scales it (a rifle's heavy bolt). */
  knife(from: THREE.Vector3, vel: THREE.Vector3, damage: number, knockback: number, size = 1) {
    const mesh = this.knifePool.pop() ?? this.makeKnife();
    mesh.visible = true;
    mesh.scale.setScalar(size);
    mesh.position.copy(from);
    this.knives.push({ pos: from.clone(), vel: vel.clone(), t: 0, damage, knockback, mesh });
  }

  private makeKnife() {
    const m = new THREE.Mesh(knifeGeo, this.knifeMat);
    m.renderOrder = 5;
    this.scene.add(m);
    return m;
  }

  /** Move thrown blades; walls stop them, the player's body takes them (unless rolling: hurtPlayer decides). */
  updateKnives(dt: number, w: EnemyWorld) {
    for (let i = this.knives.length - 1; i >= 0; i--) {
      const k = this.knives[i];
      k.t += dt;
      const step = _seg.copy(k.vel).multiplyScalar(dt);
      const len = step.length();
      const hit = len > 0 ? w.physics.raycast(k.pos, _dir.copy(step).divideScalar(len), len, SOLID) : null;
      // Closest approach to the player's body (a vertical segment through the chest).
      _p.copy(w.playerChest);
      const t = Math.max(0, Math.min(1, _p.clone().sub(k.pos).dot(step) / Math.max(1e-6, len * len)));
      const near = k.pos.clone().addScaledVector(step, t);
      const dy = Math.max(0, Math.abs(near.y - _p.y) - 0.5);
      const struck = Math.hypot(near.x - _p.x, near.z - _p.z, dy) < 0.42 && (!hit || hit.distance >= len * t);
      if (struck) w.hurtPlayer(k.damage, near, k.knockback, 'projectile');
      k.pos.add(step);
      k.mesh.position.copy(k.pos);
      k.mesh.lookAt(_p.copy(k.pos).add(k.vel));
      if (struck || hit || k.t > 3) {
        if (hit && !struck) w.sound('armor', k.pos);
        k.mesh.visible = false;
        this.knifePool.push(k.mesh);
        this.knives.splice(i, 1);
      }
    }
  }

  /** Lob a glob that lands on `target` after `T` seconds. */
  lob(from: THREE.Vector3, target: THREE.Vector3, T: number, gravity: number, radius: number, damage: number, knockback: number, ignite = 0) {
    const slot = this.pool.pop() ?? this.makeSlot();
    // Ballistic: v = (Δ - ½gT²)/T
    const vel = new THREE.Vector3().subVectors(target, from).divideScalar(T);
    vel.y += 0.5 * gravity * T;
    slot.marker.position.copy(target).setY(target.y + 0.12);
    slot.marker.scale.setScalar(radius);
    slot.marker.visible = true;
    slot.mesh.visible = true;
    slot.mesh.position.copy(from);
    this.globs.push({ pos: from.clone(), vel, target: target.clone(), t: 0, T, gravity, radius, damage, knockback, ignite, ...slot });
  }

  private makeSlot() {
    const marker = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, this.ringMat);
    const disc = new THREE.Mesh(discGeo, this.discMat);
    disc.name = 'fill';
    marker.add(ring, disc);
    marker.renderOrder = 5;
    const mesh = new THREE.Mesh(globGeo, this.globMat);
    this.scene.add(marker, mesh);
    return { marker, mesh };
  }

  /** Show / update a charge lane from `from` along `dir` for `length`, filled to `fill` (0..1). */
  lane(owner: object, from: THREE.Vector3, yaw: number, length: number, width: number, fill: number) {
    let g = this.lanes.get(owner);
    if (!g) {
      g = new THREE.Group();
      const back = new THREE.Mesh(laneGeo, this.laneMat);
      const front = new THREE.Mesh(laneGeo, this.laneFillMat);
      front.name = 'fill';
      g.add(back, front);
      g.renderOrder = 5;
      this.scene.add(g);
      this.lanes.set(owner, g);
    }
    g.visible = true;
    // Above paving (flagstones sit a few cm proud of the slab).
    g.position.copy(from).setY(from.y + 0.12);
    g.rotation.set(0, yaw, 0);
    const back = g.children[0];
    const front = g.children[1];
    back.scale.set(width, 1, length);
    front.scale.set(width * 0.9, 1, Math.max(0.001, length * fill));
  }

  hideLane(owner: object) {
    const g = this.lanes.get(owner);
    if (g) g.visible = false;
  }

  /**
   * Send a wave from `origin` along `yaw`, `width` across, with a gap `gapWidth` wide centred `gapAt` metres right
   * of its middle; it rolls `dist` metres at `speed`.
   */
  wave(origin: THREE.Vector3, yaw: number, width: number, gapAt: number, gapWidth: number, speed: number, dist: number, damage: number, knockback: number) {
    let g = this.wavePool.pop();
    if (!g) {
      g = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const body = new THREE.Mesh(waveGeo, this.waveMat);
        const crest = new THREE.Mesh(crestGeo, this.crestMat);
        const side = new THREE.Group();
        side.add(body, crest);
        g.add(side);
      }
      g.renderOrder = 5;
      this.scene.add(g);
    }
    g.visible = true;
    g.rotation.set(0, yaw, 0);
    // Two walls, one each side of the gap.
    const half = width / 2;
    const segs: [number, number][] = [
      [-half, gapAt - gapWidth / 2],
      [gapAt + gapWidth / 2, half],
    ];
    segs.forEach(([a, b], i) => {
      const side = g!.children[i];
      const len = Math.max(0, b - a);
      side.visible = len > 0.05;
      side.position.set((a + b) / 2, 0, 0);
      side.scale.set(Math.max(0.01, len), 1, 1);
    });
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    this.waves.push({ origin: origin.clone(), fx, fz, width, gapAt, gapWidth, speed, dist, s: 0, damage, knockback, done: false, g });
    g.position.copy(origin);
  }

  /** Roll the waves on; each strikes the player once if she's in its path outside the gap. */
  updateWaves(dt: number, w: EnemyWorld) {
    const p = w.playerPos;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const v = this.waves[i];
      const was = v.s;
      v.s += v.speed * dt;
      v.g.position.set(v.origin.x + v.fx * v.s, v.origin.y, v.origin.z + v.fz * v.s);
      // A swell that rises, then breaks at the end of its run.
      const k = v.s / v.dist;
      v.g.scale.set(1, Math.min(1, k * 6) * (1 - Math.max(0, k - 0.85) / 0.15), 1);
      if (!v.done && w.playerAlive) {
        const rx = p.x - v.origin.x;
        const rz = p.z - v.origin.z;
        const along = rx * v.fx + rz * v.fz;
        // Right of the heading (yaw 0 = -Z, so right is +X).
        const lat = rx * -v.fz + rz * v.fx;
        const crossed = along >= was - 0.5 && along <= v.s + 0.5;
        const inside = Math.abs(lat) <= v.width / 2 && Math.abs(lat - v.gapAt) > v.gapWidth / 2;
        if (crossed && inside && Math.abs(p.y - v.origin.y) < 2) {
          v.done = true;
          // (a reflection's wave washes over her)
          if (v.damage > 0) w.hurtPlayer(v.damage, _p.set(p.x - v.fx, p.y, p.z - v.fz), v.knockback);
        }
      }
      if (v.s >= v.dist) {
        v.g.visible = false;
        this.wavePool.push(v.g);
        this.waves.splice(i, 1);
      }
    }
  }

  /** Set down a cup at `at` for `life` seconds: walk over it to drink. */
  cup(at: THREE.Vector3, good: boolean, amount: number, life: number) {
    const pool = good ? this.cupPool.good : this.cupPool.bad;
    let g = pool.pop();
    if (!g) {
      g = new THREE.Group();
      const metal = new THREE.MeshBasicMaterial({ color: MOON_FOES.cup, side: THREE.DoubleSide });
      const body = new THREE.Group();
      body.add(new THREE.Mesh(cupFootGeo, metal), new THREE.Mesh(cupStemGeo, metal), new THREE.Mesh(cupBowlGeo, metal));
      const draught = new THREE.Mesh(draughtGeo, new THREE.MeshBasicMaterial({ color: good ? MOON.accent : MOON_FOES.shadow, fog: false }));
      draught.position.y = 0.43;
      g.add(body, draught);
      g.scale.setScalar(1.6);
      if (good) {
        // The tell: the true cup is full of moonlight, and it shines.
        const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: MOON.accent, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        beam.position.y = 1.4;
        g.add(beam);
      }
      this.scene.add(g);
    }
    g.visible = true;
    g.position.copy(at);
    this.cups.push({ at: at.clone(), good, amount, t: life, life, g });
  }

  /** Cups wait to be drunk, then spill away. */
  updateCups(dt: number, w: EnemyWorld) {
    for (let i = this.cups.length - 1; i >= 0; i--) {
      const c = this.cups[i];
      c.t -= dt;
      c.g.rotation.y += dt * 0.6;
      const p = w.playerPos;
      // (it can't be drunk the moment it's set down: she has to choose to)
      const drunk = c.t < c.life - 0.5 && w.playerAlive && Math.hypot(p.x - c.at.x, p.z - c.at.z) < 0.9 && Math.abs(p.y - c.at.y) < 1.4;
      if (drunk) {
        if (c.good) {
          w.healPlayer?.(c.amount);
          w.sound('drink', c.at);
        } else {
          w.hurtPlayer(c.amount, c.at, 0);
          w.sound('poison', c.at);
        }
      }
      if (drunk || c.t <= 0) this.retireCup(i);
    }
  }

  private retireCup(i: number) {
    const c = this.cups[i];
    c.g.visible = false;
    (c.good ? this.cupPool.good : this.cupPool.bad).push(c.g);
    this.cups.splice(i, 1);
  }

  /** A strike lands at `at` across `radius`: the mark flashes and snaps outward as it fades. */
  burst(at: THREE.Vector3, radius: number) {
    let b = this.burstPool.pop();
    if (!b) {
      const g = new THREE.Group();
      const ringM = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, depthWrite: false, fog: false });
      const discM = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
      const wallM = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      g.add(new THREE.Mesh(ringGeo, ringM), new THREE.Mesh(discGeo, discM), new THREE.Mesh(burstWallGeo, wallM));
      g.renderOrder = 6;
      this.scene.add(g);
      b = { g, t: 0, r: 1, mats: [ringM, discM, wallM] };
    }
    b.t = 0;
    b.r = radius;
    b.g.visible = true;
    b.g.position.copy(at).setY(at.y + 0.14);
    this.bursts.push(b);
    this.stepBurst(b, 0);
  }

  private stepBurst(b: Burst, dt: number) {
    b.t += dt;
    const k = Math.min(1, b.t / BURST_T);
    const out = 1 - (1 - k) * (1 - k);
    b.g.scale.set(b.r * (1 + 0.35 * out), 1 + 2 * (1 - k), b.r * (1 + 0.35 * out));
    b.mats[0].opacity = 1 - k;
    b.mats[1].opacity = 0.6 * (1 - k) * (1 - k);
    b.mats[2].opacity = 0.5 * (1 - k);
  }

  /** A shot's line flashing along `length` from `from` (a heavy bolt fired down its lane): it fades in a moment. */
  tracer(from: THREE.Vector3, dir: THREE.Vector3, length: number) {
    let t = this.tracerPool.pop();
    if (!t) {
      const mat = new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
      t = { mesh: new THREE.Mesh(tracerGeo, mat), t: 0 };
      t.mesh.renderOrder = 6;
      this.scene.add(t.mesh);
    }
    t.t = 0;
    t.mesh.visible = true;
    t.mesh.position.copy(from);
    t.mesh.lookAt(_p.copy(from).add(dir));
    t.mesh.scale.set(1, 1, length);
    this.tracers.push(t);
  }

  /** Advance globs; returns the impacts that landed this frame. */
  update(dt: number): GlobImpact[] {
    this.time += dt;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.t += dt;
      const k = Math.min(1, t.t / 0.3);
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
      t.mesh.scale.x = t.mesh.scale.y = 1 + k * 2;
      if (k >= 1) {
        t.mesh.visible = false;
        this.tracerPool.push(t);
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      this.stepBurst(b, dt);
      if (b.t >= BURST_T) {
        b.g.visible = false;
        this.burstPool.push(b);
        this.bursts.splice(i, 1);
      }
    }
    const out: GlobImpact[] = [];
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 18);
    for (let i = this.globs.length - 1; i >= 0; i--) {
      const g = this.globs[i];
      g.t += dt;
      g.vel.y -= g.gravity * dt;
      g.pos.addScaledVector(g.vel, dt);
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += dt * 9;
      const k = Math.min(1, g.t / g.T);
      const fill = g.marker.getObjectByName('fill')!;
      fill.scale.setScalar(Math.max(0.02, k));
      (g.marker.children[0] as THREE.Mesh).scale.setScalar(pulse * 0.08 + 0.95);
      if (g.t >= g.T) {
        out.push({ at: g.target, radius: g.radius, damage: g.damage, knockback: g.knockback, ignite: g.ignite });
        g.marker.visible = false;
        g.mesh.visible = false;
        this.pool.push({ marker: g.marker, mesh: g.mesh });
        this.globs.splice(i, 1);
      }
    }
    return out;
  }

  clear() {
    for (const g of this.globs) {
      g.marker.visible = false;
      g.mesh.visible = false;
      this.pool.push({ marker: g.marker, mesh: g.mesh });
    }
    this.globs.length = 0;
    for (const lane of this.lanes.values()) lane.visible = false;
    for (const r of this.rings.values()) r.visible = false;
    for (const t of this.tracers) {
      t.mesh.visible = false;
      this.tracerPool.push(t);
    }
    this.tracers.length = 0;
    for (const b of this.bursts) {
      b.g.visible = false;
      this.burstPool.push(b);
    }
    this.bursts.length = 0;
    for (const v of this.verdicts) {
      v.g.visible = false;
      (v.kind === 'seed' ? this.seedPool : this.verdictPool).push(v.g);
    }
    this.verdicts.length = 0;
    for (const k of this.knives) {
      k.mesh.visible = false;
      this.knifePool.push(k.mesh);
    }
    this.knives.length = 0;
    for (const v of this.waves) {
      v.g.visible = false;
      this.wavePool.push(v.g);
    }
    this.waves.length = 0;
    while (this.cups.length) this.retireCup(this.cups.length - 1);
  }
}
