// Pooled, instanced combat FX: muzzle flash, tracers, impact puffs/sparks, decals, ejected casings.
import * as THREE from 'three';
import { makeRng } from '../core/rng';
import { prep, toonMat } from '../render/geo';
import type { Renderer } from '../render/renderer';
import type { Physics } from '../physics/world';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();
const _z = new THREE.Vector3(0, 0, 1);

/** FX use their own RNG stream so effects never perturb gameplay randomness. */
const rng = makeRng(0xf00d);

function flashTexture(): THREE.Texture {
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,240,200,0.95)');
  grad.addColorStop(0.6, 'rgba(255,190,90,0.35)');
  grad.addColorStop(1, 'rgba(255,160,60,0)');
  g.fillStyle = grad;
  g.beginPath();
  // Five-point burst.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? s / 2 : s / 5;
    g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Tracer {
  start: THREE.Vector3;
  dir: THREE.Vector3;
  dist: number;
  travelled: number;
  speed: number;
  len: number;
  width: number;
  color: number;
}
interface Particle {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  color: number;
  grav: number;
}
interface Decal {
  p: THREE.Vector3;
  n: THREE.Vector3;
  life: number;
  size: number;
  rot: number;
}
interface Casing {
  p: THREE.Vector3;
  v: THREE.Vector3;
  q: THREE.Quaternion;
  spinAxis: THREE.Vector3;
  spin: number;
  floor: number;
  life: number;
  color: number;
}

const DECAL_LIFE = 6;

export class Fx {
  private flash: THREE.Sprite;
  private flashFrames = 0;
  private tracerMesh: THREE.InstancedMesh;
  private tracers: Tracer[] = [];
  private dustMesh: THREE.InstancedMesh;
  private sparkMesh: THREE.InstancedMesh;
  private dust: Particle[] = [];
  private sparks: Particle[] = [];
  private decalMesh: THREE.InstancedMesh;
  private decals: Decal[] = [];
  private decalHead = 0;
  private casingMesh: THREE.InstancedMesh;
  private casings: Casing[] = [];

  constructor(
    private r: Renderer,
    private physics: Physics,
  ) {
    const scene = r.scene;
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }),
    );
    this.flash.visible = false;
    this.flash.renderOrder = 10;
    scene.add(this.flash);

    const additive = (opts: THREE.MeshBasicMaterialParameters = {}) =>
      new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, ...opts });
    this.tracerMesh = this.inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -0.5), additive(), 128, false);
    this.dustMesh = this.inst(prep(new THREE.IcosahedronGeometry(1, 0), true), toonMat(), 512, false);
    this.sparkMesh = this.inst(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ fog: false }), 256, false);
    const decalMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.decalMesh = this.inst(new THREE.CircleGeometry(1, 7), decalMat, 128, false);
    this.casingMesh = this.inst(prep(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6).rotateX(Math.PI / 2)), toonMat(), 96, true);
  }

  private inst(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, shadow: boolean) {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = shadow;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, _c.set(1, 1, 1));
    this.r.scene.add(m);
    return m;
  }

  muzzleFlash(pos: THREE.Vector3, scale: number, frames: number, light: number, color: number) {
    this.flash.position.copy(pos);
    const s = scale * rng.range(0.8, 1.25);
    this.flash.scale.set(s, s, s);
    this.flash.material.rotation = rng.range(0, Math.PI * 2);
    this.flash.material.color.setHex(color);
    this.flash.visible = true;
    this.flashFrames = Math.max(1, Math.round(frames));
    this.r.muzzleLight.color.setHex(color);
    this.r.muzzleLight.position.copy(pos);
    this.r.muzzleLight.intensity = light;
  }

  tracer(start: THREE.Vector3, end: THREE.Vector3, color: number, speed: number, len: number, width: number) {
    if (this.tracers.length >= 128) this.tracers.shift();
    const dir = end.clone().sub(start);
    const dist = dir.length();
    if (dist < 0.05) return;
    dir.divideScalar(dist);
    this.tracers.push({ start: start.clone(), dir, dist, travelled: 0, speed, len, width, color });
  }

  /** Dust burst off a surface along its normal. */
  impact(p: THREE.Vector3, n: THREE.Vector3, color: number, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      if (this.dust.length >= 512) this.dust.shift();
      const v = new THREE.Vector3(rng.signed(), rng.signed(), rng.signed()).multiplyScalar(0.6).add(n).normalize();
      v.multiplyScalar(speed * rng.range(0.4, 1.1));
      const max = rng.range(0.25, 0.5);
      this.dust.push({ p: p.clone().addScaledVector(n, 0.03), v, life: max, max, size: rng.range(0.03, 0.07), color, grav: 9 });
    }
  }

  /** Bright unlit sparks (enemy hits; gold for crits). */
  sparksAt(p: THREE.Vector3, dir: THREE.Vector3, color: number, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= 256) this.sparks.shift();
      const v = new THREE.Vector3(rng.signed(), rng.signed(), rng.signed()).add(_v.copy(dir).multiplyScalar(-0.8)).normalize();
      v.multiplyScalar(speed * rng.range(0.5, 1.2));
      const max = rng.range(0.12, 0.25);
      this.sparks.push({ p: p.clone(), v, life: max, max, size: rng.range(0.025, 0.05), color, grav: 4 });
    }
  }

  decal(p: THREE.Vector3, n: THREE.Vector3, size: number, color: number) {
    const d: Decal = { p: p.clone().addScaledVector(n, 0.01), n: n.clone(), life: DECAL_LIFE, size: size * rng.range(0.8, 1.2), rot: rng.range(0, 6.28) };
    if (this.decals.length < 128) this.decals.push(d);
    else this.decals[this.decalHead++ % 128] = d;
    this.decalMesh.setColorAt(this.decals.indexOf(d), _c.setHex(color));
  }

  casing(p: THREE.Vector3, v: THREE.Vector3, color: number) {
    if (this.casings.length >= 96) this.casings.shift();
    const floor = this.physics.groundY(p.x, p.z, p.y + 0.1, 5)?.y ?? p.y - 1;
    this.casings.push({
      p: p.clone(),
      v: v.clone(),
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(0, 6), rng.range(0, 6), 0)),
      spinAxis: new THREE.Vector3(rng.signed(), rng.signed(), rng.signed()).normalize(),
      spin: rng.range(15, 30),
      floor: floor + 0.018,
      life: 2.5,
      color,
    });
  }

  /** `dt` is sim time; flash frames count rendered frames. */
  update(dt: number) {
    // Muzzle flash lasts N rendered frames regardless of time (stays visible during hitstop).
    if (this.flashFrames > 0) {
      this.flashFrames--;
    } else {
      this.flash.visible = false;
      this.r.muzzleLight.intensity = 0;
    }

    // Tracers
    let n = 0;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.travelled += t.speed * dt;
      if (t.travelled - t.len > t.dist) {
        this.tracers.splice(i, 1);
        continue;
      }
      const head = Math.min(t.travelled, t.dist);
      const tail = Math.max(0, t.travelled - t.len);
      const len = head - tail;
      if (len <= 0) continue;
      _v.copy(t.start).addScaledVector(t.dir, tail);
      _q.setFromUnitVectors(_z, _s.copy(t.dir).negate());
      _m.compose(_v, _q, _s.set(t.width, t.width, len));
      this.tracerMesh.setMatrixAt(n, _m);
      this.tracerMesh.setColorAt(n, _c.setHex(t.color));
      n++;
    }
    this.commit(this.tracerMesh, n);

    this.stepParticles(this.dust, this.dustMesh, dt, 3);
    this.stepParticles(this.sparks, this.sparkMesh, dt, 1);

    // Decals shrink away over their last second.
    n = 0;
    for (let i = 0; i < this.decals.length; i++) {
      const d = this.decals[i];
      d.life -= dt;
      const k = Math.min(1, Math.max(0, d.life));
      _q.setFromUnitVectors(_z, d.n);
      _q.multiply(new THREE.Quaternion().setFromAxisAngle(_z, d.rot));
      _m.compose(d.p, _q, _s.setScalar(d.size * k));
      this.decalMesh.setMatrixAt(i, _m);
      n = i + 1;
    }
    this.commit(this.decalMesh, n);

    // Casings: gravity, bounce, roll to rest.
    n = 0;
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.casings.splice(i, 1);
        continue;
      }
      c.v.y -= 22 * dt;
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < c.floor) {
        c.p.y = c.floor;
        if (Math.abs(c.v.y) > 0.6) {
          c.v.y = -c.v.y * 0.35;
          c.v.x *= 0.6;
          c.v.z *= 0.6;
          c.spin *= 0.6;
        } else {
          c.v.set(c.v.x * 0.9, 0, c.v.z * 0.9);
          c.spin *= 0.9;
        }
      }
      c.q.multiply(_q.setFromAxisAngle(c.spinAxis, c.spin * dt));
      const s = Math.min(1, c.life * 3);
      _m.compose(c.p, c.q, _s.setScalar(s));
      this.casingMesh.setMatrixAt(n, _m);
      this.casingMesh.setColorAt(n, _c.setHex(c.color));
      n++;
    }
    this.commit(this.casingMesh, n);
  }

  private stepParticles(list: Particle[], mesh: THREE.InstancedMesh, dt: number, drag: number) {
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.v.y -= p.grav * dt;
      p.v.multiplyScalar(Math.exp(-drag * dt));
      p.p.addScaledVector(p.v, dt);
      const k = p.life / p.max;
      _m.compose(p.p, _q.identity(), _s.setScalar(p.size * (0.4 + k * 0.8)));
      mesh.setMatrixAt(n, _m);
      mesh.setColorAt(n, _c.setHex(p.color));
      n++;
    }
    this.commit(mesh, n);
  }

  private commit(mesh: THREE.InstancedMesh, n: number) {
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    this.tracers.length = 0;
    this.dust.length = 0;
    this.sparks.length = 0;
    this.decals.length = 0;
    this.casings.length = 0;
  }
}
