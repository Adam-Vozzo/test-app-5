// Every thin limb segment and joint knob in the game is drawn by two instanced meshes (two draw calls total).
import * as THREE from 'three';
import { prep, toonMat } from './geo';

const _up = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();

export class LimbRenderer {
  readonly segments: THREE.InstancedMesh;
  readonly knobs: THREE.InstancedMesh;
  private nSeg = 0;
  private nKnob = 0;

  /** `shadows` false: limbs that cast no shadow (the Moon's reflections). */
  constructor(scene: THREE.Scene, max = 1024, shadows = true) {
    const cyl = prep(new THREE.CylinderGeometry(1, 1, 1, 6, 1, false).translate(0, 0.5, 0));
    const sph = prep(new THREE.IcosahedronGeometry(1, 1));
    const mat = toonMat();
    this.segments = new THREE.InstancedMesh(cyl, mat, max);
    this.knobs = new THREE.InstancedMesh(sph, mat, max);
    for (const m of [this.segments, this.knobs]) {
      m.castShadow = shadows;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, _c.set(1, 1, 1));
      m.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      scene.add(m);
    }
  }

  begin() {
    this.nSeg = 0;
    this.nKnob = 0;
  }

  seg(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number) {
    if (this.nSeg >= this.segments.instanceMatrix.count) return;
    _d.subVectors(b, a);
    const len = _d.length();
    if (len < 1e-5) return;
    _q.setFromUnitVectors(_up, _d.multiplyScalar(1 / len));
    _m.compose(a, _q, _s.set(radius, len, radius));
    this.segments.setMatrixAt(this.nSeg, _m);
    this.segments.setColorAt(this.nSeg, _c.setHex(color));
    this.nSeg++;
  }

  knob(p: THREE.Vector3, radius: number, color: number, sx = 1, sy = 1, sz = 1, q?: THREE.Quaternion) {
    if (this.nKnob >= this.knobs.instanceMatrix.count) return;
    _m.compose(p, q ?? _q.identity(), _s.set(radius * sx, radius * sy, radius * sz));
    this.knobs.setMatrixAt(this.nKnob, _m);
    this.knobs.setColorAt(this.nKnob, _c.setHex(color));
    this.nKnob++;
  }

  end() {
    this.segments.count = this.nSeg;
    this.knobs.count = this.nKnob;
    this.segments.instanceMatrix.needsUpdate = true;
    this.knobs.instanceMatrix.needsUpdate = true;
    if (this.segments.instanceColor) this.segments.instanceColor.needsUpdate = true;
    if (this.knobs.instanceColor) this.knobs.instanceColor.needsUpdate = true;
  }
}
