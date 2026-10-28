// A v2 humanoid enemy: kinematic capsule + HumanoidRig + state machine.
//   idle (stand / patrol / ambush) → alert → approach ⇄ attack (wind-up → active → recover) → …
//   search (go to a noise) · return (leash: walk home and heal) · stagger · dead
// Sighted enemies see and hear gunfire; the Blindfold hears only, and feels you up close. Every attack is
// telegraphed by pose, magenta glow and sound; a shield turns blows from the front except during and after a swing.
import * as THREE from 'three';
import { angleDelta, clamp, damp, smoothstep } from '../core/math';
import type { Rng } from '../core/rng';
import { G, groups, Physics, RAPIER, type DamageInfo, type Damageable } from '../physics/world';
import type { LimbRenderer } from '../render/limbs';
import { tuning } from '../tuning';
import type { EnemyWorld, Hostile } from './enemy';
import { attackTimeline, fleeHeading, guards, inArc, leashBroken, loudest, pickAttack, slamCentre, type AttackTune, type FoeTune, type TimelinePoint } from './foe-ai';
import { blankPose, lerpPose, mirrorPose, type ArmPose, type FoePlan } from './foes';
import { HumanoidRig } from './humanoid';
import { BeastRig, type FoeRig } from './beast';

export type FoeState = 'idle' | 'alert' | 'approach' | 'search' | 'return' | 'attack' | 'stagger' | 'dead';
/** Idle behaviour: stand guard, pace, crouch in ambush, or hold the throne room (wakes when you walk in). */
export type FoeIdle = 'stand' | 'patrol' | 'ambush' | 'throne';

const MOVE_GROUPS = groups(G.ENEMY_BODY, G.WORLD | G.ENEMY_BODY | G.PLAYER);
const BODY_GROUPS = groups(G.ENEMY_BODY, G.WORLD | G.PLAYER | G.ENEMY_BODY);
const SIGHT = groups(G.QUERY, G.WORLD);

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _to = new THREE.Vector3();
const _des = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _down = new THREE.Vector3(0, -1, 0);
/** A shield (off hand) swung wide and low, edge-on: the guard open after a swing (hand position, then angles). */
const GUARD_HAND = [-0.46, -0.26, -0.02];
const GUARD_OFF = [-0.5, 1.25, -0.3];

export class Foe implements Damageable, Hostile {
  readonly plan: FoePlan;
  readonly rig: FoeRig;
  protected body: RAPIER.RigidBody;
  protected collider: RAPIER.Collider;
  protected kcc: RAPIER.KinematicCharacterController;
  protected hitboxes: { col: RAPIER.Collider; at: THREE.Vector3 }[] = [];
  protected readonly halfH: number;
  protected readonly radius: number;
  /** Capsule centre and the ground point under it. */
  readonly center = new THREE.Vector3();
  readonly ground = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  protected push = new THREE.Vector3();
  protected vy = 0;
  yaw = 0;
  state: FoeState = 'idle';
  protected stateT = 0;
  health = 0;
  protected poise = 0;
  protected sincePoise = 10;
  protected flash = 0;
  protected glow = 0;
  /** The attack in progress, its timeline point, and which swings have already landed (or been dodged). */
  attack: string | null = null;
  protected tl: TimelinePoint | null = null;
  protected dealt = new Set<number>();
  protected cooldowns: Record<string, number> = {};
  protected gap = 0;
  protected perceiveT = 0;
  sees = false;
  protected dist = 99;
  protected lostT = 0;
  readonly lastKnown = new THREE.Vector3();
  readonly searchTarget = new THREE.Vector3();
  /** A Blindfold cuts once at the spot it heard you, when it gets there (a new noise sends it to cut again). */
  private cutThere = false;
  protected provoked = false;
  protected strafeSign = 1;
  protected strafeT = 0;
  protected avoidT = 0;
  protected avoidYaw = 0;
  protected deadT = 0;
  protected patrolT = 0;
  /** Hit and run: time left falling back after an attack. */
  protected fallBackT = 0;
  protected alerted = false;
  protected readonly pose = blankPose();
  slain = false;
  readonly home = new THREE.Vector3();
  homeYaw = 0;
  onKilled: (e: Hostile) => void = () => {};
  /**
   * The Moon: a reflection. It casts no shadow and makes no footsteps (the tells); its attacks wind up like the real
   * thing but touch nothing; one hit dispels it, for no reward.
   */
  illusion = false;
  /** The world it last updated in (for footstep sounds between updates). */
  protected lastWorld: EnemyWorld | null = null;
  private ghostWorld: EnemyWorld | null = null;

  readonly id: string;

  constructor(
    plan: FoePlan,
    protected scene: THREE.Scene,
    protected physics: Physics,
    pos: THREE.Vector3,
    yaw: number,
    readonly idle: FoeIdle,
    protected rng: Rng,
  ) {
    this.plan = plan;
    this.id = plan.id;
    this.rig = plan.beast ? new BeastRig(scene, physics, plan, plan.beast) : new HumanoidRig(scene, physics, plan);
    const s = this.rig.s;
    this.radius = plan.radius * s;
    this.halfH = this.rig.capsuleHalf;
    const w = physics.world;
    this.body = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + this.radius + this.halfH, pos.z));
    this.collider = w.createCollider(RAPIER.ColliderDesc.capsule(this.halfH, this.radius).setCollisionGroups(BODY_GROUPS), this.body);
    this.kcc = w.createCharacterController(0.02);
    this.kcc.enableAutostep(0.45, 0.15, false);
    this.kcc.enableSnapToGround(0.5);
    this.kcc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.kcc.setSlideEnabled(true);
    for (const hb of this.plan.hitboxes) {
      const col = physics.addHitbox(RAPIER.ColliderDesc.ball(hb.r * s), { part: hb.part, owner: this });
      this.hitboxes.push({ col, at: new THREE.Vector3(hb.at[0] * s, hb.at[1] * s, hb.at[2] * s) });
    }
    this.home.copy(pos);
    this.homeYaw = yaw;
    // Real things make footsteps (soft, near you); reflections don't: the tell.
    this.rig.onFootstep = (p) => {
      const w = this.lastWorld;
      if (this.illusion || !w || !this.alive) return;
      if (Math.hypot(w.playerPos.x - p.x, w.playerPos.z - p.z) < 16) w.sound('foeStep', p);
    };
    this.respawn();
  }

  /** Make this a reflection: no shadow (body and gear), harmless, dispelled by one hit. */
  makeIllusion() {
    this.illusion = true;
    this.rig.group.traverse((o) => {
      o.castShadow = false;
    });
  }

  /** The world as a reflection sees it: its swings and rings show, but nothing it does can touch her. */
  private ghost(w: EnemyWorld): EnemyWorld {
    if (this.ghostWorld && (this.ghostWorld as unknown as { real: EnemyWorld }).real === w) return this.ghostWorld;
    const hz = w.hazards;
    const hazards = new Proxy(hz, {
      get(t, p) {
        if (p === 'knife' || p === 'lob' || p === 'cup') return () => {};
        if (p === 'wave')
          return (o: THREE.Vector3, yaw: number, width: number, gapAt: number, gapW: number, speed: number, dist: number) => t.wave(o, yaw, width, gapAt, gapW, speed, dist, 0, 0);
        if (p === 'verdict') return (at: THREE.Vector3, r: number, d: number) => t.verdict(at, r, d, 0, 0);
        const v = (t as unknown as Record<string | symbol, unknown>)[p];
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
      },
    });
    const ghost = Object.create(w) as EnemyWorld & { real: EnemyWorld };
    Object.assign(ghost, {
      real: w,
      hazards,
      hurtPlayer: () => false,
      bindPlayer: () => false,
      dropCoins: () => {},
      ignite: () => {},
      summon: () => null,
      healPlayer: () => {},
    });
    this.ghostWorld = ghost;
    return ghost;
  }

  get cfg(): FoeTune {
    return this.plan.tune();
  }
  get group() {
    return this.rig.group;
  }
  get name() {
    return this.plan.name;
  }
  get alive() {
    return this.state !== 'dead';
  }
  get elite() {
    return this.plan.elite;
  }
  get aggroed() {
    return this.alive && this.state !== 'idle' && this.state !== 'return';
  }
  get maxHealth() {
    return this.cfg.health;
  }
  get reward() {
    return this.illusion || this.dismissed ? 0 : this.cfg.reward;
  }
  /** Common enemies (even elites like the Page) don't take over the boss bar. */
  get bar() {
    return false;
  }
  /** Court cards escalate in phases; everyone else stays in phase 0. */
  phaseIdx = 0;
  /** Summoned by a court card (gone, not respawned, when you rest). */
  summoned = false;
  /** Who summoned it (a squad's King, a reflection's original): when they fall, it goes too. */
  maker: Hostile | null = null;
  /** Gone with its maker: it fades for nothing. */
  dismissed = false;
  get armorMul() {
    return 0.25;
  }
  /** The current attack phase (for labels and tests). */
  get phase() {
    return this.tl?.phase ?? null;
  }

  labelPos(out: THREE.Vector3) {
    return out.copy(this.ground).addScaledVector(_up, this.plan.height + 0.35);
  }

  respawn() {
    this.state = 'idle';
    this.stateT = 0;
    this.health = this.cfg.health;
    this.poise = this.cfg.poise;
    this.flash = 0;
    this.glow = 0;
    this.attack = null;
    this.tl = null;
    this.cooldowns = {};
    this.gap = 0;
    this.fallBackT = 0;
    this.deadT = 0;
    this.provoked = false;
    this.alerted = false;
    this.sees = false;
    this.lostT = 0;
    this.vel.set(0, 0, 0);
    this.push.set(0, 0, 0);
    this.vy = 0;
    this.yaw = this.homeYaw;
    this.center.set(this.home.x, this.home.y + this.radius + this.halfH, this.home.z);
    this.body.setTranslation(this.center, true);
    this.body.setNextKinematicTranslation(this.center);
    this.collider.setEnabled(true);
    for (const h of this.hitboxes) h.col.setEnabled(true);
    this.ground.copy(this.home);
    this.rig.reset(this.ground, this.yaw);
    this.computePose();
    this.rig.update(0, this.ground, this.yaw, this.vel, this.pose, false);
    this.syncHitboxes();
  }

  /** Move it to `p` (on the ground) at once: the Queen of Cups trading places with a reflection. */
  placeAt(p: THREE.Vector3) {
    this.settle = true;
    this.center.set(p.x, p.y + this.radius + this.halfH, p.z);
    this.body.setTranslation(this.center, true);
    this.body.setNextKinematicTranslation(this.center);
    this.ground.copy(p);
    this.vel.set(0, 0, 0);
    this.rig.reset(this.ground, this.yaw);
    this.syncHitboxes();
  }

  despawn() {
    this.state = 'dead';
    this.collider.setEnabled(false);
    for (const h of this.hitboxes) h.col.setEnabled(false);
    this.rig.group.visible = false;
  }

  protected set(s: FoeState) {
    this.state = s;
    this.stateT = 0;
  }

  /** Told where you are (a Page's whistle, a nearby fight). */
  alert(at: THREE.Vector3) {
    if (!this.alive || this.state === 'attack' || this.state === 'stagger') return;
    this.lastKnown.copy(at);
    this.searchTarget.copy(at);
    this.cutThere = false;
    if (this.state === 'idle' || this.state === 'return' || this.state === 'search') this.set(this.plan.senses === 'sound' ? 'search' : 'approach');
  }

  /** Parried: the swing is turned and it reels (the riposte window). */
  parried() {
    if (!this.alive) return;
    this.endAttack();
    this.set('stagger');
    this.flash = 0.15;
  }

  blocks(dir: THREE.Vector3): boolean {
    if (!this.plan.shield || !this.alive || this.state === 'stagger') return false;
    // Open during and after its own swing: that's the punish window.
    if (this.state === 'attack' && this.tl && this.tl.phase !== 'windup') return false;
    return guards(this.yaw, dir.x, dir.z, this.cfg.guardConeDeg ?? 120);
  }

  takeDamage(info: DamageInfo): boolean {
    if (!this.alive) return false;
    // A reflection: one hit and it's gone.
    if (this.illusion) {
      this.health = 0;
      this.die();
      return true;
    }
    const c = this.cfg;
    this.health -= info.amount;
    this.flash = tuning.foes.hitFlashTime;
    const heavy = this.plan.radius >= 0.4 ? 3 : 1;
    this.push.addScaledVector(_v.set(info.dir.x, 0, info.dir.z).normalize(), (info.knockback * 1.6) / heavy);
    this.provoked = true;
    if (this.health <= 0) {
      this.rig.setFallDir(info.dir as THREE.Vector3);
      this.die();
      return true;
    }
    this.poise -= info.stagger;
    this.sincePoise = 0;
    if (this.poise <= 0 && this.state !== 'stagger') {
      this.poise = c.poise;
      this.endAttack();
      this.set('stagger');
    }
    return false;
  }

  /**
   * It fell off the stage (through a fallen deck, off an edge). A common enemy dies of the fall. A court card or boss is
   * set back down on solid ground near where it stood, fall checked, reeling. (It used to be put back at home with its
   * fall speed kept: over a hole, it fell again, faster each time, forever.)
   */
  protected fellOff(w: EnemyWorld) {
    this.vy = 0;
    this.push.set(0, 0, 0);
    this.vel.set(0, 0, 0);
    if (!this.bar) {
      this.health = 0;
      this.die();
      this.rig.group.visible = false;
      return;
    }
    const at = w.safeGround?.(this.home) ?? this.home;
    this.placeAt(at);
    this.endAttack();
    this.set('stagger');
  }

  /** 0 while a corpse lies, rising to 1 as it sinks away. */
  get sink() {
    if (this.state !== 'dead') return 0;
    const T = tuning.foes.corpseTime;
    return smoothstep(T - 1.2, T, this.deadT);
  }

  /** Its maker fell: it goes with them (no reward). */
  dismiss() {
    if (!this.alive) return;
    this.dismissed = true;
    this.health = 0;
    this.die();
  }

  protected die() {
    this.set('dead');
    this.deadT = 0;
    this.endAttack();
    this.collider.setEnabled(false);
    for (const h of this.hitboxes) h.col.setEnabled(false);
    if (this.elite) this.slain = true;
    this.onKilled(this);
  }

  protected hazards: EnemyWorld['hazards'] | null = null;

  protected endAttack() {
    this.attack = null;
    this.tl = null;
    this.hazards?.hideRing(this);
  }

  update(dt: number, real: EnemyWorld) {
    this.lastWorld = real;
    const w = this.illusion ? this.ghost(real) : real;
    this.hazards = w.hazards;
    if (dt <= 0) {
      this.syncVisuals();
      return;
    }
    const c = this.cfg;
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.gap = Math.max(0, this.gap - dt);
    this.fallBackT = Math.max(0, this.fallBackT - dt);
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this.sincePoise += dt;
    if (this.sincePoise > 1.5) this.poise = Math.min(c.poise, this.poise + c.poiseRegen * dt);

    if (this.state === 'dead') {
      this.deadT += dt;
      this.vel.multiplyScalar(Math.exp(-6 * dt));
      // Lie still, then sink into the ground (the whole body together: limbs and all).
      _v.copy(this.ground).addScaledVector(_up, -this.sink * (this.plan.height * 0.45 + 0.3));
      this.rig.update(dt, _v, this.yaw, this.vel, this.pose, true);
      this.rig.group.visible = this.sink < 1;
      this.rig.setGlow(0, false);
      return;
    }

    _to.subVectors(w.playerPos, this.ground).setY(0);
    this.dist = _to.length();
    const playerFar = Math.hypot(w.playerPos.x - this.home.x, w.playerPos.z - this.home.z);
    // Asleep: idle and far beyond notice. Hidden, and skipped (they're lost in the fog). Not a boss: you see it waiting
    // the whole way in (hiding it made it pop in as you walked up).
    if (this.state === 'idle' && playerFar > tuning.foes.sleepDistance && !this.cfg.wakeRadius) {
      this.rig.group.visible = false;
      return;
    }
    this.rig.group.visible = true;
    this.perceive(dt, w);
    const toYaw = Math.atan2(-_to.x, -_to.z);
    const dyaw = angleDelta(this.yaw, toYaw);
    _des.set(0, 0, 0);
    let turnTo: number | null = null;
    let turnRate = c.turnRate;

    switch (this.state) {
      case 'idle':
        this.idleMove(dt, w);
        break;
      case 'alert': {
        turnTo = toYaw;
        turnRate *= 1.5;
        const wait = this.idle === 'ambush' ? 0.75 : 0.45;
        if (this.stateT > wait) this.set(this.plan.senses === 'sound' ? 'search' : 'approach');
        break;
      }
      case 'approach':
        turnTo = this.approach(dt, w, dyaw, toYaw);
        break;
      case 'search': {
        _v.subVectors(this.searchTarget, this.ground).setY(0);
        const d = _v.length();
        // A Blindfold comes to where it heard you and cuts there (it used to walk up beside a quiet player and wait).
        const cut = this.plan.senses === 'sound' && !this.cutThere ? Object.keys(c.attacks)[0] : null;
        if (cut && d <= c.attacks[cut].range * 0.8) {
          this.cutThere = true;
          this.begin(cut, w);
          break;
        }
        if (d > 1.2) {
          this.steer(_v.x / d, _v.z / d, c.runSpeed, w, dt);
          turnTo = Math.atan2(-_v.x, -_v.z);
          this.stateT = 0;
        } else if (this.stateT > (c.searchTime ?? 2)) this.set('return');
        break;
      }
      case 'return': {
        _v.subVectors(this.home, this.ground).setY(0);
        const d = _v.length();
        if (d > 0.8) {
          this.steer(_v.x / d, _v.z / d, c.speed, w, dt);
          turnTo = Math.atan2(-_v.x, -_v.z);
        } else {
          // Home: the fight resets.
          this.health = c.health;
          turnTo = this.homeYaw;
          if (Math.abs(angleDelta(this.yaw, this.homeYaw)) < 0.1) this.set('idle');
        }
        break;
      }
      case 'attack':
        turnTo = this.attackStep(dt, w, toYaw);
        break;
      case 'stagger':
        if (this.stateT >= c.staggerTime) this.set('approach');
        break;
    }
    if (!w.playerAlive && (this.state === 'approach' || this.state === 'search')) this.set('return');

    if (turnTo !== null) this.yaw += clamp(angleDelta(this.yaw, turnTo), -turnRate * dt, turnRate * dt);
    if (this.state !== 'attack') {
      this.vel.x = damp(this.vel.x, _des.x, c.accel * 0.25, dt);
      this.vel.z = damp(this.vel.z, _des.z, c.accel * 0.25, dt);
    }
    this.push.multiplyScalar(Math.exp(-6 * dt));
    this.move(dt);
    if (this.ground.y < this.home.y - tuning.foes.fallDepth) {
      this.fellOff(w);
      if (!this.alive) return;
    }
    this.computePose();
    this.rig.update(dt, this.ground, this.yaw, this.vel, this.pose, false);
    this.glow = this.state === 'attack' && this.tl?.phase === 'windup' ? this.glow : damp(this.glow, 0, 12, dt);
    this.syncVisuals();
  }

  /** Sight (throttled) and hearing. Sets `sees`, and moves idle/searching enemies into the fight. */
  protected perceive(dt: number, w: EnemyWorld) {
    const c = this.cfg;
    this.perceiveT -= dt;
    if (this.perceiveT <= 0) {
      this.perceiveT = 0.2;
      if (this.plan.senses === 'sound') {
        this.sees = w.playerAlive && this.dist < (c.senseRange ?? 2.4) && Math.abs(w.playerPos.y - this.ground.y) < 2;
      } else {
        const range = c.sightRange ?? 24;
        const facing = this.state !== 'idle' || inArc(this.yaw, _to.x, _to.z, 150) || this.dist < 4;
        this.sees = w.playerAlive && this.dist < range && facing && this.lineOfSight(w);
      }
    }
    if (this.sees) {
      this.lastKnown.copy(w.playerPos);
      this.searchTarget.copy(w.playerPos);
      this.lostT = 0;
    } else this.lostT += dt;

    const heard = w.playerAlive ? loudest(this.ground.x, this.ground.y + 1, this.ground.z, w.noises) : null;
    if (heard) {
      this.searchTarget.set(heard.x, heard.y, heard.z);
      this.lastKnown.copy(this.searchTarget);
      this.cutThere = false;
    }
    if (this.provoked) {
      this.provoked = false;
      this.lastKnown.copy(w.playerPos);
      this.searchTarget.copy(w.playerPos);
      if (this.state === 'idle' || this.state === 'search' || this.state === 'return' || this.state === 'alert') this.set('approach');
    }
    // The throne room: a court card rises when you walk in. A boss waits for you to step into its arena (seeing you
    // down the approach, it used to start before you'd arrived).
    const wakeR = c.wakeRadius ?? 17;
    const throne = this.idle === 'throne' && w.playerAlive && this.dist < wakeR && Math.abs(w.playerPos.y - this.ground.y) < 3;
    if (this.state === 'idle' && (throne || (!c.wakeRadius && (this.sees || heard)))) this.wake(w);
    else if (this.plan.senses === 'sound' && heard && (this.state === 'return' || this.state === 'search')) this.set('search');
    // Found you again while searching (or heading home): back into the fight. (Without this, a Blindfold that lost
    // you walked right up to you and stood there.)
    else if ((this.state === 'return' || this.state === 'search') && this.sees && !leashBroken(this.home.x, this.home.z, w.playerPos.x, w.playerPos.z, this.cfg.leash)) this.set('approach');
  }

  protected wake(w: EnemyWorld) {
    this.set('alert');
    w.sound(this.idle === 'ambush' ? 'ambushTell' : 'alert', this.center);
    // The Page of Swords whistles the room awake.
    if (this.plan.herald && !this.alerted && this.sees) {
      this.alerted = true;
      w.sound('whistle', this.center);
      w.alertNear(this.center, this.cfg.alertRadius ?? 30, w.playerPos, this);
    }
  }

  protected idleMove(dt: number, w: EnemyWorld) {
    if (this.idle !== 'patrol') return;
    // Pace back and forth across the room, perpendicular to the way it faces.
    this.patrolT += dt;
    const s = Math.sin(this.patrolT * 0.35);
    const target = _v2.set(Math.cos(this.homeYaw), 0, -Math.sin(this.homeYaw)).multiplyScalar(s * 5).add(this.home);
    _v.subVectors(target, this.ground).setY(0);
    const d = _v.length();
    if (d > 0.4) {
      this.steer(_v.x / d, _v.z / d, this.cfg.speed * 0.6, w, dt);
      this.yaw += clamp(angleDelta(this.yaw, Math.atan2(-_v.x, -_v.z)), -3 * dt, 3 * dt);
    }
  }

  /** Close in (or hold range) and start an attack when one reaches. Returns the yaw to turn toward. */
  protected approach(dt: number, w: EnemyWorld, dyaw: number, toYaw: number): number | null {
    const c = this.cfg;
    if (leashBroken(this.home.x, this.home.z, w.playerPos.x, w.playerPos.z, c.leash)) {
      this.set('return');
      return null;
    }
    // Lost: go and look where it last knew you were.
    if (!this.sees && this.lostT > (this.plan.senses === 'sound' ? 0.6 : 3.5)) {
      this.set('search');
      return null;
    }
    const dx = _to.x / Math.max(1e-3, this.dist);
    const dz = _to.z / Math.max(1e-3, this.dist);
    const facing = Math.abs(dyaw) < 0.45;
    const choose = () => (this.gap <= 0 && facing ? pickAttack(c.attacks, this.dist, this.cooldowns, this.rng(), this.phaseIdx) : null);
    if (this.fallBackT > 0) {
      // Hit and run: back off (still facing you), then dart in again.
      this.steer(-dx - dz * this.strafeSign * 0.5, -dz + dx * this.strafeSign * 0.5, c.runSpeed, w, dt);
      return toYaw;
    }
    if (this.plan.flees) {
      // It runs, keeping its distance inside its room, and cuts only when cornered.
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 2.5 + this.rng() * 2;
        this.strafeSign *= -1;
      }
      if (this.dist < (c.holdRange ?? 14)) {
        const [fx, fz] = fleeHeading(this.ground.x, this.ground.z, w.playerPos.x, w.playerPos.z, this.home.x, this.home.z, c.leash, this.strafeSign as 1 | -1);
        this.steer(fx, fz, c.runSpeed, w, dt);
        if (this.dist < 3) {
          const a = choose();
          if (a) this.begin(a, w);
          return toYaw;
        }
        return Math.atan2(-fx, -fz);
      }
      return toYaw;
    }
    if (this.plan.ranged) {
      // Hold a range band and circle; throw when it can see you, cut if you get close.
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 1.6 + this.rng() * 1.4;
        this.strafeSign *= -1;
      }
      const hold = c.holdRange ?? 14;
      const fx = this.dist < hold - 3 ? -1 : this.dist > hold + 3 || !this.sees ? 1 : 0;
      this.steer(dx * fx - dz * this.strafeSign * 0.7, dz * fx + dx * this.strafeSign * 0.7, c.runSpeed * 0.8, w, dt);
      const a = this.sees || this.dist < 3 ? choose() : null;
      if (a) this.begin(a, w);
    } else {
      const reach = Math.min(...Object.values(c.attacks).map((a) => a.range));
      this.steer(dx, dz, this.dist > reach * 0.85 ? (this.dist > 6 ? c.runSpeed : c.speed) : 0, w, dt);
      const a = choose();
      if (a) this.begin(a, w);
    }
    return toYaw;
  }

  protected begin(name: string, w: EnemyWorld) {
    this.attack = name;
    this.tl = { phase: 'windup', hit: 0, k: 0, mirrored: false };
    this.dealt.clear();
    this.set('attack');
    w.sound(this.plan.motions[name].sound, this.center);
  }

  /** Run the attack's timeline: wind-up (track), active (commit: lunge, strike), recover (open). */
  protected attackStep(dt: number, w: EnemyWorld, toYaw: number): number | null {
    const name = this.attack!;
    const a = this.cfg.attacks[name];
    const prev = this.tl;
    const tl = attackTimeline(a, this.stateT);
    this.tl = tl;
    _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    if (tl.phase === 'done') {
      this.cooldowns[name] = a.cooldown;
      this.gap = 0.35 + this.rng() * 0.4;
      this.endAttack();
      this.set('approach');
      this.afterAttack(name);
      return null;
    }
    if (tl.phase === 'windup') this.glow = smoothstep(0, 0.6, tl.k) * (0.7 + 0.3 * Math.sin(this.stateT * (10 + tl.k * 25)));
    else if (tl.phase === 'active') this.glow = 1;
    if (tl.phase === 'windup' && tl.hit > 0 && prev?.phase !== 'windup') w.sound(this.plan.motions[name].sound, this.center);
    if (a.kind) return this.special(name, a, tl, prev, dt, w, toYaw);
    if (tl.phase === 'windup') {
      this.vel.multiplyScalar(Math.exp(-10 * dt));
      if (a.radius && !a.lob) {
        const [x, z] = slamCentre(this.ground.x, this.ground.z, this.yaw, a.reach ?? 2);
        w.hazards.ring(this, _v.set(x, this.ground.y, z), a.radius, tl.k);
      }
      return toYaw;
    }
    if (tl.phase === 'active') {
      if (prev?.phase !== 'active' || prev.hit !== tl.hit) this.strikeStart(a, w);
      this.vel.copy(_fwd).multiplyScalar(a.lunge / Math.max(0.05, a.active));
      if (!this.dealt.has(tl.hit) && !a.speed && !a.radius) {
        _v.subVectors(w.playerChest, this.rig.chest);
        const d = Math.hypot(_v.x, _v.z);
        // Never further than the model can really reach (arm and weapon, and her body's width): what you see hits.
        const reach = Math.min(a.range * 0.75 + this.radius + 0.5, this.rig.reach + tuning.foes.reachMargin);
        if (d <= reach && Math.abs(_v.y) < 1.6 && inArc(this.yaw, _v.x, _v.z, a.arcDeg)) {
          this.dealt.add(tl.hit);
          w.hurtPlayer(a.damage, this.center, a.knockback, this);
        }
      }
      return null;
    }
    this.vel.multiplyScalar(Math.exp(-8 * dt));
    return null;
  }

  /** Rank verbs (charges, volleys, verdicts) run here; returns the yaw to turn toward. Court cards override. */
  protected special(_name: string, _a: AttackTune, _tl: TimelinePoint, _prev: TimelinePoint | null, _dt: number, _w: EnemyWorld, _toYaw: number): number | null {
    return null;
  }

  /** Called when an attack finishes (the Knight falls back after striking; so does the Imp). */
  protected afterAttack(_name: string) {
    if (this.plan.hitAndRun) this.fallBackT = this.cfg.retreatTime ?? 0.8;
  }

  /** The moment a swing, slam or throw lands. */
  protected strikeStart(a: AttackTune, w: EnemyWorld) {
    if (a.lob) {
      // A lobbed pot (a Firebrand's fire): the landing ring fills as it flies; it lands where you were heading.
      const target = _v2.copy(w.playerPos).addScaledVector(w.playerVel, a.lob * 0.5);
      target.y = w.playerPos.y;
      w.hazards.lob(_v.copy(this.rig.handR), target, a.lob, 18, a.radius ?? 1.8, a.damage, a.knockback, a.ignite ?? 0);
      w.sound('lunge', this.center);
      this.dealt.add(0);
    } else if (a.radius) {
      const [x, z] = slamCentre(this.ground.x, this.ground.z, this.yaw, a.reach ?? 2);
      w.hazards.hideRing(this);
      const at = _v.set(x, this.ground.y, z);
      w.hazards.burst(at, a.radius);
      w.sound('slamImpact', at);
      w.shake(0.55, at);
      const dx = w.playerPos.x - x;
      const dz = w.playerPos.z - z;
      if (Math.hypot(dx, dz) <= a.radius && Math.abs(w.playerPos.y - this.ground.y) < 1.4) w.hurtPlayer(a.damage, at, a.knockback);
      if (a.ignite) w.ignite?.(at, a.ignite);
      this.dealt.add(0);
    } else if (a.speed) {
      // Throw from the hand toward where you're heading (a half lead).
      const from = _v.copy(this.rig.handR);
      const target = _v2.copy(w.playerChest).addScaledVector(w.playerVel, (this.dist / a.speed) * 0.5);
      const dir = target.sub(from).normalize();
      w.hazards.knife(from, dir.multiplyScalar(a.speed), a.damage, a.knockback);
      w.sound('lunge', this.center);
      this.dealt.add(0);
    } else w.sound('lunge', this.center);
  }

  protected computePose() {
    const p = this.plan;
    const out = this.pose;
    const copy = (src: ArmPose) => lerpPose(src, src, 0, out);
    if (this.state === 'attack' && this.attack && this.tl) {
      const m = p.motions[this.attack];
      const tl = this.tl;
      const dual = !!p.dualWield;
      const wind = tl.mirrored ? mirrorPose(m.windup, dual) : m.windup;
      const act = tl.mirrored ? mirrorPose(m.active, dual) : m.active;
      if (tl.phase === 'windup') {
        // Follow-ups start from the previous swing's end.
        const from = tl.hit > 0 ? (tl.mirrored ? m.active : mirrorPose(m.active, dual)) : p.ready;
        lerpPose(from, wind, smoothstep(0, 1, tl.k), out);
      } else if (tl.phase === 'active') lerpPose(wind, act, smoothstep(0, 0.7, tl.k), out);
      else lerpPose(act, p.ready, smoothstep(0.3, 1, tl.k), out);
      // A shield swings wide while it strikes and recovers: that's when it's open (blocks() agrees), so it looks it.
      if (p.shield && tl.phase !== 'windup') {
        const open =
          tl.phase === 'active' ? (m.shieldAttack ? 0 : smoothstep(0, 0.5, tl.k)) : m.shieldAttack ? smoothstep(0, 0.3, tl.k) * (1 - smoothstep(0.85, 1, tl.k)) : 1 - smoothstep(0.85, 1, tl.k);
        for (let i = 0; i < 3 && open > 0; i++) {
          out.handL[i] += (GUARD_HAND[i] - out.handL[i]) * open;
          out.off[i] += (GUARD_OFF[i] - out.off[i]) * open;
        }
      }
      return;
    }
    copy(p.ready);
    if (this.state === 'idle' && this.idle === 'ambush') {
      out.crouch = 0.85;
      out.lean = 0.5;
    } else if (this.state === 'stagger') {
      const k = 1 - this.stateT / this.cfg.staggerTime;
      out.lean = -0.35 * k;
      out.crouch = 0.4 * k;
      out.handR[1] += 0.15 * k;
    } else if (this.state === 'alert') out.lean -= 0.15 * Math.sin(Math.min(1, this.stateT / 0.4) * Math.PI);
  }

  protected lineOfSight(w: EnemyWorld) {
    const eye = _v.copy(this.ground).addScaledVector(_up, this.plan.height * 0.92);
    for (const lift of [0, 0.45]) {
      const dir = _fwd.copy(w.playerChest);
      dir.y += lift;
      dir.sub(eye);
      const d = dir.length();
      if (d < 1e-3) return true;
      dir.divideScalar(d);
      if (!w.physics.raycast(eye, dir, d, SIGHT)) return true;
    }
    return false;
  }

  /** Steering toward a direction with separation from other enemies and feeler avoidance. Writes _des. */
  protected steer(dirX: number, dirZ: number, speed: number, w: EnemyWorld, dt: number) {
    const c = this.cfg;
    _des.set(dirX, 0, dirZ);
    if (_des.lengthSq() > 1e-6) _des.normalize();
    for (const o of w.enemies) {
      if (o === this || !o.alive) continue;
      _v.subVectors(this.ground, o.center).setY(0);
      const d = _v.length();
      if (d > 1e-3 && d < c.separation) _des.addScaledVector(_v.divideScalar(d), (c.separation - d) / c.separation);
    }
    this.avoidT -= dt;
    if (this.avoidT <= 0 && _des.lengthSq() > 1e-4) {
      this.avoidT = 0.15;
      this.avoidYaw = 0;
      const base = Math.atan2(_des.x, _des.z);
      const origin = _v.copy(this.center);
      const look = this.radius + 1.2;
      const clear = (a: number) => !w.physics.raycast(origin, _fwd.set(Math.sin(a), 0, Math.cos(a)), look, SIGHT);
      if (!clear(base)) {
        for (const off of [0.7, -0.7, 1.4, -1.4]) {
          if (clear(base + off)) {
            this.avoidYaw = off;
            break;
          }
        }
      }
    }
    if (this.avoidYaw !== 0) _des.applyAxisAngle(_up, this.avoidYaw);
    if (_des.lengthSq() > 1) _des.normalize();
    _des.multiplyScalar(speed);
  }

  /** Just moved by hand: its collider catches up on the next physics step, so skip one step of movement. */
  private settle = false;

  protected move(dt: number) {
    if (this.settle) {
      this.settle = false;
      this.vy = 0;
      this.body.setNextKinematicTranslation(this.center);
      return;
    }
    if (this.vy <= 0 && this.kcc.computedGrounded()) this.vy = -2;
    else this.vy -= 30 * dt;
    const want = { x: (this.vel.x + this.push.x) * dt, y: this.vy * dt, z: (this.vel.z + this.push.z) * dt };
    this.kcc.computeColliderMovement(this.collider, want, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, MOVE_GROUPS);
    const mv = this.kcc.computedMovement();
    this.center.x += mv.x;
    this.center.y += mv.y;
    this.center.z += mv.z;
    // The character controller now and then misses the floor for a frame and lets the body sink a few centimetres;
    // left alone, an enemy could sink right through a stage. If the floor is above its feet, stand it back on top.
    const feet = this.radius + this.halfH;
    const hit = this.physics.raycast(_v.set(this.center.x, this.center.y, this.center.z), _down, feet, SIGHT);
    if (hit) {
      this.center.y += feet - hit.distance;
      if (this.vy < 0) this.vy = -2;
    }
    this.body.setNextKinematicTranslation(this.center);
    this.ground.set(this.center.x, this.center.y - this.radius - this.halfH, this.center.z);
  }

  protected syncVisuals() {
    this.rig.setGlow(this.glow, this.flash > 0);
    this.syncHitboxes();
  }

  protected syncHitboxes() {
    for (const h of this.hitboxes) h.col.setTranslation(_v.copy(h.at).applyQuaternion(this.rig.yawQuat).add(this.ground));
  }

  draw(limbs: LimbRenderer) {
    this.rig.draw(limbs);
  }

  get label() {
    return `${this.plan.name} · ${this.state}${this.attack ? ` (${this.attack} ${this.tl?.phase ?? ''})` : ''}`;
  }

  dispose() {
    this.rig.dispose(this.scene);
    for (const h of this.hitboxes) this.physics.removeCollider(h.col);
    this.physics.world.removeCharacterController(this.kcc);
    this.physics.world.removeRigidBody(this.body);
  }
}
