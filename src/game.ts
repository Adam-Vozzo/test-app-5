// Game orchestration: modes, frame loop, system order.
import * as THREE from 'three';
import { Synth } from './audio/synth';
import { Input } from './core/input';
import { makeRng, type Rng } from './core/rng';
import { Clock } from './core/time';
import { Physics, GROUPS, type RayHit } from './physics/world';
import { OTSCamera } from './player/camera';
import { Fx } from './fx/fx';
import type { Enemy, EnemyWorld } from './enemies/enemy';
import { Hazards } from './enemies/hazards';
import { EnemyManager } from './enemies/manager';
import { Vitals } from './player/vitals';
import { PollenDrop } from './world/pollen';
import { damp } from './core/math';
import { Player } from './player/player';
import { ColliderDebug } from './render/debug';
import { LimbRenderer } from './render/limbs';
import { GARDEN, JUSTICE, setActiveBiome, type AreaLighting } from './render/palette';
import { Renderer } from './render/renderer';
import { tuning } from './tuning';
import { Hud } from './ui/hud';
import { Menus } from './ui/menus';
import { Panel } from './ui/panel';
import { buildWorld, type BuiltWorld, type LayoutKind } from './world/arena';
import { buildCourtyard } from './world/courtyard';
import { Dummy } from './world/dummy';
import { buildZone, type ZoneWorld } from './world/zone';
import { Minimap } from './ui/minimap';
import { Arsenal } from './weapons/arsenal';
import type { Gun, GunContext, HitEvent } from './weapons/gun';
import { Projectiles } from './weapons/projectiles';

type Mode = 'menu' | 'playing' | 'paused';

const ELITE_NAMES: Record<string, string> = { brute: 'Brute beetle' };

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
  layout: LayoutKind = 'justice';
  /** Lighting of the current scene (restored after the overview debug view). */
  private area: AreaLighting = GARDEN;
  private areaFog = 0.018;
  mode: Mode = 'menu';
  readonly fx: Fx;
  readonly synth = new Synth();
  arsenal!: Arsenal;
  readonly projectiles: Projectiles;
  readonly hazards: Hazards;
  readonly enemies: EnemyManager;
  readonly vitals = new Vitals();
  readonly minimap = new Minimap();
  /** Seed of the current zone (N rolls a new one). */
  zoneSeed: number;
  pollenDrop!: PollenDrop;
  private enemyWorld!: EnemyWorld;
  private deathT = -1;
  private healEnv = 0;
  private lastDodgeSfx = -1;
  private rollBuffer = 0;
  private readonly chest = new THREE.Vector3();
  dummies: Dummy[] = [];
  /** Where the crosshair ray lands this frame. */
  readonly aimPoint = new THREE.Vector3();
  private gunCtx!: GunContext;
  /** Range readout stats. */
  private stats = this.freshStats();
  private last = performance.now();
  private fps = 60;
  private frameCount = 0;
  private fpsTime = 0;

  constructor(
    container: HTMLElement,
    readonly seed: number,
  ) {
    this.rng = makeRng(seed);
    this.zoneSeed = seed;
    this.renderer = new Renderer(container);
    this.renderer.applyBiome(JUSTICE);
    this.limbs = new LimbRenderer(this.renderer.scene);
    this.colliderDebug = new ColliderDebug(this.renderer.scene);
    this.fx = new Fx(this.renderer, this.physics);
    this.projectiles = new Projectiles(this.renderer.scene);
    this.hazards = new Hazards(this.renderer.scene);
    this.enemies = new EnemyManager(this.renderer.scene, this.hazards);
    this.enemies.onKilled = (e) => this.onEnemyKilled(e);
    this.input = new Input(this.renderer.renderer.domElement);
    this.menus = new Menus(seed);
    this.hud.show(false);

    this.menus.onPlay = (m) => this.start(m);
    this.menus.onResume = () => this.resume();
    this.menus.onQuit = () => this.quitToMenu();
    this.menus.onRise = () => this.rise();
    this.input.onLockChange = (locked) => {
      if (!locked && this.mode === 'playing' && !this.panel.open && !this.vitals.dead) this.pause();
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
      this.renderer.scene.remove(this.player.biped.group, this.player.weaponRoot, this.player.drop);
    }
    if (this.pollenDrop) this.renderer.scene.remove(this.pollenDrop.group);
    this.enemies.clear();
    for (const d of this.dummies) d.dispose(this.renderer.scene);
    this.dummies = [];
    this.fx.clear();
    this.projectiles.clear();
    this.physics.reset();
    if (this.layout === 'justice') {
      this.world = buildCourtyard(this.physics, this.rng.fork('justice'));
      this.area = JUSTICE;
    } else if (this.layout === 'garden' || this.layout === 'kitchen') {
      const z = buildZone(this.zoneSeed, this.layout, this.physics);
      this.world = z;
      this.area = z.theme.palette;
      this.areaFog = z.theme.fogDensity;
    } else {
      this.world = buildWorld(this.layout, this.physics, GARDEN, this.rng.fork(`world-${this.layout}`));
      this.area = GARDEN;
      this.areaFog = 0.018;
    }
    this.renderer.applyBiome(this.area, this.areaFog);
    setActiveBiome(this.area);
    this.renderer.scene.add(this.world.group);
    // The level never moves: freeze its matrices (the cache flower animates, so it stays live).
    this.world.group.updateMatrixWorld(true);
    this.world.group.traverse((o) => (o.matrixAutoUpdate = false));
    this.zone?.cache.group.traverse((o) => (o.matrixAutoUpdate = true));
    this.player = new Player(this.renderer.scene, this.physics, this.world.spawn, this.world.spawnYaw);
    this.arsenal = new Arsenal(this.player, this.layout === 'range');
    this.player.biped.onFootstep = () => {
      if (this.player.controller.grounded) this.synth.footstep();
    };
    this.camera = new OTSCamera(this.renderer.camera, this.physics);
    this.camera.snap(this.world.spawn, this.world.spawnYaw);
    for (const s of this.world.dummySpots) this.dummies.push(new Dummy(this.renderer.scene, this.physics, s.pos, s.slide, s.guardYaw ?? null));
    // The arena gets a couple of dummies too, so shooting can be tried anywhere.
    if (this.layout === 'arena') {
      this.dummies.push(new Dummy(this.renderer.scene, this.physics, new THREE.Vector3(3, 0, -9), false));
      this.dummies.push(new Dummy(this.renderer.scene, this.physics, new THREE.Vector3(-4, 0, -14), false));
    }
    this.stats = this.freshStats();
    for (const d of this.dummies) d.onStagger = () => this.stats.staggers++;
    this.vitals.restore();
    this.vitals.pollen = 0;
    this.deathT = -1;
    this.menus.showDeath(false);
    this.pollenDrop = new PollenDrop(this.renderer.scene);
    // Enemies stand on whatever is below their spawn point.
    for (const sp of this.world.enemySpots) {
      const g = this.physics.groundY(sp.pos.x, sp.pos.z, 40, 80);
      if (g) sp.pos.y = g.y + 0.02;
    }
    this.enemies.spawnAll(this.world.enemySpots, this.physics);
    const game = this;
    this.enemyWorld = {
      physics: this.physics,
      playerPos: this.player.controller.pos,
      playerChest: this.chest,
      playerVel: this.player.controller.vel,
      get playerAlive() {
        return !game.vitals.dead;
      },
      enemies: this.enemies.enemies,
      hazards: this.hazards,
      hurtPlayer: (amount, from, knockback) => this.hurtPlayer(amount, from, knockback),
      sound: (name, at) => this.sfxAt(name, at),
      shake: (trauma, at) => {
        const d = at.distanceTo(this.player.pos);
        this.camera.addTrauma(trauma / (1 + d * 0.15));
      },
    };
    this.gunCtx = {
      physics: this.physics,
      player: this.player,
      camera: this.camera,
      fx: this.fx,
      synth: this.synth,
      hud: this.hud,
      clock: this.clock,
      projectiles: this.projectiles,
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

  private freshStats() {
    return { shots: 0, hits: 0, crits: 0, kills: 0, staggers: 0, last: '', hitLog: [] as { t: number; d: number }[], lastTTK: 0, lastShotHit: 0, shotDamage: 0 };
  }

  /** The current zone, if playing one. */
  get zone(): ZoneWorld | null {
    return this.world && 'layout' in this.world ? (this.world as ZoneWorld) : null;
  }

  /** Rebuild the current zone from a new seed (debug key N). */
  regenerate(seed: number) {
    this.zoneSeed = seed >>> 0;
    this.buildLevel();
    this.hud.toast(`zone seed ${this.zoneSeed}`, 2);
  }

  /** The weapon in hand. */
  get gun(): Gun {
    return this.arsenal.current;
  }

  private recordHit(e: HitEvent) {
    const st = this.stats;
    // Pellets share a shot: count the shot as a hit once and sum its damage for the readout.
    if (st.lastShotHit !== e.shotId) {
      st.hits++;
      st.lastShotHit = e.shotId;
      st.shotDamage = 0;
    }
    st.shotDamage += e.damage;
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
    st.last = `${st.shotDamage.toFixed(1)}${e.kind === 'crit' ? ' CRIT' : e.kind === 'kill' ? ' KILL' : ''} @ ${e.distance.toFixed(1)}u`;
  }

  /** Point the camera at a world position (used by automated tests). */
  aimAt(p: THREE.Vector3 | [number, number, number]) {
    const t = Array.isArray(p) ? new THREE.Vector3(...p) : p;
    const from = this.renderer.camera.position;
    const d = t.clone().sub(from);
    this.camera.yaw = Math.atan2(-d.x, -d.z);
    this.camera.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  }

  /** Positional one-shot: pan from the camera's right vector, fade with distance. */
  private sfxAt(name: Parameters<Synth['sfx']>[0], at: THREE.Vector3) {
    const cam = this.renderer.camera;
    const rel = _o.subVectors(at, cam.position);
    const d = rel.length();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const pan = d > 0.01 ? Math.max(-0.8, Math.min(0.8, rel.dot(right) / d)) : 0;
    this.synth.sfx(name, 1 / (1 + d * 0.06), pan);
  }

  /** Enemy damage to the player. Rolling i-frames and god mode make it miss. */
  hurtPlayer(amount: number, from: THREE.Vector3, knockback: number): boolean {
    const c = this.player.controller;
    if (this.vitals.dead) return false;
    if (c.invulnerable) {
      if (this.clock.elapsed - this.lastDodgeSfx > 0.3) {
        this.lastDodgeSfx = this.clock.elapsed;
        this.synth.sfx('dodge');
      }
      return false;
    }
    const r = this.vitals.damage(amount, false, tuning.debug.godMode);
    if (!r.applied) return false;
    const dir = _o.subVectors(c.pos, from).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize().multiplyScalar(knockback * tuning.vitals.hurtKnockbackMul);
    c.push(dir.x, dir.z);
    this.camera.addTrauma(tuning.vitals.hurtTrauma);
    this.hud.hurt();
    this.synth.sfx('playerHurt');
    if (r.interruptedHeal) this.hud.toast('heal interrupted');
    if (r.died) this.die();
    return true;
  }

  private die() {
    this.deathT = 0;
    this.player.dead = true;
    this.player.healT = -1;
    this.arsenal.current.cancelReload(false);
    this.arsenal.cancelActions();
    this.synth.sfx('playerDie');
    // Your pollen stays where you fell. A previous unrecovered drop is gone.
    if (this.vitals.pollen > 0) this.pollenDrop.place(this.player.pos.clone(), this.vitals.pollen);
    else this.pollenDrop.clear();
    this.vitals.pollen = 0;
  }

  /** Respawn at the checkpoint: full heals and ammo, non-elite enemies return. */
  rise() {
    if (!this.world || this.deathT < 0) return;
    this.deathT = -1;
    this.menus.showDeath(false);
    const at = this.world.checkpoint ? this.world.checkpoint.clone().add(new THREE.Vector3(0, 0.05, -2.2)) : this.world.spawn;
    this.player.controller.teleport(at, this.world.spawnYaw);
    this.player.dead = false;
    this.camera.snap(at, this.world.spawnYaw);
    this.vitals.restore();
    this.arsenal.refillAll();
    this.enemies.reset();
    this.projectiles.clear();
    this.mode = 'playing';
    this.input.requestLock();
  }

  private get restLabel() {
    return this.world?.restLabel ?? 'the sugar cube';
  }

  /** Rest at the checkpoint: refill heals + ammo, respawn non-elite enemies. */
  private rest() {
    this.vitals.restore();
    this.arsenal.refillAll();
    this.enemies.reset();
    this.synth.sfx('rest');
    this.hud.toast('Rested. Heals and ammo refilled; the dead stir…', 2.4);
  }

  private onEnemyKilled(e: Enemy) {
    const reward = e.cfg.pollen;
    this.vitals.pollen += reward;
    this.sfxAt('die', e.center);
    this.fx.sparksAt(e.center, new THREE.Vector3(0, -1, 0), 0xffe14d, 10, 3);
    if (e.elite) this.hud.toast(`${ELITE_NAMES[e.kind] ?? e.kind} defeated  ✿ +${reward}`, 3);
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
    this.menus.showDeath(false);
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
    if (code === 'KeyL') d.showAI = !d.showAI;
    if (code === 'KeyG') {
      d.godMode = !d.godMode;
      this.hud.toast(d.godMode ? 'god mode' : 'god mode off');
    }
    if (code === 'KeyP') tuning.pixel.enabled = !tuning.pixel.enabled;
    if (code === 'KeyM') d.showGraph = !d.showGraph;
    if (code === 'KeyO') d.overview = !d.overview;
    if (code === 'KeyN' && this.zone) this.regenerate(this.zoneSeed + 1);
    if ((code === 'Digit1' || code === 'Digit2') && !this.vitals.busy) this.arsenal.request(Number(code.slice(5)) - 1);
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
      `shots ${st.shots}  hits ${st.hits} (${acc}%)  crits ${st.crits}  staggers ${st.staggers}  kills ${st.kills}   spread ${this.gun.displaySpread.toFixed(2)}°`
    );
  }

  private step(realDt: number) {
    const playing = this.mode === 'playing';
    const simDt = playing ? this.clock.tick(realDt) : 0;
    const inp = this.input;
    const cam = this.camera;
    const player = this.player;
    const v = this.vitals;
    const c = player.controller;
    const alive = !v.dead;
    const control = playing && alive;

    // 1. Look (real time: stays responsive in hitstop and slow-mo).
    if (control) cam.look(inp.mouseDX, inp.mouseDY);
    const ads = control && inp.held('Mouse2') && !c.committed && !v.busy && this.arsenal.allowsAim;
    player.aiming = ads;
    if (control && !v.busy && !this.arsenal.busy && inp.wheel !== 0) this.arsenal.cycle(Math.sign(inp.wheel));
    const gun = this.gun;

    // Heal (Q): committed, slow, interrupted by damage.
    if (control && inp.justPressed('KeyQ') && !c.committed && !gun.reloading && !this.arsenal.busy) {
      if (v.startHeal()) this.synth.sfx('healStart');
      else if (v.healCharges <= 0) this.hud.toast(`no heals left: rest at ${this.restLabel}`);
    }
    // Rest (E) at the checkpoint.
    const cp = this.world?.checkpoint;
    const nearCheckpoint = !!cp && alive && Math.hypot(c.pos.x - cp.x, c.pos.z - cp.z) < 3.2;
    if (control && nearCheckpoint && inp.justPressed('KeyE') && !c.committed) this.rest();
    if (!playing || !alive) {
      // Death screen: E / Space also rise.
      if (this.deathT >= 1.4 && (inp.justPressed('KeyE') || inp.justPressed('Space'))) this.rise();
    }

    // 2. Move. Stamina gates sprint and roll.
    const ax = control ? (inp.held('KeyD') ? 1 : 0) - (inp.held('KeyA') ? 1 : 0) : 0;
    const ay = control ? (inp.held('KeyW') ? 1 : 0) - (inp.held('KeyS') ? 1 : 0) : 0;
    const wasState = c.state;
    if (control && inp.justPressed('Space')) {
      this.rollBuffer = tuning.feel.rollBuffer;
      if (!v.canRoll() && c.state === 'move') this.synth.sfx('exhausted', 0.6);
    } else this.rollBuffer = Math.max(0, this.rollBuffer - realDt);
    const wantsRoll = control && this.rollBuffer > 0 && !v.busy && !this.arsenal.blocksRoll;
    player.move(simDt, {
      x: ax,
      y: ay,
      sprint: control && (inp.held('ShiftLeft') || inp.held('ShiftRight')) && v.canSprint(),
      rollPressed: wantsRoll && v.canRoll(),
      speedMul:
        (ads ? tuning.player.adsSpeedMul : 1) *
        (gun.reloading ? tuning.player.reloadSpeedMul : 1) *
        this.arsenal.moveMul *
        (v.healing ? tuning.vitals.healMoveMul : 1) *
        (alive ? 1 : 0),
      camYaw: cam.yaw,
    });
    if (wasState !== 'roll' && c.state === 'roll') {
      this.rollBuffer = 0;
      this.arsenal.onRoll();
      v.spendRoll();
      this.synth.sfx('roll');
    }
    if (simDt > 0 && v.tick(simDt, c.sprinting) === 'healed') {
      this.synth.sfx('heal');
      this.fx.sparksAt(player.biped.chest, new THREE.Vector3(0, -1, 0), 0xcfeaff, 12, 2.5);
    }
    player.healT = v.healing ? v.healT : -1;
    player.healApplyAt = tuning.vitals.healApplyAt;
    if (!alive && this.deathT >= 0) {
      this.deathT += realDt;
      if (this.deathT >= 1.4 && this.deathT - realDt < 1.4) {
        const note = this.pollenDrop.amount > 0 ? `Your ${this.pollenDrop.amount} pollen lies where you fell. Reach it before you die again.` : 'You had no pollen to lose.';
        this.menus.showDeath(true, note);
        this.input.exitLock();
      }
    }

    // 3. Targets move, then the broad-phase updates so this frame's shots see them where they're drawn.
    this.chest.copy(player.biped.chest);
    for (const d of this.dummies) d.update(simDt, this.renderer.camera);
    this.enemies.update(simDt, this.enemyWorld);
    if (simDt > 0) this.physics.step();

    // 4. Camera + crosshair ray.
    cam.update(player.pos, ads, realDt, simDt, this.clock.realElapsed);
    if (tuning.debug.overview && this.zone) {
      // Debug: look straight down on the whole zone.
      const b = this.zone.layout.bounds;
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
      const rc = this.renderer.camera;
      rc.position.set(cx, span * 0.95, cz + 0.01);
      rc.lookAt(cx, 0, cz);
      rc.far = Math.max(400, span * 2);
      rc.updateProjectionMatrix();
      this.renderer.scene.fog = null;
    } else if (!this.renderer.scene.fog && this.world) {
      this.renderer.applyBiome(this.area, this.areaFog);
      this.renderer.camera.far = 1200;
      this.renderer.camera.updateProjectionMatrix();
    }
    _o.copy(cam.aimOrigin).addScaledVector(cam.aimDir, cam.aimStartOffset);
    const hit = this.physics.raycast(_o, cam.aimDir, 300, GROUPS.qShot, c.collider, _aimHit);
    if (hit) this.aimPoint.copy(hit.point);
    else this.aimPoint.copy(_o).addScaledVector(cam.aimDir, 300);

    // 5. Weapon: shots resolve this frame, on the frame of input.
    // Muzzle position comes from last frame's rig; the shot ray itself starts at the camera.
    const fireHeld = control && inp.held('Mouse0');
    const firePressed = control && inp.justPressed('Mouse0');
    this.arsenal.update(
      simDt,
      this.gunCtx,
      {
        fireHeld,
        firePressed,
        reloadPressed: control && inp.justPressed('KeyR'),
        aimHeld: control && inp.held('Mouse2'),
        aimPressed: control && inp.justPressed('Mouse2'),
        aimReleased: !control || inp.justReleased('Mouse2'),
        switchPressed: control && inp.justPressed('KeyF'),
      },
      !v.busy,
    );
    // Healing lowers the weapon.
    this.healEnv = damp(this.healEnv, v.healing ? 1 : 0, 14, simDt);
    this.gun.pose.drop += this.healEnv * 0.18;
    this.gun.pose.tilt += this.healEnv * 0.5;
    this.projectiles.update(simDt, this.gunCtx);
    // Not collectible while dead (the killing blow can land the same frame the drop appears).
    const recovered = v.dead ? 0 : this.pollenDrop.update(simDt, c.pos, tuning.vitals.pollenPickupRadius);
    if (recovered > 0) {
      v.pollen += recovered;
      this.synth.sfx('pollen');
      this.hud.toast(`pollen recovered  ✿ +${recovered}`, 2);
    }
    const zone = this.zone;
    const cached = zone && !v.dead ? zone.cache.update(simDt, c.pos) : 0;
    if (cached > 0) {
      v.pollen += cached;
      this.synth.sfx('pollen');
      this.synth.sfx('rest', 0.6);
      this.hud.toast(`pollen cache  ✿ +${cached}`, 2.5);
    }

    // 6. Animate rig + weapon.
    this.limbs.begin();
    player.animate(simDt, this.aimPoint, cam.aimOrigin, cam.adsAmount, this.gun.pose);
    player.draw(this.limbs, simDt);
    this.arsenal.afterAnimate(this.gunCtx);
    this.enemies.draw(this.limbs);
    this.limbs.end();

    this.renderer.followShadow(player.pos);
    this.colliderDebug.update(this.physics, tuning.debug.showHitboxes);

    this.fx.update(simDt);

    // 7. HUD.
    const held = this.gun;
    const sword = this.arsenal.sword;
    const swordMode = sword?.mode === 'sword';
    this.hud.setSpread(held.displaySpread, this.renderer.camera.fov, alive && !c.committed && !held.reloading && !this.arsenal.busy && !v.busy && !swordMode);
    const name = sword ? `${held.def.name} · ${sword.switching ? '…' : sword.mode}${sword.stage.name !== 'edge restored' ? ` (${sword.stage.name})` : ''}` : held.def.name;
    this.hud.setAmmo(name, held.mag, held.def.magSize, held.reserve, held.reloadProgress, !!sword);
    this.hud.setCharges(held.mag, held.def.magSize, !!sword && alive);
    this.hud.setSlots(this.arsenal.guns.map((g) => g.def.name), this.arsenal.index);
    this.hud.setVitals(v.health, v.maxHealth, v.stamina, tuning.vitals.maxStamina, v.exhausted, v.healCharges, tuning.vitals.healCharges, v.pollen);
    const elite = this.enemies.activeElite;
    this.hud.setBoss(elite ? ELITE_NAMES[elite.kind] ?? elite.kind : null, elite ? elite.health / elite.maxHealth : 0);
    if (nearCheckpoint && !c.committed) this.hud.prompt(`E: rest at ${this.restLabel}`);
    else this.hud.prompt(null);
    this.hud.setLabels(tuning.debug.showAI ? this.aiLabels() : null);
    this.minimap.draw(this.zone?.layout ?? null, tuning.debug.showGraph, c.pos, this.enemies.enemies.map((e) => ({ x: e.center.x, z: e.center.z, alive: e.alive })));
    this.hud.update(realDt);
    this.hud.setRange(this.layout === 'range' ? this.rangeText() : null);
    const info = this.renderer.renderer.info;
    this.hud.setStats(
      `seed ${this.zone ? this.zoneSeed : this.seed}  ${this.layout}\n` +
        `fps ${this.fps.toFixed(0)}  draws ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(1)}k\n` +
        `state ${c.state}${c.grounded ? '' : ' (air)'}${c.invulnerable ? ' i-frames' : ''}  ` +
        `speed ${Math.hypot(c.vel.x, c.vel.z).toFixed(1)}` +
        (tuning.debug.slowmo ? `\nSLOW-MO ${tuning.debug.slowmoScale}×` : '') +
        (tuning.debug.godMode ? '\nGOD MODE' : ''),
    );
  }

  private aiLabels() {
    const cam = this.renderer.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const out: { x: number; y: number; text: string }[] = [];
    for (const e of this.enemies.enemies) {
      if (!e.group.visible) continue;
      const p = _o.copy(e.rig.pos).addScaledVector(new THREE.Vector3(0, 1, 0), e.plan.radius * 1.6 + 0.3).project(cam);
      if (p.z > 1) continue;
      out.push({ x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, text: e.label });
    }
    return out;
  }
}
