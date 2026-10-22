// Game orchestration: modes, frame loop, system order.
import * as THREE from 'three';
import { Synth } from './audio/synth';
import { Input } from './core/input';
import { makeRng, type Rng } from './core/rng';
import { Clock } from './core/time';
import { Physics, GROUPS, type RayHit } from './physics/world';
import { OTSCamera } from './player/camera';
import { Fx } from './fx/fx';
import { Player } from './player/player';
import { ColliderDebug } from './render/debug';
import { LimbRenderer } from './render/limbs';
import { GARDEN } from './render/palette';
import { Renderer } from './render/renderer';
import { tuning } from './tuning';
import { Hud } from './ui/hud';
import { Menus } from './ui/menus';
import { Panel } from './ui/panel';
import { buildWorld, type BuiltWorld, type LayoutKind } from './world/arena';
import { Dummy } from './world/dummy';
import { Gun, type GunContext, type HitEvent } from './weapons/gun';
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
  readonly fx: Fx;
  readonly synth = new Synth();
  gun!: Gun;
  dummies: Dummy[] = [];
  /** Where the crosshair ray lands this frame. */
  readonly aimPoint = new THREE.Vector3();
  private gunCtx!: GunContext;
  /** Range readout stats. */
  private stats = { shots: 0, hits: 0, crits: 0, kills: 0, last: '', hitLog: [] as { t: number; d: number }[], lastTTK: 0 };
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
    this.fx = new Fx(this.renderer, this.physics);
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
    this.input.onSoftFallback = () =>
      this.hud.toast('Pointer lock blocked here: mouse look works while the cursor is in the window · Esc pauses', 5);
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
    this.synth.resume();
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
    for (const d of this.dummies) d.dispose(this.renderer.scene);
    this.dummies = [];
    this.fx.clear();
    this.physics.reset();
    this.world = buildWorld(this.layout, this.physics, GARDEN, this.rng.fork(`world-${this.layout}`));
    this.renderer.scene.add(this.world.group);
    this.player = new Player(this.renderer.scene, this.physics, this.world.spawn, this.world.spawnYaw);
    const model = buildRepeater();
    this.player.setWeapon(model);
    this.gun = new Gun(tuning.weapons.repeater, model, this.layout === 'range');
    this.player.biped.onFootstep = () => {
      if (this.player.controller.grounded) this.synth.footstep();
    };
    this.camera = new OTSCamera(this.renderer.camera, this.physics);
    this.camera.snap(this.world.spawn, this.world.spawnYaw);
    for (const s of this.world.dummySpots) this.dummies.push(new Dummy(this.renderer.scene, this.physics, s.pos, s.slide));
    // The arena gets a couple of dummies too, so shooting can be tried anywhere.
    if (this.layout === 'arena') {
      this.dummies.push(new Dummy(this.renderer.scene, this.physics, new THREE.Vector3(3, 0, -9), false));
      this.dummies.push(new Dummy(this.renderer.scene, this.physics, new THREE.Vector3(-4, 0, -14), false));
    }
    this.stats = { shots: 0, hits: 0, crits: 0, kills: 0, last: '', hitLog: [], lastTTK: 0 };
    this.gunCtx = {
      physics: this.physics,
      player: this.player,
      camera: this.camera,
      fx: this.fx,
      synth: this.synth,
      hud: this.hud,
      clock: this.clock,
      onHit: (e) => this.recordHit(e),
      onShot: () => this.stats.shots++,
    };
    this.physics.step();
  }

  private disposeGroup(g: THREE.Object3D) {
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }

  private recordHit(e: HitEvent) {
    const st = this.stats;
    st.hits++;
    if (e.kind === 'crit') st.crits++;
    const now = this.clock.elapsed;
    st.hitLog.push({ t: now, d: e.damage });
    const dummy = e.owner as Dummy;
    if (dummy && 'firstHitTime' in dummy) {
      if (dummy.firstHitTime < 0) dummy.firstHitTime = now;
      if (e.kind === 'kill') {
        st.kills++;
        st.lastTTK = now - dummy.firstHitTime;
      }
    }
    st.last = `${e.damage.toFixed(1)}${e.kind === 'crit' ? ' CRIT' : e.kind === 'kill' ? ' KILL' : ''} @ ${e.distance.toFixed(1)}u`;
  }

  /** Point the camera at a world position (used by automated tests). */
  aimAt(p: THREE.Vector3 | [number, number, number]) {
    const t = Array.isArray(p) ? new THREE.Vector3(...p) : p;
    const from = this.renderer.camera.position;
    const d = t.clone().sub(from);
    this.camera.yaw = Math.atan2(-d.x, -d.z);
    this.camera.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  }

  pause() {
    this.mode = 'paused';
    this.menus.showPause(true);
  }
  resume() {
    this.synth.resume();
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

  private rangeText() {
    const st = this.stats;
    const now = this.clock.elapsed;
    st.hitLog = st.hitLog.filter((h) => now - h.t < 3);
    const dmg = st.hitLog.reduce((a, h) => a + h.d, 0);
    const span = st.hitLog.length ? Math.max(0.5, Math.min(3, now - st.hitLog[0].t)) : 1;
    const acc = st.shots ? Math.round((st.hits / st.shots) * 100) : 0;
    return (
      `last ${st.last || '-'}   dps(3s) ${(dmg / span).toFixed(0)}   ttk ${st.lastTTK ? st.lastTTK.toFixed(2) + 's' : '-'}\n` +
      `shots ${st.shots}  hits ${st.hits} (${acc}%)  crits ${st.crits}  kills ${st.kills}   spread ${this.gun.spread.toFixed(2)}°`
    );
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
    const gun = this.gun;

    // 2. Move.
    const ax = (inp.held('KeyD') ? 1 : 0) - (inp.held('KeyA') ? 1 : 0);
    const ay = (inp.held('KeyW') ? 1 : 0) - (inp.held('KeyS') ? 1 : 0);
    player.move(simDt, {
      x: ax,
      y: ay,
      sprint: inp.held('ShiftLeft') || inp.held('ShiftRight'),
      rollPressed: playing && inp.justPressed('Space'),
      speedMul: (ads ? tuning.player.adsSpeedMul : 1) * (gun.reloading ? tuning.player.reloadSpeedMul : 1),
      camYaw: cam.yaw,
    });

    // 3. Targets move, then the broad-phase updates so this frame's shots see them where they're drawn.
    for (const d of this.dummies) d.update(simDt, this.renderer.camera);
    if (simDt > 0) this.physics.step();

    // 4. Camera + crosshair ray.
    cam.update(player.pos, ads, realDt, simDt, this.clock.realElapsed);
    _o.copy(cam.aimOrigin).addScaledVector(cam.aimDir, cam.aimStartOffset);
    const hit = this.physics.raycast(_o, cam.aimDir, 300, GROUPS.qShot, player.controller.collider, _aimHit);
    if (hit) this.aimPoint.copy(hit.point);
    else this.aimPoint.copy(_o).addScaledVector(cam.aimDir, 300);

    // 5. Weapon: shots resolve this frame, on the frame of input.
    // Muzzle position comes from last frame's rig; the shot ray itself starts at the camera.
    const fireHeld = playing && inp.held('Mouse0');
    const firePressed = playing && inp.justPressed('Mouse0');
    gun.update(simDt, this.gunCtx, fireHeld, firePressed, playing && inp.justPressed('KeyR'));

    // 6. Animate rig + weapon.
    this.limbs.begin();
    player.animate(simDt, this.aimPoint, cam.aimOrigin, cam.adsAmount, gun.pose);
    player.draw(this.limbs, simDt);
    this.limbs.end();

    this.renderer.followShadow(player.pos);
    this.colliderDebug.update(this.physics, tuning.debug.showHitboxes);

    this.fx.update(simDt);

    // 7. HUD.
    this.hud.setSpread(gun.spread, this.renderer.camera.fov, !player.controller.committed && !gun.reloading);
    this.hud.setAmmo(gun.def.name, gun.mag, gun.def.magSize, gun.reserve, gun.reloading ? gun.reloadT : 0);
    this.hud.update(realDt);
    this.hud.setRange(this.layout === 'range' ? this.rangeText() : null);
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
