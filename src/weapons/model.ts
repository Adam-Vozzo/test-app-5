// Procedural weapon meshes. Local frame: muzzle toward -Z, up +Y, origin at the right-hand grip.
import * as THREE from 'three';
import { merge, meshOf, paint, paintBy, place, prep, stripe, toonMat } from '../render/geo';
import { GEAR, PROPS } from '../render/palette';

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
  /** True if the "mag" is a round carried in the hand during reload (hidden at rest). */
  magHiddenAtRest: boolean;
  /** Where single rounds are pushed in (single-shell reload). */
  loadPort: THREE.Vector3;
  /** Sliding pump (moves along +Z by pumpTravel during the cycle). */
  pump: THREE.Object3D | null;
  pumpTravel: number;
  /** Hinged top arm (stapler): rotates about X. Rest = cocked angle. */
  hammer: THREE.Object3D | null;
  hammerCocked: number;
  /** Hammer-local point the off hand grabs to cock it. */
  hammerGrip: THREE.Vector3;
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
    magHiddenAtRest: false,
    loadPort: new THREE.Vector3(0, 0.1, -0.06),
    pump: null,
    pumpTravel: 0,
    hammer: null,
    hammerCocked: 0,
    hammerGrip: new THREE.Vector3(),
  };
}

/** Seed-spitter: striped party-straw barrel, paper funnel muzzle, squeeze-bulb stock, sliding cork pump. */
export function buildSpitter(): WeaponModel {
  const root = new THREE.Group();
  const a = new THREE.Color(PROPS.strawA);
  const b = new THREE.Color(PROPS.strawB);
  // Barrel along -Z with a spiral stripe.
  const barrel = paintBy(new THREE.CylinderGeometry(0.034, 0.034, 0.62, 12, 24).rotateX(Math.PI / 2), (v, out) => {
    const ang = Math.atan2(v.y, v.x) / (Math.PI * 2);
    out.copy(Math.floor(v.z * 11 + ang * 2 + 10) % 2 === 0 ? a : b);
  });
  const funnel = paint(new THREE.CylinderGeometry(0.065, 0.036, 0.09, 12, 1, true).rotateX(-Math.PI / 2), PROPS.paper);
  const bulb = stripe(new THREE.SphereGeometry(0.085, 12, 10).scale(1, 1, 1.35).rotateX(Math.PI / 2), PROPS.bulb, PROPS.bulbDark, 0.03, {
    axis: 'z',
  });
  const neck = paint(new THREE.CylinderGeometry(0.03, 0.045, 0.06, 10).rotateX(Math.PI / 2), PROPS.bulbDark);
  const grip = paint(new THREE.BoxGeometry(0.05, 0.16, 0.07), PROPS.cork);
  const geo = merge([
    place(barrel, 0, 0.03, -0.2),
    place(funnel, 0, 0.03, -0.555),
    place(bulb, 0, 0.03, 0.21),
    place(neck, 0, 0.03, 0.115),
    place(grip, 0, -0.07, 0.03, 0.3, 0, 0),
  ]);
  root.add(meshOf(geo, mat()));

  const pump = new THREE.Group();
  pump.add(
    meshOf(
      merge([
        stripe(new THREE.CylinderGeometry(0.052, 0.052, 0.11, 12, 3).rotateX(Math.PI / 2), PROPS.cork, PROPS.corkDark, 0.03, { axis: 'z' }),
        place(paint(new THREE.BoxGeometry(0.04, 0.05, 0.08), PROPS.corkDark), 0, -0.05, 0),
      ]),
      mat(),
    ),
  );
  pump.position.set(0, 0.03, -0.3);
  root.add(pump);

  // A seed carried in the hand during reload.
  const mag = meshOf(paint(new THREE.SphereGeometry(0.03, 8, 6).scale(0.8, 0.6, 1.2), PROPS.seed), mat(), false);
  mag.visible = false;
  root.add(mag);

  return {
    root,
    mag,
    grip: new THREE.Vector3(0, -0.02, 0.02),
    fore: new THREE.Vector3(0, -0.04, -0.3),
    muzzle: new THREE.Vector3(0, 0.03, -0.6),
    eject: new THREE.Vector3(0.05, 0.05, -0.1),
    magSeat: new THREE.Vector3(0.045, 0.03, -0.08),
    lever: new THREE.Vector3(0, -0.04, -0.3),
    loaded: null,
    magHiddenAtRest: true,
    loadPort: new THREE.Vector3(0.045, 0.03, -0.08),
    pump,
    pumpTravel: 0.11,
    hammer: null,
    hammerCocked: 0,
    hammerGrip: new THREE.Vector3(),
  };
}

/** Staple driver: a desk stapler. The hinged top arm snaps down on each shot and the off hand re-cocks it. */
export function buildStapler(): WeaponModel {
  const root = new THREE.Group();
  const base = paint(new THREE.BoxGeometry(0.085, 0.035, 0.46), PROPS.staplerBody);
  const plate = paint(new THREE.BoxGeometry(0.07, 0.012, 0.12), PROPS.metal);
  const nose = paint(new THREE.BoxGeometry(0.06, 0.03, 0.04), PROPS.metalDark);
  const grip = paint(new THREE.BoxGeometry(0.055, 0.17, 0.075), PROPS.staplerBody);
  const hinge = paint(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 8).rotateZ(Math.PI / 2), PROPS.metal);
  root.add(
    meshOf(
      merge([
        place(base, 0, -0.01, -0.17),
        place(plate, 0, 0.012, -0.34),
        place(nose, 0, 0.01, -0.395),
        place(grip, 0, -0.1, 0.02, 0.28, 0, 0),
        place(hinge, 0, 0.03, 0.04),
      ]),
      mat(),
    ),
  );

  // Hinged top arm: pivot at the back, extends to -Z.
  const hammer = new THREE.Group();
  hammer.position.set(0, 0.03, 0.04);
  const arm = stripe(new THREE.BoxGeometry(0.075, 0.05, 0.45, 1, 1, 6).translate(0, 0.03, -0.215), PROPS.staplerArm, 0x456d95, 0.09, {
    axis: 'z',
  });
  const channel = paint(new THREE.BoxGeometry(0.05, 0.012, 0.36).translate(0, 0.002, -0.22), PROPS.metal);
  const cap = paint(new THREE.BoxGeometry(0.08, 0.02, 0.06).translate(0, 0.06, -0.41), PROPS.staplerBody);
  hammer.add(meshOf(merge([arm, channel, cap]), mat()));
  root.add(hammer);
  const cocked = 0.14;
  hammer.rotation.x = cocked;

  // Staple strip (the magazine) sits in the arm's channel.
  const mag = meshOf(stripe(new THREE.BoxGeometry(0.03, 0.016, 0.28, 1, 1, 14), PROPS.metal, PROPS.metalDark, 0.02, { axis: 'z' }), mat(), false);
  const magSeat = new THREE.Vector3(0, 0.035, -0.17);
  mag.position.copy(magSeat);
  root.add(mag);

  return {
    root,
    mag,
    grip: new THREE.Vector3(0, -0.03, 0.02),
    fore: new THREE.Vector3(0, -0.04, -0.27),
    muzzle: new THREE.Vector3(0, 0.0, -0.43),
    eject: new THREE.Vector3(0.05, 0.03, -0.1),
    magSeat,
    lever: new THREE.Vector3(0, 0.1, -0.36),
    loaded: null,
    magHiddenAtRest: false,
    loadPort: magSeat.clone(),
    pump: null,
    pumpTravel: 0,
    hammer,
    hammerCocked: cocked,
    hammerGrip: new THREE.Vector3(0, 0.07, -0.38),
  };
}

/** A single staple projectile: crown + two prongs, travelling along -Z. */
export function stapleGeo(): THREE.BufferGeometry {
  const crown = paint(new THREE.BoxGeometry(0.11, 0.018, 0.018), PROPS.metal);
  const prong = paint(new THREE.BoxGeometry(0.016, 0.016, 0.07), PROPS.metal);
  return merge([crown, place(prong, -0.047, 0, 0.035), place(prong.clone(), 0.047, 0, 0.035)]);
}

/** Auto-pistol, in metres: a chunky faceted sidearm. The magazine drops out of the grip for the reload. */
export function buildPistol(): WeaponModel {
  const root = new THREE.Group();
  const tilt = 0.25;
  const slide = paint(new THREE.BoxGeometry(0.046, 0.042, 0.22), GEAR.metal);
  const ridge = paint(new THREE.BoxGeometry(0.03, 0.01, 0.2), GEAR.metalLight);
  const frame = paint(new THREE.BoxGeometry(0.04, 0.032, 0.17), GEAR.metalDark);
  const barrel = paint(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 6).rotateX(Math.PI / 2), GEAR.metalDark);
  const grip = paint(new THREE.BoxGeometry(0.042, 0.12, 0.058), GEAR.grip);
  const guard = paint(new THREE.BoxGeometry(0.012, 0.012, 0.06), GEAR.metalDark);
  const geo = merge([
    place(slide, 0, 0.056, -0.08),
    place(ridge, 0, 0.081, -0.08),
    place(frame, 0, 0.022, -0.06),
    place(barrel, 0, 0.05, -0.2),
    place(grip, 0, -0.04, 0.012, tilt, 0, 0),
    place(guard, 0, -0.012, -0.05),
  ]);
  root.add(meshOf(geo, mat()));
  const magSeat = new THREE.Vector3(0, -0.052, 0.024);
  const mag = meshOf(merge([place(paint(new THREE.BoxGeometry(0.032, 0.1, 0.044), GEAR.metalDark), 0, 0, 0, tilt, 0, 0)]), mat());
  mag.position.copy(magSeat);
  root.add(mag);
  return {
    root,
    mag,
    grip: new THREE.Vector3(0, -0.02, 0.012),
    fore: new THREE.Vector3(-0.03, -0.06, 0.0),
    muzzle: new THREE.Vector3(0, 0.055, -0.215),
    eject: new THREE.Vector3(0.03, 0.07, -0.05),
    magSeat,
    lever: new THREE.Vector3(0, 0.06, 0.04),
    loaded: null,
    magHiddenAtRest: false,
    loadPort: magSeat.clone(),
    pump: null,
    pumpTravel: 0,
    hammer: null,
    hammerCocked: 0,
    hammerGrip: new THREE.Vector3(),
  };
}

export function buildModel(id: string): WeaponModel {
  if (id === 'pistol') return buildPistol();
  if (id === 'spitter') return buildSpitter();
  if (id === 'stapler') return buildStapler();
  return buildRepeater();
}
