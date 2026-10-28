// Game orchestration: modes, frame loop, system order.
import * as THREE from 'three';
import { Synth } from './audio/synth';
import { Input } from './core/input';
import { makeRng, type Rng } from './core/rng';
import { Clock } from './core/time';
import { Physics, GROUPS, type RayHit } from './physics/world';
import { OTSCamera } from './player/camera';
import { Fx } from './fx/fx';
import type { EnemyWorld, Hostile } from './enemies/enemy';
import { rangedMinDistance, type Noise } from './enemies/foe-ai';
import { Hazards } from './enemies/hazards';
import { EnemyManager } from './enemies/manager';
import { Vitals } from './player/vitals';
import { PollenDrop } from './world/pollen';
import { damp } from './core/math';
import { Player } from './player/player';
import { ColliderDebug } from './render/debug';
import { LimbRenderer } from './render/limbs';
import { AREAS, GARDEN, JUSTICE, MOON, setActiveBiome, SIGNAL, WORLD, type AreaLighting } from './render/palette';
import { Renderer } from './render/renderer';
import { tuning } from './tuning';
import { Hud } from './ui/hud';
import { Menus } from './ui/menus';
import { Panel } from './ui/panel';
import { buildWorld, type BuiltWorld, type LayoutKind } from './world/arena';
import { buy, clearDimension, effects, gainRelic, gateOpen, loadSave, newSave, nextLine, storeSave, type SaveData, type ShopItem } from './core/save';
import { CourtCard } from './enemies/court';
import { Shop } from './ui/shop';
import { ParryState } from './weapons/parry';
import { Binding } from './player/binding';
import { buildBossArena, type BossWorld } from './world/boss';
import { buildHub, GATES } from './world/hub';
import { DIMENSION_ORDER, MAGICIAN_LINES, PRIESTESS_LINES, SHOP, STAR_LINES, STAR_SHOP, SUN_LINE, UNBINDING_LINES, UNBINDINGS } from './world/hub-data';
import { PACT_TERMS } from './enemies/devil-boss';
import { buildCourtyard } from './world/courtyard';
import { DIMENSIONS, type DimensionDef } from './world/dimensions';
import { generateLevel } from './world/gen-level';
import { buildLevel as buildGeneratedLevel, type LevelWorld } from './world/level';
import { deckCentre, type Hoard, type Scaffold } from './world/gen-dress';
import { inRoom, toLocal, toWorld } from './world/gen-space';
import { CoinPiles } from './world/coins';
import { Thrall } from './enemies/devil';
import { Foe } from './enemies/foe';
import { sweepCrosses } from './enemies/foe-ai';
import { Dummy } from './world/dummy';
import { buildZone, type ZoneWorld } from './world/zone';
import { Minimap } from './ui/minimap';
import { Arsenal } from './weapons/arsenal';
import type { Gun, GunContext, HitEvent } from './weapons/gun';
import { Projectiles } from './weapons/projectiles';

type Mode = 'menu' | 'playing' | 'paused' | 'shop';


const _aimHit: RayHit = {
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  distance: 0,
  collider: null as never,
  target: null,
};
const _o = new THREE.Vector3();
const _o2 = new THREE.Vector3();
/** Dimensions whose arcana's arena is built. */
const ARENAS = ['justice', 'devil', 'tower', 'moon'];

export class Game {
  readonly renderer: Renderer;
  readonly physics = new Physics();
  readonly input: Input;
  readonly clock = new Clock();
  readonly hud = new Hud();
  readonly panel = new Panel();
  readonly menus: Menus;
  readonly limbs: LimbRenderer;
  /** The Moon's reflections draw their limbs here: no shadows (the tell). */
  readonly ghostLimbs: LimbRenderer;
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
  /** Seed of the current zone or generated level (N rolls a new one). */
  zoneSeed: number;
  /** Which dimension the levels belong to (a key into DIMENSIONS). */
  dimension = 'justice';
  /** Which of the dimension's three levels is playing (0–2; 3 is its arcana's arena). */
  levelIndex = 0;
  /** The rest point you last rested at (you rise there). */
  private lastRest = 0;
  /** Which vista the V key jumps to next. */
  private vistaCursor = 0;
  pollenDrop!: PollenDrop;
  private enemyWorld!: EnemyWorld;
  private deathT = -1;
  private healEnv = 0;
  private lastDodgeSfx = -1;
  private rollBuffer = 0;
  /** The progress save (localStorage): seed, progress, upgrades, pentacles, unbindings. */
  save: SaveData;
  readonly shop = new Shop();
  /** Justice's unbinding: meet a blow as it lands (V, once she has fallen). */
  readonly parry = new ParryState(tuning.parry);
  /** The Devil's binding: held, then struck, unless she rolls (one roll always breaks it). */
  readonly binding = new Binding();
  private readonly bindFrom = new THREE.Vector3();
  /** The Devil's weight: hoards taken from under chains, carried until you rest (shorter rolls, a slower walk). */
  burden = 0;
  /** Coin the King of Pentacles' rain leaves on the floor (each pile pays, and weighs). */
  private coins!: CoinPiles;
  /** The Devil's pact: offered at half his health (the fight pauses for the answer). Lasts the fight. */
  pact: 'none' | 'offered' | 'accepted' | 'refused' = 'none';
  /** The Tower: seconds until the next lightning mark, the last solid stone she stood on, and fire's damage tick. */
  private stormT = 6;
  /** The collapse's own seeded stream (fire spread, lightning timing), reseeded with each level. */
  private collapseRng = makeRng(1).fork('collapse');
  private readonly lastSafe = new THREE.Vector3();
  private burnAcc = 0;
  /** Spacing between deck-fall sounds (s left). */
  private timberT = 0;
  /** The bolt that flashes down where lightning strikes. */
  private readonly bolt = new THREE.Mesh(new THREE.BoxGeometry(0.35, 60, 0.35).translate(0, 30, 0), new THREE.MeshBasicMaterial({ color: 0xf2f0ff, fog: false }));
  private boltT = 0;
  /** The dash's cooldown (s left), and where she was last frame (for the swept chain check). */
  private dashCd = 0;
  private readonly dashFrom = new THREE.Vector3();
  /** The binding's coil around her (telegraph magenta, tightening as the blow nears). */
  private readonly coil = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.05, 4, 18).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: SIGNAL.telegraph, fog: false, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  private boundToastT = -10;
  private shopOpenedAt = 0;
  /** Noises the player made since the enemies last listened (gunfire, blades, haste). */
  private readonly noises: Noise[] = [];
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
  /** Justice: riding a pan back to the mid lantern. */
  private ride: { from: THREE.Vector3; to: THREE.Vector3; yaw: number; t: number } | null = null;
  private fpsTime = 0;

  constructor(
    container: HTMLElement,
    readonly seed: number,
  ) {
    this.rng = makeRng(seed);
    this.zoneSeed = seed;
    this.save = loadSave(seed);
    this.renderer = new Renderer(container);
    this.renderer.applyBiome(JUSTICE);
    this.limbs = new LimbRenderer(this.renderer.scene);
    this.ghostLimbs = new LimbRenderer(this.renderer.scene, 512, false);
    this.colliderDebug = new ColliderDebug(this.renderer.scene);
    this.fx = new Fx(this.renderer, this.physics);
    this.projectiles = new Projectiles(this.renderer.scene);
    this.hazards = new Hazards(this.renderer.scene);
    this.coins = new CoinPiles(this.renderer.scene);
    this.coil.visible = false;
    this.coil.renderOrder = 6;
    this.renderer.scene.add(this.coil);
    this.bolt.visible = false;
    this.renderer.scene.add(this.bolt);
    this.enemies = new EnemyManager(this.renderer.scene, this.hazards);
    this.enemies.onKilled = (e) => this.onEnemyKilled(e);
    this.input = new Input(this.renderer.renderer.domElement);
    this.menus = new Menus(seed);
    this.hud.show(false);

    this.menus.onPlay = (m) => {
      if (m === 'new') {
        // A new save: new seed (from the URL if given), nothing carried, nothing freed.
        this.save = newSave(this.seed);
        storeSave(this.save);
        this.start('hub');
      } else this.start(m);
    };
    this.menus.setContinue(this.save.cleared.length > 0 || this.save.pentacles > 0 || Object.values(this.save.progress).some((p) => p > 0));
    this.shop.onBuy = (item) => this.buyItem(item);
    this.shop.onClose = () => {
      this.mode = 'playing';
      this.input.requestLock();
    };
    this.menus.onResume = () => this.resume();
    this.menus.onQuit = () => this.quitToMenu();
    this.menus.onRise = () => this.rise();
    this.menus.onSunClose = () => this.closeSun();
    this.menus.onPact = (yes) => this.answerPact(yes);
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
    // The hub and the dimension run on the save (its seed, its pentacles); the test scenes start from nothing.
    if (layout === 'hub' || layout === 'level') {
      this.zoneSeed = this.save.seed;
      this.vitals.currency = this.save.pentacles;
    } else this.vitals.currency = 0;
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
      // (The rifle slung on her back has its own root: leave none behind from the last life.)
      this.renderer.scene.remove(this.player.biped.group, this.player.weaponRoot, this.player.backRoot, this.player.drop);
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
    } else if (this.layout === 'hub') {
      this.world = buildHub(this.physics, makeRng(this.save.seed).fork('hub'), {
        gateOpen: (dim) => gateOpen(this.save, DIMENSION_ORDER, dim),
        gateLabel: (dim) => this.gateLabel(dim),
        built: (dim) => this.roadBuilt(dim),
        enter: (dim) => this.enterDimension(dim),
        shop: () => this.openShop(),
        priestess: () => this.speak('priestess'),
        starHere: () => this.save.cleared.includes('tower'),
        star: () => this.openShop('star'),
      });
      this.area = WORLD;
    } else if (this.layout === 'level' && this.levelIndex === 3 && this.hasArena) {
      // The dimension's end: the arcana's arena (Justice under the scales, the Devil in the pit below his pedestal).
      const kind = this.dimension === 'devil' || this.dimension === 'tower' || this.dimension === 'moon' ? this.dimension : 'justice';
      const bw = buildBossArena(this.physics, makeRng(this.zoneSeed).fork(`${kind}-arena`), kind);
      bw.exitOpen = () => !this.enemies.enemies.some((e) => e.bar && !e.slain);
      this.world = bw;
      this.area = AREAS[kind] ?? JUSTICE;
    } else if (this.layout === 'level') {
      const dim = this.dim;
      const { layout, report } = generateLevel(dim, Math.min(2, this.levelIndex), this.zoneSeed, { rangedMin: rangedMinDistance(tuning.foes.page.attacks.throw, tuning.roll) });
      const lw = buildGeneratedLevel(layout, report, dim, this.physics);
      lw.onCache = () => {
        this.vitals.healCharges = Math.min(this.vitals.maxCharges + 1, this.vitals.healCharges + 1);
        this.vitals.currency += tuning.vitals.cachePentacles;
        this.synth.sfx('rest', 0.6);
        return `Left by someone before you: +1 heal, ✪ +${tuning.vitals.cachePentacles}`;
      };
      lw.onHoard = (h, at) => this.takeHoard(h, at);
      lw.onWeight = (k, n) => {
        this.synth.sfx('slamImpact', 0.7);
        this.camera.addTrauma(0.2);
        const side = k.wing === 0 ? 'left' : 'right';
        return n === 2 ? `The ${side} pan is weighted. Both are: the axis gate lifts.` : `The ${side} pan is weighted (1 of 2). The pan will carry you back to the beam.`;
      };
      lw.onRide = (k) => {
        const c = this.player.controller;
        this.ride = { from: c.pos.clone(), to: new THREE.Vector3(k.ride.x, k.ride.y + 0.05, k.ride.z), yaw: k.ride.yaw, t: 0 };
        this.synth.sfx('chainRattle', 0.8);
        return null;
      };
      lw.onReflection = (at) => {
        this.sfxAt('shimmer', at);
        this.stats.dispelled++;
        return 'It was a reflection. Nothing was ever there.';
      };
      // The veil lifts once the level's court card has fallen.
      lw.exitOpen = () => !this.enemies.enemies.some((e) => e.bar && !e.slain);
      this.world = lw;
      this.area = AREAS[dim.id] ?? JUSTICE;
      if (!report.ok) this.hud.toast(`level failed validation after ${report.attempts} attempts (see stats)`, 4);
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
    this.lastRest = 0;
    this.vistaCursor = 0;
    // She keeps what she had in hand (and the SwordRifle's mode) from one scene to the next.
    const carried = this.arsenal?.state;
    this.player = new Player(this.renderer.scene, this.physics, this.world.spawn, this.world.spawnYaw);
    this.arsenal = new Arsenal(this.player, this.layout === 'range');
    this.ride = null;
    if (carried) this.arsenal.restore(carried);
    this.applyUpgrades();
    this.parry.cancel();
    this.binding.cancel();
    this.burden = 0;
    this.coins.clear();
    this.pact = 'none';
    this.dashCd = 0;
    this.stormT = 6;
    this.collapseRng = makeRng(this.zoneSeed).fork('collapse');
    this.lastSafe.copy(this.world.spawn);
    this.player.biped.onFootstep = () => {
      if (!this.player.controller.grounded) return;
      this.synth.footstep();
      // Walking is nearly silent; running isn't.
      this.noise(this.player.controller.sprinting ? tuning.foes.noise.sprint : tuning.foes.noise.walk);
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
    this.deathT = -1;
    this.menus.showDeath(false);
    this.pollenDrop = new PollenDrop(this.renderer.scene);
    // Enemies stand on whatever is below their spawn point.
    for (const sp of this.world.enemySpots) {
      const g = this.physics.groundY(sp.pos.x, sp.pos.z, 40, 80);
      if (g) sp.pos.y = g.y + 0.02;
    }
    this.enemies.spawnAll(this.world.enemySpots, this.physics);
    if (this.world.foeSpots) this.enemies.spawnFoes(this.world.foeSpots, this.physics, makeRng(this.zoneSeed).fork(`foes-${this.levelIndex}`));
    this.noises.length = 0;
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
      noises: this.noises,
      alertNear: (from, radius, at, caller) => this.enemies.alertNear(from, radius, at, caller),
      bossPhase: (phase) => this.bossWorld?.onBossPhase(phase),
      summon: (id, pos, yaw, illusion, maker) => this.enemies.summon(id, pos, yaw, this.player.pos, this.physics, this.rng.fork(`summon-${this.clock.elapsed.toFixed(3)}`), illusion, maker),
      safeGround: (near) => this.decks?.nearestStanding(near) ?? null,
      healPlayer: (amount) => {
        if (this.vitals.dead) return;
        this.vitals.health = Math.min(this.vitals.maxHealth, this.vitals.health + amount);
        this.fx.sparksAt(this.chest, new THREE.Vector3(0, 1, 0), MOON.accent, 12, 2.5);
        this.hud.toast('Moonlight. It was the true cup.', 2.5);
      },
      hazards: this.hazards,
      hurtPlayer: (amount, from, knockback, source) => this.hurtPlayer(amount, from, knockback, source),
      bindPlayer: (time, damage, knockback, from) => this.bindPlayer(time, damage, knockback, from),
      dropCoins: (at, n) => this.coins.drop(at, n),
      ignite: (at, r) => {
        if (r > 0) this.decks?.ignite(at, r);
      },
      offerPact: () => this.offerPact(),
      get pact() {
        return game.pact;
      },
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
      onHit: (e) => {
        this.recordHit(e);
        if (this.arsenal.sword?.mode === 'sword') this.noise(tuning.foes.noise.blade);
      },
      onBlocked: () => this.stats.blocked++,
      onShot: () => {
        this.stats.shots++;
        this.noise(this.gun.def.id === 'pistol' ? tuning.foes.noise.pistol : tuning.foes.noise.rifle);
      },
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
    return { shots: 0, hits: 0, crits: 0, kills: 0, staggers: 0, blocked: 0, parries: 0, hoards: 0, chainsBroken: 0, coinsTaken: 0, decksCracked: 0, decksBurnt: 0, strikes: 0, falls: 0, dispelled: 0, last: '', hitLog: [] as { t: number; d: number }[], lastTTK: 0, lastShotHit: 0, shotDamage: 0 };
  }

  /** The currency's name and glyph: pentacles in v2 scenes, pollen in the v1 bug scenes. */
  get money() {
    return this.layout === 'justice' || this.layout === 'level' || this.layout === 'hub' ? { name: 'pentacles', glyph: '✪' } : { name: 'pollen', glyph: '✿' };
  }

  /** The current zone, if playing one. */
  get zone(): ZoneWorld | null {
    return this.world && 'layout' in this.world ? (this.world as ZoneWorld) : null;
  }

  /** Rebuild the current zone or level from a new seed (debug key N). */
  regenerate(seed: number) {
    this.zoneSeed = seed >>> 0;
    this.buildLevel();
    this.hud.toast(`${this.level ? 'level' : 'zone'} seed ${this.zoneSeed}`, 2);
  }

  /** The current generated level, if playing one. */
  get level(): LevelWorld | null {
    return this.world && 'generated' in this.world ? (this.world as LevelWorld) : null;
  }

  /** The boss arena, if that's where we are. */
  get bossWorld(): BossWorld | null {
    return this.world && 'boss' in this.world ? (this.world as BossWorld) : null;
  }

  /** The dimension the levels belong to. */
  get dim(): DimensionDef {
    return DIMENSIONS[this.dimension] ?? DIMENSIONS.justice;
  }

  /** Does the current dimension's arcana have its arena yet? (Justice's and, since V2-10, the Devil's.) */
  get hasArena() {
    return ARENAS.includes(this.dimension);
  }

  /** Where a road stands: its next level's name, for gates and toasts. */
  private stageName(dim: DimensionDef, n: number) {
    return n === 3 ? dim.seat.name : `level ${n + 1}`;
  }

  /** Walk on: level 1 → 2 → 3 → the arcana's arena → home to the hub. Each step is saved. */
  nextLevel() {
    if (this.levelIndex === 3) {
      this.completeDimension();
      return;
    }
    const dim = this.dim;
    if (this.levelIndex === 2 && !this.hasArena) {
      // The road is built only as far as its King: the arcana's arena comes later, so the way on leads home.
      this.save = { ...this.save, progress: { ...this.save.progress, [dim.id]: 3 } };
      this.levelIndex = 0;
      this.layout = 'hub';
      this.persist();
      this.buildLevel();
      this.hud.toast(`${dim.name} waits at ${dim.seat.name}. (Its arena isn't built yet: the road leads home.)`, 5);
      return;
    }
    this.levelIndex++;
    this.save = { ...this.save, progress: { ...this.save.progress, [dim.id]: this.levelIndex } };
    this.persist();
    this.buildLevel();
    if (this.levelIndex === 3) this.hud.toast(`${dim.name}: ${this.stageName(dim, 3)}`, 3.5);
    else this.hud.toast(`${dim.name}, level ${this.levelIndex + 1}: ${this.level!.generated.script.setPiece.name}`, 3.5);
  }

  /** The arcana has fallen: the dimension is cleared, its unbinding is freed, and the road leads home to the hub. */
  completeDimension() {
    const id = this.dim.id;
    const first = !this.save.cleared.includes(id);
    this.save = clearDimension(this.save, id, UNBINDINGS[id]);
    this.levelIndex = 0;
    this.layout = 'hub';
    this.persist();
    this.buildLevel();
    const line = UNBINDING_LINES[id];
    if (line) this.hud.toast(first ? line.first : line.again, 6);
    // The Moon frees the blindfold, and that is the ending: the Sun.
    if (id === 'moon') this.showSun();
  }

  /** The ending: the card's image and one line, then back to the World. */
  showSun() {
    this.mode = 'shop';
    this.shopOpenedAt = performance.now();
    this.input.exitLock();
    this.hud.show(false);
    this.synth.sfx('sunrise');
    this.menus.showSun(true, SUN_LINE);
  }

  private closeSun() {
    this.menus.showSun(false);
    this.mode = 'playing';
    this.hud.show(true);
    this.input.requestLock();
  }

  /** Can a gate's road be walked? Its dimension must be built, and its arena or its levels still ahead. */
  private roadBuilt(dim: string) {
    const d = DIMENSIONS[dim];
    if (!d) return false;
    return ARENAS.includes(dim) || (this.save.progress[dim] ?? 0) < 3;
  }

  /** Into a dimension through its gate, at the next level on its road. */
  enterDimension(dim: string) {
    if (!this.roadBuilt(dim) || !gateOpen(this.save, DIMENSION_ORDER, dim)) return;
    this.persist();
    this.dimension = dim;
    this.layout = 'level';
    this.levelIndex = Math.min(3, this.save.progress[dim] ?? 0);
    this.buildLevel();
    this.hud.toast(`${this.dim.name}, ${this.stageName(this.dim, this.levelIndex)}`, 3);
  }

  private gateLabel(dim: string) {
    const g = GATES.find((x) => x.dim === dim)!;
    const Name = `${g.name[0].toUpperCase()}${g.name.slice(1)}`;
    if (!gateOpen(this.save, DIMENSION_ORDER, dim)) return `${Name} sleeps`;
    const d = DIMENSIONS[dim];
    if (!d) return `${Name} is awake, but the road beyond isn't built yet`;
    const n = this.save.progress[dim] ?? 0;
    if (!this.roadBuilt(dim)) return `${Name}'s road is walked as far as it's built (${d.name}'s arena comes later)`;
    return `E: through ${g.name}'s gate (${d.name}, ${this.stageName(d, n)})`;
  }

  /** Carried pentacles into the save, and the save to storage. */
  persist() {
    if (this.layout === 'hub' || this.layout === 'level') this.save = { ...this.save, pentacles: this.vitals.currency };
    storeSave(this.save);
  }

  /** The Magician's upgrades, folded into the weapons and flasks (upgrades are data applied to defs). */
  private applyUpgrades() {
    const e = effects(this.save, [...SHOP, ...STAR_SHOP]);
    for (const g of this.arsenal.guns) {
      if (g.def.id !== 'pistol') continue;
      g.damageMul = e.pistolDamageMul;
      g.magBonus = e.pistolMagBonus;
      g.refill();
    }
    this.vitals.bonusCharges = e.healBonus;
    this.vitals.healMul = e.healMul;
    this.vitals.healCharges = this.vitals.maxCharges;
    tuning.swordRifle.repairStage = e.repairStage;
    // The Moon's unbinding: the blindfold is off for good.
    this.player.biped.setBlindfold(!this.save.unbound.includes('blindfold'));
  }

  /** Which hub menu is open: the Magician's table, or the Star's pool (after the Tower). */
  private shopOf: 'magician' | 'star' = 'magician';

  private openShop(who: 'magician' | 'star' = 'magician') {
    this.persist();
    this.shopOf = who;
    this.mode = 'shop';
    this.shopOpenedAt = performance.now();
    this.input.exitLock();
    if (who === 'star') this.shop.show(this.save, STAR_SHOP, this.speakLine('star', STAR_LINES, 'default'), 'The Star');
    else this.shop.show(this.save, SHOP, this.speakLine('magician', MAGICIAN_LINES, 'default'));
  }

  private buyItem(item: ShopItem) {
    this.save = buy({ ...this.save, pentacles: this.vitals.currency }, item);
    this.vitals.currency = this.save.pentacles;
    storeSave(this.save);
    this.applyUpgrades();
    this.synth.sfx('chargeReady');
    this.shop.render(this.save, this.shopOf === 'star' ? STAR_SHOP : SHOP);
  }

  /** A hub character's next line for where the player is in the story. */
  private speak(who: 'priestess') {
    const c = this.save.cleared;
    const state = c.includes('moon') ? 'moon' : c.includes('tower') ? 'tower' : c.includes('devil') ? 'devil' : c.includes('justice') ? 'cleared' : (this.save.progress.justice ?? 0) > 0 || this.save.pentacles > 0 ? 'walking' : 'fresh';
    return this.speakLine(who, PRIESTESS_LINES, state);
  }

  private speakLine(who: string, lines: Record<string, readonly string[]>, state: string) {
    const r = nextLine(this.save, who, lines, state);
    this.save = r.save;
    storeSave(this.save);
    return r.line;
  }

  /** Debug and smoke: a scaffold deck's centre (decks lie in their room's own frame). */
  deckAt(s: Scaffold, i: number) {
    return deckCentre(s, i);
  }

  /** Debug and smoke tests: stand at a vista and look where it looks. */
  gotoVista(i: number) {
    const lv = this.level;
    if (!lv) return false;
    const vs = lv.generated.dressing.vistas;
    if (!vs.length) return false;
    const v = vs[((i % vs.length) + vs.length) % vs.length];
    const at = new THREE.Vector3(v.x, v.y + 0.05, v.z);
    this.player.controller.teleport(at, v.yaw);
    this.camera.snap(at, v.yaw);
    this.camera.pitch = v.pitch;
    return true;
  }

  /** The weapon in hand. */
  get gun(): Gun {
    return this.arsenal.current;
  }

  /** A noise at the player, heard by enemies within `r` metres next frame. */
  private noise(r: number) {
    const p = this.player.pos;
    this.noises.push({ x: p.x, y: p.y + 1, z: p.z, r });
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

  /** Enemy damage to the player. A parry, rolling i-frames and god mode make it miss. */
  hurtPlayer(amount: number, from: THREE.Vector3, knockback: number, source?: Hostile | 'projectile'): boolean {
    const c = this.player.controller;
    // Dead, or carried on a pan (the ride is committed and untouchable).
    if (this.vitals.dead || this.ride) return false;
    // The Devil's pact: double what you take, for the rest of the fight.
    if (this.pact === 'accepted') amount *= 2;
    if (source && this.parry.turns(c.yaw, c.pos.x, c.pos.z, from.x, from.z)) {
      this.parried(source, from);
      return false;
    }
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

  /** The Devil's temptation: a hoard pays, and costs what its tell said it would. */
  private takeHoard(h: Hoard, at: THREE.Vector3): string {
    const t = tuning.foes.hoard;
    const amount = Math.round(t.pentacles[h.cost] * (h.branch ? t.branchMul : 1));
    this.vitals.currency += amount;
    this.stats.hoards++;
    this.synth.sfx('coinJingle');
    const g = this.money.glyph;
    if (h.cost === 'bell') {
      this.sfxAt('hoardBell', at);
      this.camera.addTrauma(0.15);
      this.enemies.alertNear(at, t.bellRadius, this.player.pos);
      return `${g} +${amount}. The bell rings, and everything near hears it.`;
    }
    if (h.cost === 'weight') {
      this.burden = Math.min(t.weightMax, this.burden + 1);
      return `${g} +${amount}. Heavy: your rolls fall short until you rest.`;
    }
    this.sfxAt('ambushTell', at);
    const n = h.branch ? t.ambushBranchImps : t.ambushImps;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.6;
      const p = new THREE.Vector3(at.x + Math.cos(a) * 2.6, at.y, at.z + Math.sin(a) * 2.6);
      this.enemyWorld.summon('imp', p, Math.atan2(-(this.player.pos.x - p.x), -(this.player.pos.z - p.z)));
    }
    return `${g} +${amount}. Something climbs out of the broken floor.`;
  }

  /**
   * The Tower's rule, each frame: rotten decks crack under her, fire burns and spreads and drops decks, lightning
   * marks where she stands and sets the timber alight, and a fall into the drop costs health and puts her back on the
   * last solid stone.
   */
  private collapse(dt: number) {
    const lv = this.level;
    const c = this.player.controller;
    const tw = tuning.tower;
    this.boltT = Math.max(0, this.boltT - dt);
    this.bolt.visible = this.boltT > 0;
    const decks = this.decks;
    if (!lv && !decks) return;
    if (decks) {
      const occupants = [c.pos];
      for (const e of this.enemies.enemies) if (e.alive && e instanceof Foe) occupants.push(e.ground);
      // One fall sound at a time (the nearest deck that went), where it went: a ring of the floor giving way used to
      // play dozens at once, all at her feet.
      this.timberT = Math.max(0, this.timberT - dt);
      let nearest: THREE.Vector3 | null = null;
      for (const e of decks.update(dt, this.collapseRng, occupants)) {
        if (e.kind === 'fall' && (!nearest || e.at.distanceToSquared(c.pos) < nearest.distanceToSquared(c.pos))) nearest = e.at;
        else if (e.kind === 'ignite') this.stats.decksBurnt++;
      }
      if (nearest && this.timberT <= 0) {
        this.sfxAt('timberFall', nearest);
        this.timberT = 0.35;
      }
      if (c.grounded && decks.step(c.pos)) {
        this.sfxAt('creak', c.pos);
        this.stats.decksCracked++;
      }
      // Standing in fire hurts (in ticks, so it reads).
      if (c.grounded && decks.standing(c.pos) === 'burning') {
        this.burnAcc += tw.burnDps * dt;
        if (this.burnAcc >= 4) {
          this.hurtPlayer(this.burnAcc, _o.copy(c.pos).setY(c.pos.y - 1), 0);
          this.burnAcc = 0;
        }
      } else this.burnAcc = 0;
    }
    // Remember the last solid stone (decks can fall). In a generated level that's a spot inside a room, kept well
    // back from its edges: coming up at the brink of the drop you just fell from only sends you over it again.
    if (c.grounded && !decks?.standing(c.pos)) {
      const room = lv?.generated.space.rooms.find((r) => inRoom(r, c.pos.x, c.pos.z) && Math.abs(c.pos.y - r.y) < 1.5);
      if (room) {
        // Clamped well inside the room, in its own frame (rooms stand at any heading).
        const m = tuning.player.fallMargin;
        const [u, w] = toLocal(room, c.pos.x, c.pos.z);
        const [x, z] = toWorld(room, THREE.MathUtils.clamp(u, -room.w / 2 + m, room.w / 2 - m), THREE.MathUtils.clamp(w, -room.d / 2 + m, room.d / 2 - m));
        this.lastSafe.set(x, c.pos.y, z);
      } else if (!lv) this.lastSafe.copy(c.pos);
    }
    // Lightning: a mark where she stands, a strike a beat later, and the timber there catches. Never at a lantern.
    if (lv && this.dimension === 'tower' && lv.generated.dimension === 'tower') {
      this.stormT -= dt;
      const atRest = (lv.restPoints ?? []).some((r) => r.pos.distanceTo(c.pos) < 8);
      if (this.stormT <= 0 && !atRest) {
        const [lo, hi] = tw.lightning[Math.min(2, this.levelIndex)];
        this.stormT = lo + this.collapseRng() * (hi - lo);
        this.hazards.verdict(c.pos.clone(), tw.lightningRadius, tw.lightningDelay, tw.lightningDamage, 6, {
          onDone: (_caught, at) => {
            this.bolt.position.copy(at);
            this.boltT = 0.12;
            this.sfxAt('thunder', at);
            this.camera.addTrauma(0.25);
            this.stats.strikes++;
            decks?.ignite(at, tw.igniteRadius);
          },
        });
      }
    }
    // Fell into the drop: back on the last stone (in the arena, the nearest deck still standing).
    const fallY = lv ? Math.min(...lv.generated.space.rooms.map((r) => r.y)) - 12 : -12;
    if (c.pos.y < fallY) {
      this.stats.falls++;
      // Never back onto timber that has gone (or is going) since she stood there: the nearest sound deck instead.
      let back = (!lv && decks?.nearestStanding(c.pos)) || this.lastSafe;
      if (decks && !decks.holds(back)) back = decks.nearestStanding(back) ?? back;
      c.teleport(_o.copy(back).setY(back.y + 0.05), c.yaw);
      this.camera.snap(c.pos, c.yaw);
      if (this.save.unbound.includes('fall')) {
        // The Tower's unbinding: she lands on her feet, and the landing knocks back whoever stands near.
        this.sfxAt('slamImpact', c.pos);
        this.camera.addTrauma(0.4);
        for (const e of this.enemies.enemies) if (e.alive && e.center.distanceTo(c.pos) < tuning.tower.landingRadius) e.parried?.();
        this.hud.toast('You fall, and land on your feet.', 2);
      } else {
        this.hurtPlayer(tw.fallDamage, _o2.copy(c.pos), 0);
        this.hud.toast(this.dimension === 'moon' ? 'The path lied. What is really there casts a shadow on the water.' : 'You fell. Nothing stays standing.', 3);
      }
    }
  }

  /** Justice's pan ride: an arc from the key room back to the mid lantern, then set down facing on. */
  private carry(dt: number) {
    const r = this.ride!;
    const c = this.player.controller;
    const j = tuning.justice;
    r.t = Math.min(1, r.t + dt / Math.max(0.2, j.rideTime));
    const k = r.t * r.t * (3 - 2 * r.t);
    _o.lerpVectors(r.from, r.to, k);
    _o.y += Math.sin(Math.PI * r.t) * j.rideRise;
    c.teleport(_o, c.yaw);
    if (r.t >= 1) {
      c.teleport(r.to, r.yaw);
      this.camera.snap(c.pos, r.yaw);
      this.ride = null;
      this.lastSafe.copy(r.to);
      this.hud.toast('Set down at the beam.', 2);
    }
  }

  /** The timber decks underfoot, in a Tower level or on its top floor. */
  get decks() {
    return this.level?.decks ?? this.bossWorld?.decks ?? null;
  }

  /** The Devil stops at half his health and holds out the pact. The fight pauses until she answers. */
  private offerPact() {
    if (this.pact !== 'none') return;
    this.pact = 'offered';
    this.synth.sfx('courtHorn');
    this.mode = 'shop';
    this.shopOpenedAt = performance.now();
    this.input.exitLock();
    this.menus.showPact(true, `He holds it out: ${PACT_TERMS}, for the rest of the fight.`);
  }

  /** Her answer to the pact (the overlay's buttons, E or Esc). */
  answerPact(accept: boolean) {
    if (this.pact !== 'offered') return;
    this.menus.showPact(false);
    this.mode = 'playing';
    this.input.requestLock();
    if (accept) {
      this.pact = 'accepted';
      this.synth.sfx('bound');
      this.camera.addTrauma(0.3);
      this.hud.toast('The pact is made. Every blow, yours and his, lands twice as hard.', 3.5);
    } else {
      this.pact = 'refused';
      this.hud.toast('You refuse. The fight goes on as it was.', 2.5);
    }
  }

  /** Caught across a chain: held, then struck, unless she rolls. A roll's i-frames slip it entirely. */
  bindPlayer(time: number, damage: number, knockback: number, from: THREE.Vector3): boolean {
    const c = this.player.controller;
    if (this.vitals.dead) return false;
    if (c.invulnerable) {
      this.synth.sfx('dodge');
      return false;
    }
    const first = this.binding.broken === 0 && !this.binding.active;
    this.binding.catch(time, damage, knockback);
    this.bindFrom.copy(from);
    this.synth.sfx('bound');
    this.camera.addTrauma(0.2);
    if (first) this.hud.toast('Bound! One roll breaks any binding (Space).', 3);
    return true;
  }

  /** Answer in kind: the blow is turned, the attacker reels, and the SwordRifle drinks a charge. */
  private parried(source: Hostile | 'projectile', from: THREE.Vector3) {
    const p = tuning.parry;
    this.parry.succeed();
    if (source !== 'projectile') source.parried?.();
    this.stats.parries++;
    const sr = this.arsenal.guns.find((g) => g.model.sword);
    if (sr) sr.mag = Math.min(sr.magSize, sr.mag + p.chargeGain);
    _o.subVectors(from, this.player.pos).setY(0).normalize();
    this.fx.sparksAt(this.chest, _o, 0xffffff, 18, 7);
    this.synth.sfx('block');
    this.synth.sfx('chargeGain');
    this.clock.addHitstop(p.hitstop);
    this.camera.addTrauma(0.25);
    this.hud.hit('crit');
  }

  private die() {
    this.deathT = 0;
    this.player.dead = true;
    this.player.healT = -1;
    this.arsenal.current.cancelReload(false);
    this.arsenal.cancelActions();
    this.synth.sfx('playerDie');
    // Your currency stays where you fell. A previous unrecovered drop is gone.
    if (this.vitals.currency > 0) this.pollenDrop.place(this.player.pos.clone(), this.vitals.currency);
    else this.pollenDrop.clear();
    this.vitals.currency = 0;
  }

  /** Respawn at the checkpoint: full heals and ammo, non-elite enemies return. */
  rise() {
    this.ride = null;
    if (!this.world || this.deathT < 0) return;
    this.deathT = -1;
    this.menus.showDeath(false);
    const rp = this.world.restPoints?.[this.lastRest];
    const at = rp ? rp.rest.clone() : this.world.checkpoint ? this.world.checkpoint.clone().add(new THREE.Vector3(0, 0.05, -2.2)) : this.world.spawn;
    const yaw = rp ? rp.restYaw : this.world.spawnYaw;
    this.player.controller.teleport(at, yaw);
    this.player.dead = false;
    this.camera.snap(at, yaw);
    this.vitals.restore();
    this.arsenal.refillAll();
    this.binding.cancel();
    this.burden = 0;
    this.coins.clear();
    this.pact = 'none';
    this.level?.decks?.reset();
    this.stormT = 6;
    this.enemies.reset();
    this.world.onReset?.();
    this.projectiles.clear();
    this.mode = 'playing';
    this.input.requestLock();
  }

  private get restLabel() {
    return this.world?.restLabel ?? 'the sugar cube';
  }

  /** Rest at the checkpoint: refill heals + ammo, respawn non-elite enemies. */
  private rest() {
    if (this.burden > 0) this.hud.toast('You set the weight down.', 2);
    this.burden = 0;
    this.coins.clear();
    this.pact = 'none';
    this.level?.decks?.reset();
    this.stormT = 6;
    this.vitals.restore();
    this.arsenal.refillAll();
    this.enemies.reset();
    this.world?.onReset?.();
    this.synth.sfx('rest');
    this.persist();
    this.hud.toast('Rested. Heals and ammo refilled; the dead stir…', 2.4);
  }

  private onEnemyKilled(e: Hostile) {
    // Gone with its maker: it fades, for nothing.
    if (e instanceof Foe && e.dismissed) {
      this.sfxAt('shimmer', e.center);
      this.fx.sparksAt(e.center, new THREE.Vector3(0, 1, 0), this.area.dust, 10, 2.5);
      return;
    }
    // A reflection: dispelled, with a shimmer, for nothing.
    if (e instanceof Foe && e.illusion) {
      this.sfxAt('shimmer', e.center);
      this.fx.sparksAt(e.center, new THREE.Vector3(0, 1, 0), MOON.accent, 14, 3);
      this.stats.dispelled++;
      if (this.stats.dispelled === 1) this.hud.toast('A reflection. It cast no shadow, and it made no sound.', 3.5);
      return;
    }
    const reward = e.reward;
    this.vitals.currency += reward;
    // The King of his suit gives up its relic (the SwordRifle's next repair needs it).
    if (e instanceof CourtCard && e.rank === 'king' && this.layout === 'level') {
      const suit = this.dim.suit;
      const relic = suit.toLowerCase();
      const had = this.save.relics.includes(relic);
      this.save = gainRelic(this.save, relic);
      this.persist();
      if (!had) this.hud.toast(`The King of ${suit} gives up the relic of ${suit}. The Magician will want it.`, 4);
    }
    // The Crowned Tower falls: the storm passes, and its top floor holds again (the way on is across it).
    if (e.name === 'The Crowned Tower') this.bossWorld?.onBossPhase(0);
    this.sfxAt('die', e.center);
    this.fx.sparksAt(e.center, new THREE.Vector3(0, -1, 0), 0xffe14d, 10, 3);
    if (e.elite) this.hud.toast(`${e.name} defeated  ${this.money.glyph} +${reward}`, 3);
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
    if (this.player) this.persist();
    this.menus.setContinue(true);
    this.mode = 'menu';
    this.menus.showPause(false);
    this.menus.showDeath(false);
    this.menus.showStart(true);
    this.hud.show(false);
    this.input.exitLock();
  }

  private onKey(code: string) {
    if (code === 'Backquote') this.panel.toggle();
    // (The E that opened the table doesn't also close it.)
    if (this.mode === 'shop' && this.menus.pactShown) {
      if (code === 'KeyE' && performance.now() - this.shopOpenedAt > 300) this.answerPact(true);
      else if (code === 'Escape') this.answerPact(false);
    } else if (this.mode === 'shop' && (code === 'Escape' || (code === 'KeyE' && performance.now() - this.shopOpenedAt > 300))) {
      if (this.menus.sunShown) this.closeSun();
      else this.shop.close();
    }
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
    if (code === 'KeyN' && (this.zone || this.level)) this.regenerate(this.zoneSeed + 1);
    if (code === 'KeyB' && this.gotoVista(this.vistaCursor)) this.vistaCursor++;
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
    // Riding a pan back to the beam (Justice): carried, no control, until she's set down.
    const control = playing && alive && !this.ride;

    // 1. Look (real time: stays responsive in hitstop and slow-mo).
    if (control) cam.look(inp.mouseDX, inp.mouseDY);
    const ads = control && inp.held('Mouse2') && !c.committed && !v.busy && this.arsenal.allowsAim;
    player.aiming = ads;
    if (control && !v.busy && !this.arsenal.busy && inp.wheel !== 0) this.arsenal.cycle(Math.sign(inp.wheel));
    const gun = this.gun;

    // Parry (V): Justice's unbinding. Committed: a whiff leaves you open.
    this.parry.update(simDt);
    if (control && inp.justPressed('KeyV')) {
      if (!this.save.unbound.includes('parry')) {
        if (this.clock.realElapsed - this.boundToastT > 3) this.hud.toast('Still bound. (Justice frees the parry.)', 2);
        this.boundToastT = this.clock.realElapsed;
      } else if (!c.committed && !v.busy && !this.arsenal.busy && this.parry.start()) this.synth.sfx('swing', 0.7);
    }
    // Heal (Q): committed, slow, interrupted by damage.
    if (control && inp.justPressed('KeyQ') && !c.committed && !gun.reloading && !this.arsenal.busy && !this.parry.busy) {
      if (v.startHeal()) this.synth.sfx('healStart');
      else if (v.healCharges <= 0) this.hud.toast(`no heals left: rest at ${this.restLabel}`);
    }
    // Rest (E) at the checkpoint, or the nearest lantern in a generated level.
    const rests = this.world?.restPoints;
    let restAt = -1;
    if (rests) {
      rests.forEach((r, i) => {
        if (Math.hypot(c.pos.x - r.pos.x, c.pos.z - r.pos.z) < 3.2 && Math.abs(c.pos.y - r.pos.y) < 2) restAt = i;
      });
    }
    const cp = this.world?.checkpoint;
    const nearCheckpoint = alive && (rests ? restAt >= 0 : !!cp && Math.hypot(c.pos.x - cp.x, c.pos.z - cp.z) < 3.2);
    let usedE = false;
    if (control && nearCheckpoint && !usedE && inp.justPressed('KeyE') && !c.committed) {
      if (restAt >= 0) this.lastRest = restAt;
      this.rest();
      usedE = true;
    }
    // Interactables (E): the shortcut door, the exit, caches. The nearest one with a prompt wins.
    let near: { it: NonNullable<BuiltWorld['interactables']>[number]; text: string } | null = null;
    let nearD = Infinity;
    for (const it of this.world?.interactables ?? []) {
      it.update?.(simDt);
      const d = Math.hypot(c.pos.x - it.pos.x, c.pos.z - it.pos.z);
      if (!alive || d > it.radius || d >= nearD || Math.abs(c.pos.y - it.pos.y) > 2.5) continue;
      const text = it.prompt(c.pos);
      if (text) {
        near = { it, text };
        nearD = d;
      }
    }
    if (control && near && !usedE && inp.justPressed('KeyE') && !c.committed && near.it.usable(c.pos)) {
      const before = this.world;
      const toast = near.it.use(c.pos);
      // A gate rebuilt the world under us: this frame's player is gone.
      if (this.world !== before) return;
      if (toast) this.hud.toast(toast, 3);
      this.synth.sfx('rest', 0.5);
      if (this.world?.exited) {
        this.nextLevel();
        return;
      }
    }
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
    const wantsRoll = control && this.rollBuffer > 0 && !v.busy && !this.arsenal.blocksRoll && !this.parry.busy;
    // Bound, a roll always goes through (stamina or not): that's the rule.
    const breaksFree = control && this.rollBuffer > 0 && this.binding.active && alive;
    // The chain-break dash (X), once the Devil has fallen.
    this.dashCd = Math.max(0, this.dashCd - simDt);
    let wantsDash = false;
    if (control && inp.justPressed('KeyX')) {
      if (!this.save.unbound.includes('dash')) {
        if (this.clock.realElapsed - this.boundToastT > 3) this.hud.toast('Still chained. (The Devil frees the dash.)', 2);
        this.boundToastT = this.clock.realElapsed;
      } else wantsDash = this.dashCd <= 0 && !v.busy && !this.arsenal.blocksRoll && !this.parry.busy && (v.canRoll() || this.binding.active);
    }
    player.move(simDt, {
      x: ax,
      y: ay,
      sprint: control && (inp.held('ShiftLeft') || inp.held('ShiftRight')) && v.canSprint(),
      rollPressed: (wantsRoll && v.canRoll()) || breaksFree,
      dashPressed: wantsDash,
      speedMul:
        (ads ? tuning.player.adsSpeedMul : 1) *
        (gun.reloading ? tuning.player.reloadSpeedMul : 1) *
        this.arsenal.moveMul *
        (v.healing ? tuning.vitals.healMoveMul : 1) *
        (this.parry.busy ? 0.35 : 1) *
        (this.binding.active ? 0 : 1) *
        tuning.foes.hoard.weightMoveMul ** this.burden *
        (alive ? 1 : 0),
      rollMul: tuning.foes.hoard.weightRollMul ** this.burden,
      camYaw: cam.yaw,
    });
    if (wasState !== 'roll' && c.state === 'roll') {
      this.rollBuffer = 0;
      this.arsenal.onRoll();
      this.noise(tuning.foes.noise.roll);
      if (c.dashing) {
        v.stamina = Math.max(0, v.stamina - tuning.dash.staminaCost);
        this.dashCd = tuning.dash.cooldown;
        this.synth.sfx('chainSnap');
      } else v.spendRoll();
      this.synth.sfx('roll');
      if (this.binding.roll() === 'broken') {
        this.synth.sfx('chainBreak');
        this.fx.sparksAt(this.chest, _o.set(0, 1, 0), 0xd8d0c4, 14, 5);
        if (this.binding.broken === 1) this.hud.toast('The binding breaks. One roll always does: you could always have walked away.', 3.5);
      }
    }
    // The dash breaks any Thrall chain it passes through (swept: it moves a long way each frame).
    if (c.dashing && c.state === 'roll') {
      for (const e of this.enemies.enemies) {
        if (!(e instanceof Thrall) || !e.chain?.intact) continue;
        const ch = e.chain;
        if (sweepCrosses(this.dashFrom.x, this.dashFrom.z, c.pos.x, c.pos.z, ch.a.x, ch.a.z, ch.b.x, ch.b.z, 0.7) && Math.abs(c.pos.y + 1 - ch.a.y) < 1.4) {
          ch.takeDamage({ amount: 9999, crit: false, point: c.pos.clone(), dir: c.vel.clone().normalize(), knockback: 0, stagger: 0 });
          this.stats.chainsBroken++;
          this.fx.sparksAt(_o.copy(c.pos).setY(c.pos.y + 1), _o2.set(0, 1, 0), 0xd8d0c4, 16, 6);
        }
      }
    }
    this.dashFrom.copy(c.pos);
    if (this.ride && simDt > 0) this.carry(simDt);
    if (simDt > 0 && alive) this.collapse(simDt);
    // The binding holds, then strikes.
    if (simDt > 0 && this.binding.update(simDt) === 'struck') this.hurtPlayer(this.binding.damage, this.bindFrom, this.binding.knockback);
    this.coil.visible = this.binding.active && alive;
    if (this.coil.visible) {
      const k = this.binding.k;
      this.coil.position.copy(c.pos).setY(c.pos.y + 0.75 + 0.15 * Math.sin(this.clock.elapsed * 18));
      this.coil.scale.setScalar(1 - 0.5 * k);
      this.coil.rotation.y = this.clock.elapsed * (3 + 9 * k);
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
        const m = this.money;
        const note = this.pollenDrop.amount > 0 ? `Your ${this.pollenDrop.amount} ${m.name} lie where you fell. Reach them before you die again.` : `You had no ${m.name} to lose.`;
        this.menus.showDeath(true, note);
        this.input.exitLock();
      }
    }

    // 3. Targets move, then the broad-phase updates so this frame's shots see them where they're drawn.
    this.chest.copy(player.biped.chest);
    for (const d of this.dummies) d.update(simDt, this.renderer.camera);
    this.enemies.update(simDt, this.enemyWorld);
    this.world?.update?.(simDt);
    if (simDt > 0) this.noises.length = 0;
    if (simDt > 0) this.physics.step();

    // 4. Camera + crosshair ray.
    cam.update(player.pos, ads, realDt, simDt, this.clock.realElapsed);
    const overviewBounds = this.zone?.layout.bounds ?? this.world?.bounds;
    if (tuning.debug.overview && overviewBounds) {
      // Debug: look straight down on the whole zone or level.
      const b = overviewBounds;
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
      !v.busy && !this.parry.busy,
    );
    // The parry: the weapon snaps up across the body to meet the blow.
    if (this.parry.busy) {
      const k = this.parry.active ? 1 : Math.max(0, 1 - (this.parry.t - tuning.parry.window) / tuning.parry.recover);
      this.gun.pose.tilt -= 0.9 * k;
      this.gun.pose.drop -= 0.08 * k;
    }
    // Healing lowers the weapon.
    this.healEnv = damp(this.healEnv, v.healing ? 1 : 0, 14, simDt);
    this.gun.pose.drop += this.healEnv * 0.18;
    this.gun.pose.tilt += this.healEnv * 0.5;
    this.projectiles.update(simDt, this.gunCtx);
    // Not collectible while dead (the killing blow can land the same frame the drop appears).
    const recovered = v.dead ? 0 : this.pollenDrop.update(simDt, c.pos, tuning.vitals.pollenPickupRadius);
    // Coin on the floor: it pays, and it weighs (the Devil's rule, mid-fight).
    const piles = v.dead ? 0 : this.coins.update(c.pos, tuning.foes.coinPile.pickupRadius);
    if (piles > 0) {
      const pay = piles * tuning.foes.coinPile.pentacles;
      v.currency += pay;
      this.burden = Math.min(tuning.foes.hoard.weightMax, this.burden + piles);
      this.stats.coinsTaken += piles;
      this.synth.sfx('coinJingle');
      this.hud.toast(`${this.money.glyph} +${pay}. Heavy.`, 1.6);
    }
    if (recovered > 0) {
      v.currency += recovered;
      this.synth.sfx('pollen');
      this.hud.toast(`${this.money.name} recovered  ${this.money.glyph} +${recovered}`, 2);
    }
    const zone = this.zone;
    const cached = zone && !v.dead ? zone.cache.update(simDt, c.pos) : 0;
    if (cached > 0) {
      v.currency += cached;
      this.synth.sfx('pollen');
      this.synth.sfx('rest', 0.6);
      this.hud.toast(`pollen cache  ✿ +${cached}`, 2.5);
    }

    // 6. Animate rig + weapon.
    this.limbs.begin();
    this.ghostLimbs.begin();
    player.animate(simDt, this.aimPoint, cam.aimOrigin, cam.adsAmount, this.gun.pose);
    player.draw(this.limbs, simDt);
    this.arsenal.afterAnimate(this.gunCtx);
    this.enemies.draw(this.limbs, this.ghostLimbs);
    this.limbs.end();
    this.ghostLimbs.end();

    this.renderer.followShadow(player.pos);
    this.colliderDebug.update(this.physics, tuning.debug.showHitboxes);

    this.fx.update(simDt);

    // 7. HUD.
    const held = this.gun;
    const sword = this.arsenal.sword;
    const swordMode = sword?.mode === 'sword';
    this.hud.setSpread(held.displaySpread, this.renderer.camera.fov, alive && !c.committed && !held.reloading && !this.arsenal.busy && !v.busy && !swordMode);
    const name = sword ? `${held.def.name} · ${sword.switching ? '…' : sword.mode}${sword.stage.name !== 'edge restored' ? ` (${sword.stage.name})` : ''}` : held.def.name;
    this.hud.setAmmo(name, held.mag, held.magSize, held.reserve, held.reloadProgress, !!sword);
    this.hud.setCharges(held.mag, held.def.magSize, !!sword && alive);
    this.hud.setSlots(this.arsenal.guns.map((g) => g.def.name), this.arsenal.index);
    this.hud.setVitals(v.health, v.maxHealth, v.stamina, tuning.vitals.maxStamina, v.exhausted, v.healCharges, v.maxCharges, v.currency, this.money.glyph, this.burden);
    const elite = this.enemies.activeElite;
    this.hud.setBoss(elite ? elite.name : null, elite ? elite.health / elite.maxHealth : 0);
    if (nearCheckpoint && !c.committed) this.hud.prompt(`E: rest at ${this.restLabel}`);
    else if (near && !c.committed) this.hud.prompt(near.text);
    else this.hud.prompt(null);
    const labels = [...(tuning.debug.showAI ? this.aiLabels() : []), ...(tuning.debug.showGraph && this.level ? this.roomLabels(this.level) : [])];
    this.hud.setLabels(labels.length ? labels : null);
    if (this.level)
      this.minimap.drawLevel(this.level, tuning.debug.showGraph, c.pos, [
        ...this.dummies.map((d) => ({ x: d.base.x, z: d.base.z, alive: d.alive })),
        ...this.enemies.enemies.map((e) => ({ x: e.center.x, z: e.center.z, alive: e.alive })),
      ]);
    else this.minimap.draw(this.zone?.layout ?? null, tuning.debug.showGraph, c.pos, this.enemies.enemies.map((e) => ({ x: e.center.x, z: e.center.z, alive: e.alive })));
    this.hud.update(realDt);
    this.hud.setRange(this.layout === 'range' ? this.rangeText() : null);
    const info = this.renderer.renderer.info;
    const lv = this.level;
    const gen = lv
      ? `${this.dim.name} L${this.levelIndex + 1} · ${lv.generated.script.setPiece.id} · gen ${lv.report.ok ? 'ok' : 'FAILED'} in ${lv.report.attempts} attempt${lv.report.attempts > 1 ? 's' : ''} (${lv.report.ms.toFixed(1)} ms)` +
        (lv.report.ok ? '' : `\n  ${lv.report.failures[lv.report.failures.length - 1]?.join('; ')}`) +
        '\n'
      : '';
    this.hud.setStats(
      `seed ${this.zone || lv ? this.zoneSeed : this.seed}  ${this.layout}\n` +
        gen +
        `fps ${this.fps.toFixed(0)}  draws ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(1)}k\n` +
        `state ${c.state}${c.grounded ? '' : ' (air)'}${c.invulnerable ? ' i-frames' : ''}  ` +
        `speed ${Math.hypot(c.vel.x, c.vel.z).toFixed(1)}` +
        (tuning.debug.slowmo ? `\nSLOW-MO ${tuning.debug.slowmoScale}×` : '') +
        (tuning.debug.godMode ? '\nGOD MODE' : ''),
    );
  }

  /** Kit labels over each room (debug, with the map on M). */
  private roomLabels(lv: LevelWorld) {
    const cam = this.renderer.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const out: { x: number; y: number; text: string }[] = [];
    for (const r of lv.generated.space.rooms) {
      const nd = lv.generated.graph.nodes[r.node];
      const p = _o.set(r.x, r.y + 3, r.z).project(cam);
      if (p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) continue;
      out.push({ x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, text: `${nd.index >= 0 ? nd.index : 'b'} ${nd.kind}${nd.template ? ` · ${nd.template}` : ''} · ${r.kit}` });
    }
    return out;
  }

  private aiLabels() {
    const cam = this.renderer.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const out: { x: number; y: number; text: string }[] = [];
    for (const e of this.enemies.enemies) {
      if (!e.group.visible) continue;
      const p = e.labelPos(_o).project(cam);
      if (p.z > 1) continue;
      out.push({ x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, text: e.label });
    }
    return out;
  }
}
