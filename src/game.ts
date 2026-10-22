// Game orchestration: modes, frame loop, system order.
import * as THREE from 'three';
import { Spring3 } from './core/math';
import { Input } from './core/input';
import { makeRng, type Rng } from './core/rng';
import { Clock } from './core/time';
import { Physics, GROUPS, type RayHit } from './physics/world';
import { OTSCamera } from './player/camera';
import { Player, type WeaponPose } from './player/player';
import { ColliderDebug } from './render/debug';
import { LimbRenderer } from './render/limbs';
import { GARDEN } from './render/palette';
import { Renderer } from './render/renderer';
import { tuning } from './tuning';
import { Hud } from './ui/hud';
import { Menus } from './ui/menus';
import { Panel } from './ui/panel';
import { buildWorld, type BuiltWorld, type LayoutKind } from './world/arena';
import { buildRepeater } from './weapons/model';

type Mode = 'menu' | 'playing' | 'paused';

const _aimHit: RayHit = {
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  distance: 0,
  collider: null as never,
  target: null,
};
const _o = new THREE.Vector3();

export class Game {
  readonly renderer: Renderer;
  readonly physics = new Physics();
  readonly input: Input;
  readonly clock = new Clock();
  readonly hud = new Hud();
  readonly panel = new Panel();
  readonly menus: Menus;
  readonly limbs: LimbRenderer;
  readonly colliderDebug: ColliderDebug;
  readonly rng: Rng;
  camera!: OTSCamera;
  player!: Player;
  world: BuiltWorld | null = null;
  layout: LayoutKind = 'arena';
  mode: Mode = 'menu';
  /** Where the crosshair ray lands this frame. */
  readonly aimPoint = new THREE.Vector3();
  readonly pose: WeaponPose = { kickPos: new Spring3(), kickRot: new Spring3(), tilt: 0, drop: 0, leftHand: null };
  private last = performance.now();
  private fps = 60;
  private frameCount = 0;
  private fpsTime = 0;

  constructor(
    container: HTMLElement,
    readonly seed: number,
  ) {
    this.rng = makeRng(seed);
    this.renderer = new Renderer(container);
    this.renderer.applyBiome(GARDEN);
    this.limbs = new LimbRenderer(this.renderer.scene);
    this.colliderDebug = new ColliderDebug(this.renderer.scene);
    this.input = new Input(this.renderer.renderer.domElement);
    this.menus = new Menus(seed);
    this.hud.show(false);

    this.menus.onPlay = (m) => this.start(m);
    this.menus.onResume = () => this.resume();
    this.menus.onQuit = () => this.quitToMenu();
    this.input.onLockChange = (locked) => {
      if (!locked && this.mode === 'playing' && !this.panel.open) this.pause();
    };
    this.input.onKey = (code) => this.onKey(code);
    this.panel.onVisibility = (open) => {
      if (open) this.input.exitLock();
      else if (this.mode === 'playing') this.input.requestLock();
    };
    this.renderer.renderer.domElement.addEventListener('click', () => {
      if (this.mode === 'playing' && !this.input.locked) this.input.requestLock();
    });

    requestAnimationFrame((t) => this.frame(t));
  }

  start(layout: LayoutKind) {
    this.layout = layout;
    this.buildLevel();
    this.mode = 'playing';
    this.menus.showStart(false);
    this.menus.showPause(false);
    this.hud.show(true);
    this.input.requestLock();
  }

  private buildLevel() {
    if (this.world) {
      this.renderer.scene.remove(this.world.group);
      this.disposeGroup(this.world.group);
    }
    if (this.player) {
      this.renderer.scene.remove(this.player.biped.group, this.player.weaponRoot);
    }
    this.physics.reset();
    this.world = buildWorld(this.layout, this.physics, GARDEN, this.rng.fork(`world-${this.layout}`));
    this.renderer.scene.add(this.world.group);
    this.player = new Player(this.renderer.scene, this.physics, this.world.spawn, this.world.spawnYaw);
    this.player.setWeapon(buildRepeater());
    this.camera = new OTSCamera(this.renderer.camera, this.physics);
    this.camera.snap(this.world.spawn, this.world.spawnYaw);
    this.physics.step();
  }

  private disposeGroup(g: THREE.Object3D) {
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }

  pause() {
    this.mode = 'paused';
    this.menus.showPause(true);
  }
  resume() {
    this.mode = 'playing';
    this.menus.showPause(false);
    this.input.requestLock();
  }
  quitToMenu() {
    this.mode = 'menu';
    this.menus.showPause(false);
    this.menus.showStart(true);
    this.hud.show(false);
    this.input.exitLock();
  }

  private onKey(code: string) {
    if (code === 'Backquote') this.panel.toggle();
    if (this.mode !== 'playing') return;
    const d = tuning.debug;
    if (code === 'KeyC') this.camera.side *= -1;
    if (code === 'KeyT') {
      d.slowmo = !d.slowmo;
      this.hud.toast(d.slowmo ? `slow-mo ${d.slowmoScale}×` : 'slow-mo off');
    }
    if (code === 'KeyI') d.showIK = !d.showIK;
    if (code === 'KeyH') d.showHitboxes = !d.showHitboxes;
    if (code === 'KeyG') {
      d.godMode = !d.godMode;
      this.hud.toast(d.godMode ? 'god mode' : 'god mode off');
    }
    if (code === 'KeyP') d.pixelMode = !d.pixelMode;
    this.panel.refresh();
  }

  private frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    const realDt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.frameCount++;
    this.fpsTime += realDt;
    if (this.fpsTime >= 0.5) {
      this.fps = this.frameCount / this.fpsTime;
      this.frameCount = 0;
      this.fpsTime = 0;
    }

    this.renderer.syncPixelMode();
    if (this.player && this.mode !== 'menu') this.step(realDt);
    this.renderer.render();
    this.input.endFrame();
  }

  private step(realDt: number) {
    const playing = this.mode === 'playing';
    const simDt = playing ? this.clock.tick(realDt) : 0;
    const inp = this.input;
    const cam = this.camera;
    const player = this.player;

    // 1. Look (real time: stays responsive in hitstop and slow-mo).
    if (playing) cam.look(inp.mouseDX, inp.mouseDY);
    const ads = playing && inp.held('Mouse2') && !player.controller.committed;
    player.aiming = ads;

    // 2. Move.
    const ax = (inp.held('KeyD') ? 1 : 0) - (inp.held('KeyA') ? 1 : 0);
    const ay = (inp.held('KeyW') ? 1 : 0) - (inp.held('KeyS') ? 1 : 0);
    player.move(simDt, {
      x: ax,
      y: ay,
      sprint: inp.held('ShiftLeft') || inp.held('ShiftRight'),
      rollPressed: playing && inp.justPressed('Space'),
      speedMul: ads ? tuning.player.adsSpeedMul : 1,
      camYaw: cam.yaw,
    });

    // 3. Physics broad-phase update (moved bodies/hitboxes visible to queries).
    if (simDt > 0) this.physics.step();

    // 4. Camera + crosshair ray.
    cam.update(player.pos, ads, realDt, simDt, this.clock.realElapsed);
    _o.copy(cam.aimOrigin).addScaledVector(cam.aimDir, cam.aimStartOffset);
    const hit = this.physics.raycast(_o, cam.aimDir, 300, GROUPS.qShot, player.controller.collider, _aimHit);
    if (hit) this.aimPoint.copy(hit.point);
    else this.aimPoint.copy(_o).addScaledVector(cam.aimDir, 300);

    // 5. Animate rig + weapon.
    this.limbs.begin();
    player.animate(simDt, this.aimPoint, cam.aimOrigin, cam.adsAmount, this.pose);
    player.draw(this.limbs, simDt);
    this.limbs.end();

    this.renderer.followShadow(player.pos);
    this.colliderDebug.update(this.physics, tuning.debug.showHitboxes);

    // 6. HUD.
    this.hud.setSpread(0.5, this.renderer.camera.fov, true);
    this.hud.update(realDt);
    const info = this.renderer.renderer.info;
    this.hud.setStats(
      `seed ${this.seed}  ${this.layout}\n` +
        `fps ${this.fps.toFixed(0)}  draws ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(1)}k\n` +
        `state ${player.controller.state}${player.controller.grounded ? '' : ' (air)'}  ` +
        `speed ${Math.hypot(player.controller.vel.x, player.controller.vel.z).toFixed(1)}` +
        (tuning.debug.slowmo ? `\nSLOW-MO ${tuning.debug.slowmoScale}×` : '') +
        (tuning.debug.godMode ? '\nGOD MODE' : ''),
    );
  }
}
