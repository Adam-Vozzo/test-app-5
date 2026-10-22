// Procedural weapon meshes. Local frame: muzzle toward -Z, up +Y, origin at the right-hand grip.
import * as THREE from 'three';
import { merge, meshOf, paint, place, prep, stripe, toonMat } from '../render/geo';
import { PROPS } from '../render/palette';

export interface WeaponModel {
  root: THREE.Group;
  /** Detachable magazine (for reload choreography). */
  mag: THREE.Mesh;
  /** Local anchor points. */
  grip: THREE.Vector3;
  fore: THREE.Vector3;
  muzzle: THREE.Vector3;
  eject: THREE.Vector3;
  magSeat: THREE.Vector3;
  lever: THREE.Vector3;
  /** Loaded-round visual (hidden while empty). */
  loaded: THREE.Mesh | null;
}

const mat = () => toonMat();

export function buildRepeater(): WeaponModel {
  const root = new THREE.Group();
  const body = stripe(new THREE.BoxGeometry(0.07, 0.055, 0.6, 1, 1, 10), PROPS.wood, PROPS.woodDark, 0.12, { axis: 'z' });
  const barrel = paint(new THREE.BoxGeometry(0.045, 0.035, 0.5), PROPS.woodDark);
  const grip = paint(new THREE.BoxGeometry(0.055, 0.17, 0.075), PROPS.cork);
  const spring = paint(new THREE.TorusGeometry(0.03, 0.009, 4, 8), PROPS.metal);
  const fore = paint(new THREE.BoxGeometry(0.05, 0.05, 0.09), PROPS.cork);
  const peg = paint(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 5), PROPS.metal);
  const geo = merge([
    place(body, 0, 0, -0.1),
    place(barrel, 0, 0.045, -0.15),
    place(grip, 0, -0.08, 0.03, 0.28, 0, 0),
    place(spring, 0.036, -0.02, -0.02, 0, Math.PI / 2, 0),
    place(fore, 0, -0.045, -0.3),
    place(peg, 0.05, 0.03, 0.14, 0, 0, Math.PI / 2),
  ]);
  root.add(meshOf(geo, mat()));

  // Spool of rubber bands: the magazine.
  const spoolGeo = merge([
    stripe(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 10, 4).rotateZ(Math.PI / 2), PROPS.rubberBand, 0xb8445f, 0.015, { axis: 'x' }),
    paint(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 6).rotateZ(Math.PI / 2), PROPS.woodDark),
  ]);
  const mag = meshOf(spoolGeo, mat());
  const magSeat = new THREE.Vector3(0, 0.1, -0.06);
  mag.position.copy(magSeat);
  root.add(mag);

  // The loaded band stretched along the barrel.
  const loaded = meshOf(prep(paint(new THREE.BoxGeometry(0.05, 0.012, 0.42), PROPS.rubberBand)), mat(), false);
  loaded.position.set(0, 0.068, -0.19);
  root.add(loaded);

  return {
    root,
    mag,
    grip: new THREE.Vector3(0, -0.02, 0.02),
    fore: new THREE.Vector3(0, -0.06, -0.3),
    muzzle: new THREE.Vector3(0, 0.05, -0.43),
    eject: new THREE.Vector3(0.05, 0.05, -0.02),
    magSeat,
    lever: new THREE.Vector3(0.09, 0.03, 0.14),
    loaded,
  };
}
