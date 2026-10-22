// Collider/hitbox wireframes straight from Rapier's debug renderer.
import * as THREE from 'three';
import type { Physics } from '../physics/world';

export class ColliderDebug {
  private lines: THREE.LineSegments;
  private geo = new THREE.BufferGeometry();

  constructor(scene: THREE.Scene) {
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.8 });
    this.lines = new THREE.LineSegments(this.geo, mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 999;
    this.lines.visible = false;
    scene.add(this.lines);
  }

  update(physics: Physics, visible: boolean) {
    this.lines.visible = visible;
    if (!visible) return;
    const { vertices, colors } = physics.world.debugRender();
    this.geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    this.geo.computeBoundingSphere();
  }
}
