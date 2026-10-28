// An enemy: kinematic mover + multi-legged rig + state-machine AI.
// idle → alert → approach → windup → attack → recover (→ approach), with stagger on poise break and dead.
// Every attack has a wind-up (pose + magenta glow + sound), an active window, and a recovery punish window.
import * as THREE from 'three';
import type { SfxName } from '../audio/synth';
import { angleDelta, clamp, damp, smoothstep } from '../core/math';
import { G, groups, Physics, RAPIER, type DamageInfo, type Damageable } from '../physics/world';
import { meshOf, toonMat } from '../render/geo';
import { SIGNAL } from '../render/palette';
import { tuning } from '../tuning';
import type { Noise } from './foe-ai';
import type { Hazards } from './hazards';
import type { LimbRenderer } from '../render/limbs';
import { MultiLegRig, type RigPose } from './rig';
import { PLANS, type BodyPlan, type EnemyKind } from './types';

export type AIState = 'idle' | 'alert' | 'approach' | 'windup' | 'attack' | 'recover' | 'stagger' | 'dead';
type Attack = 'lunge' | 'spit' | 'charge' | 'butt';

/** Anything that fights the player: v1 bugs and v2 humanoids alike (the manager, HUD and game see only this). */
export interface Hostile {
  readonly alive: boolean;
  readonly elite: boolean;
  slain: boolean;
  readonly aggroed: boolean;
  readonly center: THREE.Vector3;
  health: number;
  readonly maxHealth: number;
  readonly name: string;
  readonly label: string;
  /** Currency dropped on death. */
  readonly reward: number;
  /** Shows the big health bar while it fights you (bosses and minibosses). */
  readonly bar: boolean;
  readonly group: THREE.Object3D;
  onKilled: (e: Hostile) => void;
  labelPos(out: THREE.Vector3): THREE.Vector3;
  update(dt: number, w: EnemyWorld): void;
  draw(limbs: LimbRenderer): void;
  respawn(): void;
  despawn(): void;
  dispose(): void;
  /** Told where the player is (a Page's whistle). */
  alert?(at: THREE.Vector3): void;
  /** Its blow was parried: it reels. */
  parried?(): void;
}

export interface EnemyWorld {
  physics: Physics;
  playerPos: THREE.Vector3;
  playerChest: THREE.Vector3;
  playerVel: THREE.Vector3;
  playerAlive: boolean;
  enemies: readonly Hostile[];
  /** Noises made this frame (gunfire, blades, haste). */
  noises: readonly Noise[];
  /** A boss stepped into a new phase (the arena may change: Justice's scales come down). */
  bossPhase?(phase: number): void;
  /**
   * Bring a new enemy into the fight (a King's squad); it arrives alerted. `illusion`: as a reflection (the Queen of
   * Cups' copies). `maker`: who called it up; it goes when its maker falls.
   */
  summon(id: string, pos: THREE.Vector3, yaw: number, illusion?: boolean, maker?: Hostile): Hostile | null;
  /** Solid ground for a court card or boss that fell off the stage: the standing deck nearest `near`, if any. */
  safeGround?(near: THREE.Vector3): THREE.Vector3 | null;
  /** The Knight of Cups' true cup: restore this much health. */
  healPlayer?(amount: number): void;
  /** Wake everyone within `radius` of `from` and tell them where the player is. */
  alertNear(from: THREE.Vector3, radius: number, at: THREE.Vector3, caller: Hostile): void;
  hazards: Hazards;
  /**
   * Returns true if the hit landed (false when dodged, i-framed, parried or in god mode). `source` makes a blow
   * parryable: the enemy whose weapon it is, or 'projectile' for a thrown blade. Ground strikes have none.
   */
  hurtPlayer(amount: number, from: THREE.Vector3, knockback: number, source?: Hostile | 'projectile'): boolean;
  /**
   * The Devil's binding: hold the player for `time` seconds, then strike for `damage` — unless she rolls, and one roll
   * always breaks it. Returns true if she was caught (a roll's i-frames or a parry slip it).
   */
  bindPlayer?(time: number, damage: number, knockback: number, from: THREE.Vector3, source: Hostile | null): boolean;
  /** The King of Pentacles' coin rain leaves coin on the floor: tempting, and heavy (each pile is a weight). */
  dropCoins?(at: THREE.Vector3, piles: number): void;
  /** The Tower: set the timber decks within `radius` of `at` alight. */
  ignite?(at: THREE.Vector3, radius: number): void;
  /** The Devil offers his pact (double damage dealt and taken); `pact` says what the player chose. */
  offerPact?(): void;
  readonly pact?: 'none' | 'offered' | 'accepted' | 'refused';
  sound(name: SfxName, at: THREE.Vector3): void;
  shake(trauma: number, at: THREE.Vector3): void;
}

const MOVE_GROUPS = groups(G.ENEMY_BODY, G.WORLD | G.ENEMY_BODY | G.PLAYER);
const CHARGE_GROUPS = groups(G.ENEMY_BODY, G.WORLD | G.ENEMY_BODY);
const BODY_GROUPS = groups(G.ENEMY_BODY, G.WORLD | G.PLAYER | G.ENEMY_BODY);

const _v = new THREE.Vector3();
const _to = new THREE.Vector3();
const _des = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _black = new THREE.Color(0, 0, 0);
const _white = new THREE.Color(1, 1, 1);
const _tele = new THREE.Color(SIGNAL.telegraph);
const _up = new THREE.Vector3(0, 1, 0);

type Cfg = typeof tuning.enemies.skitterer & typeof tuning.enemies.spitter & typeof tuning.enemies.brute;

export class Enemy implements Damageable, Hostile {
  readonly plan: BodyPlan;
  readonly rig: MultiLegRig;
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private mat: THREE.MeshToonMaterial;
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private kcc: RAPIER.KinematicCharacterController;
  private hitboxes: { col: RAPIER.Collider; at: THREE.Vector3 }[] = [];
  /** Collider centre and the ground point under it. */
  readonly center = new THREE.Vector3();
  readonly ground = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  private push = new THREE.Vector3();
  private vy = 0;
  yaw = 0;
  state: AIState = 'idle';
  private stateT = 0;
  health = 0;
  private poise = 0;
  private sincePoise = 10;
  private flash = 0;
  /** Telegraph glow 0..1. */
  private glow = 0;
  private attack: Attack | null = null;
  private attackDealt = false;
  private cooldown = 0;
  private perceiveT = 0;
  private sees = false;
  private dist = 99;
  private strafeSign = 1;
  private strafeT = 0;
  private avoidT = 0;
  private avoidYaw = 0;
  private stuckFrames = 0;
  private recoverTime = 0;
  private laneLen = 0;
  private deadT = 0;
  /** Elites that die stay dead across respawns. */
  slain = false;
  readonly home = new THREE.Vector3();
  homeYaw = 0;
  onKilled: (e: Hostile) => void = () => {};

  constructor(
    readonly kind: EnemyKind,
    private scene: THREE.Scene,
    private physics: Physics,
    pos: THREE.Vector3,
    yaw: number,
  ) {
    this.plan = PLANS[kind];
    this.mat = toonMat({ emissive: 0x000000 });
    this.mesh = meshOf(this.plan.geo(), this.mat);
    this.group.add(this.mesh);
    const weak = this.plan.weakGeo();
    if (weak) this.group.add(new THREE.Mesh(weak, new THREE.MeshBasicMaterial({ color: SIGNAL.weakSpot, vertexColors: false })));
    scene.add(this.group);
    this.rig = new MultiLegRig(this.plan.rig, physics);
    const w = physics.world;
    const r = this.plan.radius;
    this.body = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + r, pos.z));
    this.collider = w.createCollider(RAPIER.ColliderDesc.ball(r).setCollisionGroups(BODY_GROUPS), this.body);
    this.kcc = w.createCharacterController(0.02);
    this.kcc.enableAutostep(0.4 * r + 0.15, 0.1, false);
    this.kcc.enableSnapToGround(0.4);
    this.kcc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.kcc.setSlideEnabled(true);
    for (const hb of this.plan.hitboxes) {
      const col = physics.addHitbox(RAPIER.ColliderDesc.ball(hb.r), { part: hb.part, owner: this });
      this.hitboxes.push({ col, at: new THREE.Vector3(...hb.at) });
    }
    this.home.copy(pos);
    this.homeYaw = yaw;
    this.respawn();
  }

  get cfg(): Cfg {
    return tuning.enemies[this.kind] as Cfg;
  }
  get alive() {
    return this.state !== 'dead';
  }
  get elite() {
    return this.plan.elite;
  }
  get armorMul() {
    return this.kind === 'brute' ? this.cfg.armorMul : 0.2;
  }
  get aggroed() {
    return this.alive && this.state !== 'idle';
  }
  get maxHealth() {
    return this.cfg.health;
  }
  get name() {
    return this.kind === 'brute' ? 'Brute beetle' : this.kind;
  }
  get reward() {
    return this.cfg.pollen;
  }
  get bar() {
    return this.elite;
  }
  labelPos(out: THREE.Vector3) {
    return out.copy(this.rig.pos).addScaledVector(_up, this.plan.radius * 1.6 + 0.3);
  }
  draw(limbs: LimbRenderer) {
    this.rig.draw(limbs);
  }

  respawn() {
    this.state = 'idle';
    this.stateT = 0;
    this.health = this.cfg.health;
    this.poise = this.cfg.poise;
    this.flash = 0;
    this.glow = 0;
    this.cooldown = 0;
    this.attack = null;
    this.deadT = 0;
    this.vel.set(0, 0, 0);
    this.push.set(0, 0, 0);
    this.vy = 0;
    this.yaw = this.homeYaw;
    const r = this.plan.radius;
    this.center.set(this.home.x, this.home.y + r, this.home.z);
    this.body.setTranslation(this.center, true);
    this.body.setNextKinematicTranslation(this.center);
    this.collider.setEnabled(true);
    for (const h of this.hitboxes) h.col.setEnabled(true);
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.ground.copy(this.home);
    this.rig.reset(this.ground, this.yaw);
    this.syncVisuals();
  }

  /** Kept dead and hidden (an elite that was slain). */
  despawn() {
    this.state = 'dead';
    this.collider.setEnabled(false);
    for (const h of this.hitboxes) h.col.setEnabled(false);
    this.group.visible = false;
  }

  private set(s: AIState) {
    this.state = s;
    this.stateT = 0;
  }

  takeDamage(info: DamageInfo): boolean {
    if (!this.alive) return false;
    const c = this.cfg;
    this.health -= info.amount;
    this.flash = tuning.enemies.hitFlashTime;
    const k = Math.min(1.2, info.amount * 0.02) * (1 + info.knockback * 0.3);
    // Flinch: an impulse into the body springs, away from the shot.
    this.rig.kickRot.impulse(-info.dir.z * k * 3, 0, info.dir.x * k * 3);
    this.rig.kickPos.impulse(info.dir.x * k, 0.4 * k, info.dir.z * k);
    const massDiv = this.kind === 'brute' ? 4 : this.kind === 'spitter' ? 1.5 : 1;
    this.push.addScaledVector(_v.set(info.dir.x, 0, info.dir.z).normalize(), (info.knockback * 2) / massDiv);
    if (this.state === 'idle' || this.state === 'alert') this.set('approach');
    if (this.health <= 0) {
      this.die();
      return true;
    }
    this.poise -= info.stagger;
    this.sincePoise = 0;
    if (this.poise <= 0 && this.state !== 'stagger') {
      this.poise = c.poise;
      this.endAttack();
      this.set('stagger');
      this.rig.kickRot.impulse(-info.dir.z * 6, 0, info.dir.x * 6);
    }
    return false;
  }

  private die() {
    this.set('dead');
    this.deadT = 0;
    this.endAttack();
    this.collider.setEnabled(false);
    for (const h of this.hitboxes) h.col.setEnabled(false);
    if (this.elite) this.slain = true;
    this.onKilled(this);
  }

  private endAttack() {
    this.attack = null;
    this.glow = 0;
    this.hazards?.hideLane(this);
  }

  private hazards: Hazards | null = null;

  update(dt: number, w: EnemyWorld) {
    this.hazards = w.hazards;
    if (dt <= 0) {
      this.syncVisuals();
      return;
    }
    const c = this.cfg;
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sincePoise += dt;
    if (this.sincePoise > 1.5) this.poise = Math.min(c.poise, this.poise + c.poiseRegen * dt);

    if (this.state === 'dead') {
      this.deadT += dt;
      this.vel.multiplyScalar(Math.exp(-6 * dt));
      this.rig.update(dt, this.ground, this.yaw, this.vel, { rear: 0, crouch: 0, dead: true });
      const fade = smoothstep(tuning.enemies.corpseTime - 1, tuning.enemies.corpseTime, this.deadT);
      this.group.scale.setScalar(1 - fade * 0.999);
      this.group.visible = fade < 1;
      this.syncVisuals();
      return;
    }

    // ---- perception (throttled)
    _to.subVectors(w.playerPos, this.ground).setY(0);
    this.dist = _to.length();
    // Asleep: idle and far beyond notice. Skip moving and animating (they're lost in the fog anyway).
    if (this.state === 'idle' && this.dist > c.aggroRange * 2 + 10) return;
    this.perceiveT -= dt;
    if (this.perceiveT <= 0) {
      this.perceiveT = 0.2;
      this.sees = w.playerAlive && this.dist < c.aggroRange && this.lineOfSight(w);
    }
    const toYaw = Math.atan2(-_to.x, -_to.z);
    const dyaw = angleDelta(this.yaw, toYaw);
    const pose: RigPose = { rear: 0, crouch: 0, dead: false };
    _des.set(0, 0, 0);
    let groupsForMove = MOVE_GROUPS;
    let maxTurn = c.turnRate;
    let faceTarget = true;

    switch (this.state) {
      case 'idle':
        faceTarget = false;
        if (w.playerAlive && (this.sees || this.dist < c.hearRange)) {
          this.set('alert');
          w.sound('alert', this.center);
        }
        break;
      case 'alert':
        maxTurn *= 1.5;
        pose.rear = 0.15 * Math.sin(Math.min(1, this.stateT / 0.4) * Math.PI);
        if (this.stateT > 0.45) this.set('approach');
        break;
      case 'approach':
        this.approach(dt, w, dyaw);
        break;
      case 'windup':
        this.windup(w, dyaw, pose);
        if (this.attack === 'charge' && this.stateT > c.chargeWindup * 0.7) faceTarget = false;
        maxTurn *= this.attack === 'charge' ? 1.4 : 1;
        break;
      case 'attack':
        faceTarget = false;
        groupsForMove = this.attack === 'charge' ? CHARGE_GROUPS : MOVE_GROUPS;
        this.active(dt, w, pose);
        break;
      case 'recover':
        faceTarget = false;
        pose.crouch = this.recoverTime > c.recover ? 0.5 + 0.2 * Math.sin(this.stateT * 9) : 0.2;
        if (this.stateT >= this.recoverTime) {
          this.cooldown = c.cooldown;
          this.set(w.playerAlive ? 'approach' : 'idle');
        }
        break;
      case 'stagger':
        faceTarget = false;
        pose.crouch = 0.6;
        pose.rear = -0.15 * Math.sin(this.stateT * 14) * (1 - this.stateT / c.staggerTime);
        if (this.stateT >= c.staggerTime) this.set('approach');
        break;
    }
    if (!w.playerAlive && this.state === 'approach') this.set('idle');

    if (faceTarget && this.state !== 'idle') this.yaw += clamp(dyaw, -maxTurn * dt, maxTurn * dt);

    // ---- move: accelerate toward the desired velocity (attack states set vel directly)
    if (this.state !== 'attack') {
      const accel = c.accel;
      this.vel.x = damp(this.vel.x, _des.x, accel * 0.25, dt);
      this.vel.z = damp(this.vel.z, _des.z, accel * 0.25, dt);
    }
    this.push.multiplyScalar(Math.exp(-6 * dt));
    const moved = this.move(dt, groupsForMove);
    if (this.state === 'attack' && this.attack === 'charge' && this.stateT > 0.15) {
      const want = c.chargeSpeed * dt;
      this.stuckFrames = moved < want * 0.35 ? this.stuckFrames + 1 : 0;
      if (this.stuckFrames >= 2) {
        // Charged into a wall: dazed. The long punish window.
        w.sound('wallhit', this.center);
        w.shake(0.5, this.center);
        this.rig.kickRot.impulse(4, 0, 0);
        this.endAttack();
        this.recoverTime = c.wallStun;
        this.set('recover');
      }
    }

    this.rig.update(dt, this.ground, this.yaw, this.vel, pose);
    this.glow = this.state === 'windup' ? this.glow : damp(this.glow, 0, 12, dt);
    this.syncVisuals();
  }

  /** Sees the player if a ray from just above the body reaches their chest or head. */
  private lineOfSight(w: EnemyWorld) {
    const eye = _v.copy(this.rig.pos);
    eye.y += this.plan.radius * 0.8 + 0.25;
    for (const lift of [0, 0.45]) {
      const dir = _fwd.copy(w.playerChest);
      dir.y += lift;
      dir.sub(eye);
      const d = dir.length();
      if (d < 1e-3) return true;
      dir.divideScalar(d);
      if (!w.physics.raycast(eye, dir, d, groups(G.QUERY, G.WORLD))) return true;
    }
    return false;
  }

  /** Steering toward a goal direction with separation and simple feeler avoidance. Writes _des. */
  private steer(dirX: number, dirZ: number, speed: number, w: EnemyWorld, dt: number) {
    const c = this.cfg;
    _des.set(dirX, 0, dirZ);
    if (_des.lengthSq() > 1e-6) _des.normalize();
    // Separation from other enemies.
    for (const o of w.enemies) {
      if (o === this || !o.alive || !(o instanceof Enemy)) continue;
      _v.subVectors(this.ground, o.ground).setY(0);
      const d = _v.length();
      const range = c.separation + o.plan.radius;
      if (d > 1e-3 && d < range) _des.addScaledVector(_v.divideScalar(d), (range - d) / range);
    }
    // Feelers: if something blocks the way, swing left or right.
    this.avoidT -= dt;
    if (this.avoidT <= 0 && _des.lengthSq() > 1e-4) {
      this.avoidT = 0.15;
      this.avoidYaw = 0;
      const base = Math.atan2(_des.x, _des.z);
      const look = this.plan.radius + 1.2;
      const origin = _v.copy(this.center);
      const clear = (a: number) => !w.physics.raycast(origin, _fwd.set(Math.sin(a), 0, Math.cos(a)), look, groups(G.QUERY, G.WORLD));
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

  private approach(dt: number, w: EnemyWorld, dyaw: number) {
    const c = this.cfg;
    const dx = _to.x / Math.max(1e-3, this.dist);
    const dz = _to.z / Math.max(1e-3, this.dist);
    const facing = Math.abs(dyaw) < 0.5;
    if (this.kind === 'skitterer') {
      this.steer(dx, dz, this.dist > c.attackRange * 0.8 ? c.speed : 0, w, dt);
      if (this.dist < c.attackRange && facing && this.cooldown <= 0) this.beginWindup('lunge', w);
    } else if (this.kind === 'spitter') {
      // Hold a range band and circle.
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 2 + (this.home.x * 13.7 + this.stateT * 7) % 1.5;
        this.strafeSign *= -1;
      }
      let fx = 0;
      if (this.dist < c.preferredRange - c.rangeBand) fx = -1;
      else if (this.dist > c.preferredRange + c.rangeBand || !this.sees) fx = 1;
      const sx = -dz * this.strafeSign * 0.6;
      const sz = dx * this.strafeSign * 0.6;
      this.steer(dx * fx + sx, dz * fx + sz, c.speed, w, dt);
      if (this.sees && this.dist < c.attackRange && facing && this.cooldown <= 0) this.beginWindup('spit', w);
    } else {
      this.steer(dx, dz, this.dist > c.buttRange * 0.8 ? c.speed : 0, w, dt);
      if (this.dist < c.buttRange && Math.abs(dyaw) < 0.6 && this.cooldown <= 0) this.beginWindup('butt', w);
      else if (this.sees && Math.abs(dyaw) < 0.45 && this.dist < c.chargeRange && this.dist > c.buttRange + 1.5 && this.cooldown <= 0) this.beginWindup('charge', w);
    }
  }

  private beginWindup(a: Attack, w: EnemyWorld) {
    this.attack = a;
    this.attackDealt = false;
    this.set('windup');
    const snd: Record<Attack, SfxName> = { lunge: 'windupSkitter', spit: 'windupSpit', charge: 'windupCharge', butt: 'windupButt' };
    w.sound(snd[a], this.center);
  }

  private windupTime() {
    const c = this.cfg;
    return this.attack === 'charge' ? c.chargeWindup : this.attack === 'butt' ? c.buttWindup : c.windup;
  }

  private windup(w: EnemyWorld, _dyaw: number, pose: RigPose) {
    const T = this.windupTime();
    const k = clamp(this.stateT / T, 0, 1);
    // Glow pulses faster as the attack nears.
    this.glow = smoothstep(0, 0.6, k) * (0.7 + 0.3 * Math.sin(this.stateT * (10 + k * 25)));
    if (this.attack === 'lunge') pose.crouch = k;
    else if (this.attack === 'spit') pose.rear = 0.5 * smoothstep(0, 0.7, k);
    else if (this.attack === 'butt') pose.rear = -0.25 * k;
    else if (this.attack === 'charge') {
      pose.rear = 0.22 * Math.abs(Math.sin(this.stateT * 5.5));
      pose.crouch = 0.3 * k;
      // Charge lane: shows exactly where it will run.
      const c = this.cfg;
      const want = c.chargeSpeed * c.chargeTime;
      _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const hit = w.physics.raycast(_v.copy(this.center), _fwd, want, groups(G.QUERY, G.WORLD));
      this.laneLen = hit ? hit.distance : want;
      w.hazards.lane(this, this.ground, this.yaw, this.laneLen, this.plan.radius * 2, k);
    }
    if (this.stateT >= T) this.beginActive(w);
  }

  private beginActive(w: EnemyWorld) {
    const c = this.cfg;
    this.set('attack');
    this.glow = 1;
    _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    if (this.attack === 'lunge') {
      this.vel.copy(_fwd).multiplyScalar(c.lungeSpeed);
      w.sound('lunge', this.center);
    } else if (this.attack === 'charge') {
      w.hazards.hideLane(this);
      this.vel.copy(_fwd).multiplyScalar(c.chargeSpeed);
      this.stuckFrames = 0;
      w.sound('charge', this.center);
    } else if (this.attack === 'butt') {
      this.vel.copy(_fwd).multiplyScalar(4);
    } else if (this.attack === 'spit') {
      const mouth = _v.set(...this.plan.mouth).applyQuaternion(this.rig.quat).add(this.rig.pos);
      // Aim where the player is heading (half lead), on the ground.
      const T = c.globFlightTime;
      const target = w.playerPos.clone().addScaledVector(w.playerVel, T * 0.5);
      const g = w.physics.groundY(target.x, target.z, target.y + 3, 10);
      if (g) target.y = g.y;
      w.hazards.lob(mouth, target, T, c.globGravity, c.splashRadius, c.damage, c.knockback);
      w.sound('spit', mouth);
      this.rig.kickRot.impulse(2.5, 0, 0);
      this.recoverTime = c.recover;
      this.endAttack();
      this.set('recover');
    }
  }

  private active(dt: number, w: EnemyWorld, pose: RigPose) {
    const c = this.cfg;
    _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const toPlayer = _v.subVectors(w.playerChest, this.center);
    const d = toPlayer.length();
    const inFront = toPlayer.setY(0).normalize().dot(_fwd) > 0.3;
    if (this.attack === 'lunge') {
      pose.crouch = 0.2;
      if (!this.attackDealt && d < c.hitRadius + this.plan.radius && inFront) {
        this.attackDealt = true;
        w.hurtPlayer(c.damage, this.center, c.knockback);
      }
      if (this.stateT >= c.active) this.toRecover(c.recover);
    } else if (this.attack === 'butt') {
      pose.rear = -0.35 + this.stateT * 2;
      this.vel.multiplyScalar(Math.exp(-8 * dt));
      if (!this.attackDealt && d < c.buttRange + 0.4 && inFront) {
        this.attackDealt = true;
        w.hurtPlayer(c.buttDamage, this.center, c.buttKnockback);
        w.shake(0.3, this.center);
      }
      if (this.stateT >= c.buttActive) this.toRecover(c.recover);
    } else if (this.attack === 'charge') {
      pose.rear = -0.1;
      if (!this.attackDealt && d < this.plan.radius + 0.9) {
        this.attackDealt = true;
        w.hurtPlayer(c.chargeDamage, this.center, c.chargeKnockback);
        w.shake(0.4, this.center);
      }
      if (this.stateT >= c.chargeTime) this.toRecover(c.recover);
    }
  }

  private toRecover(t: number) {
    this.recoverTime = t;
    this.endAttack();
    this.set('recover');
  }

  /** Kinematic move; returns horizontal distance actually travelled. */
  private move(dt: number, filter: number): number {
    if (this.vy <= 0 && this.kcc.computedGrounded()) this.vy = -2;
    else this.vy -= 30 * dt;
    const want = { x: (this.vel.x + this.push.x) * dt, y: this.vy * dt, z: (this.vel.z + this.push.z) * dt };
    this.kcc.computeColliderMovement(this.collider, want, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, filter);
    const mv = this.kcc.computedMovement();
    this.center.x += mv.x;
    this.center.y += mv.y;
    this.center.z += mv.z;
    if (this.center.y < -30) this.center.set(this.home.x, this.home.y + this.plan.radius, this.home.z);
    this.body.setNextKinematicTranslation(this.center);
    this.ground.set(this.center.x, this.center.y - this.plan.radius, this.center.z);
    return Math.hypot(mv.x, mv.z);
  }

  private syncVisuals() {
    this.group.position.copy(this.rig.pos);
    this.group.quaternion.copy(this.rig.quat);
    const e = this.mat.emissive;
    if (this.flash > 0) e.copy(_white);
    else e.copy(_black).lerp(_tele, clamp(this.glow, 0, 1) * 0.85);
    for (const h of this.hitboxes) {
      _q.copy(this.rig.quat);
      h.col.setTranslation(_v.copy(h.at).applyQuaternion(_q).add(this.rig.pos));
    }
  }

  /** Label for the AI debug overlay. */
  get label() {
    return `${this.kind} · ${this.state}${this.attack ? ` (${this.attack})` : ''}`;
  }

  dispose() {
    this.scene.remove(this.group);
    for (const h of this.hitboxes) this.physics.removeCollider(h.col);
    this.physics.world.removeCharacterController(this.kcc);
    this.physics.world.removeRigidBody(this.body);
  }
}
