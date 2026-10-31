// Every feel number in the game. Systems read from here each frame so panel edits apply live.
// Angles suffixed `Deg` are degrees; everything else is SI: metres, seconds.
// V2-1 converted v1's beetle-unit numbers to metres (× V1_TO_METRES = 1.6) instead of re-tuning them; the user's
// first v2 tuning pass then set walk/sprint, roll, camera, cloth, look and outline values by playing (PLAYTEST.md).
// `enemies` is still v1 content in v1 units until V2-4 replaces it.
import { AUTO_PISTOL, SWORD_MELEE, SWORD_RIFLE } from './weapons/defs';

export const tuning = {
  player: {
    walkSpeed: 4.5,
    sprintSpeed: 7.5,
    adsSpeedMul: 0.55,
    reloadSpeedMul: 0.75,
    accel: 60.8,
    decel: 48,
    airControl: 0.25,
    gravity: 48,
    turnRate: 16,
    combatModeTime: 1.6,
    stepHeight: 0.67,
    /** After a fall she comes up at least this far inside the room she fell from (m). */
    fallMargin: 3,
    maxSlopeDeg: 48,
    snapToGround: 0.56,
    /** Humanoid capsule (not converted: the beetle was an egg). 2·(radius + halfHeight) = 1.6 m. */
    capsuleRadius: 0.3,
    capsuleHalfHeight: 0.5,
    pushDecay: 8,
  },
  vitals: {
    maxHealth: 100,
    maxStamina: 100,
    staminaRegen: 45,
    staminaRegenDelay: 0.7,
    sprintDrain: 18,
    rollCost: 28,
    exhaustedUntil: 25,
    healCharges: 3,
    healTime: 1.2,
    healApplyAt: 0.7,
    healAmount: 45,
    healMoveMul: 0.35,
    hurtStun: 0.22,
    hurtKnockbackMul: 1,
    hurtTrauma: 0.55,
    pollenPickupRadius: 2.24,
    /** Pentacles in a branch's cache (v2 levels). */
    cachePentacles: 30,
  },
  roll: {
    speed: 8.5,
    duration: 0.5,
    recovery: 0.03,
    endSpeedMul: 1.2,
    iFrames: 0.3,
    tumbleTurns: 1,
  },
  /**
   * The Tower's collapse (V2-11): rotten decks hold `crackTime` once stepped on; burning decks hurt `burnDps` while you
   * stand on them, spread fire to sound neighbours (`spreadPerSec` each; one step only: a deck caught from a
   * neighbour doesn't pass it on), and fall after `burnTime`. Lightning
   * marks where you stand every `lightning[level]` seconds (min, max), strikes `lightningDelay` later, and sets the
   * decks within `igniteRadius` alight. Falling into the drop costs `fallDamage` and puts you back on solid ground.
   */
  tower: {
    crackTime: 1.0,
    burnTime: 4.5,
    spreadPerSec: 0.32,
    /** A fallen deck is built back after this long (s): the stage keeps changing instead of emptying. 0 = never. */
    regrowTime: 6,
    /** The Crowned Tower's top floor: once it's in a phase, that phase's ring gives way again this often (s). */
    ringEvery: 22,
    /** ...and how much of it stays (radius from the middle, m) in its first and second phase. The floor is 28 m across. */
    ringKeep: [18, 12] as [number, number],
    burnDps: 14,
    lightning: [
      [10, 14],
      [8, 11],
      [6, 9],
    ] as [number, number][],
    lightningDelay: 1.4,
    lightningRadius: 2.4,
    lightningDamage: 28,
    igniteRadius: 2.6,
    fallDamage: 30,
    /** Once the Tower has fallen, a fall lands her on her feet: enemies this close reel. */
    landingRadius: 4.5,
  },
  /**
   * The chain-break dash (V2-10, the Devil's unbinding; Proposed): a short, very fast burst with i-frames for its
   * whole length, cheaper than a roll and quick to recover. It breaks any binding, and any Thrall chain it passes
   * through. A cooldown keeps it from replacing the roll.
   */
  dash: {
    speed: 17,
    duration: 0.22,
    recovery: 0.05,
    endSpeedMul: 0.5,
    iFrames: 0.22,
    staminaCost: 14,
    cooldown: 0.9,
  },
  /**
   * Justice's weighing: set the weight in a pan and the pan carries her back across the drop to the mid lantern
   * (the beam), so a wing is walked once. The ride is committed: no control, no harm, until she's set down.
   */
  justice: {
    /** Seconds from the pan to the lantern. */
    rideTime: 2.6,
    /** How high the arc rises over the straight line between them (m). */
    rideRise: 9,
  },
  biped: {
    stepThreshold: 0.785,
    stepDuration: 0.1116,
    stepDurationSprint: 0.1496,
    stepHeight: 0.189,
    /** Seconds of velocity the feet reach ahead. */
    velocityLead: 0.14256,
    panicFactor: 4,
    stanceWidth: 0.229,
    /** Matches BODY.hip (src/anim/body.ts). */
    hipHeight: 0.66,
    bobAmount: 0.0963,
    /** Lean (radians) per m/s and per m/s². */
    leanPerSpeed: 0.0589,
    leanAccel: 0.01167,
    leanMaxDeg: 23.872,
    headLookRate: 6,
    armSwingIdle: 0.0374,
  },
  /** Blindfold tails (verlet ribbons). */
  cloth: {
    tailLength: 0.43,
    gravity: 8.428,
    drag: 0.06,
    stiffness: 5,
    /** How far the tails lean back from straight down at rest (degrees). */
    restBackDeg: 35,
  },
  /** Atmosphere (STYLE.md → Atmospheric perspective). Fog colour comes from the area palette. */
  look: {
    /** Fog per metre. With fogPower 1.4 on flat ground: ~17% at 40 m, ~55% at 120 m, ~91% at 250 m. */
    fogDensity: 0.0075,
    /** 2 = classic exp²; lower hazes near space sooner, higher keeps the play space clear and walls off the distance. */
    fogPower: 1.4,
    /** Height fog: density falls by e every 1/heightFalloff metres above the ground. */
    heightFalloff: 0.02,
    heightMix: 1,
    /** The landmark takes this fraction of the fog: its silhouette reads from every vista (1 = fogged like the rest). */
    landmarkFog: 0.35,
    skyBands: 24,
    cloudAmount: 0.35,
  },
  /** Pixel mode (src/render/pixel.ts): crisp low-res blocks with a depth outline. P toggles it. */
  pixel: {
    enabled: true,
    /** Screen pixels per block. */
    scale: 2,
    /** Outline darkness, 0 = none. */
    outline: 0.4,
    /** How sharp a depth step must be to get a line: higher draws fewer, only strong silhouettes. */
    edgeThreshold: 0.15,
    /** Line thickness in blocks. */
    edgeWidth: 1,
    /** Outlines fade out between these view distances (metres), so the distance stays soft. */
    outlineFadeStart: 30,
    outlineFadeEnd: 140,
  },
  camera: {
    height: 1.5,
    distance: 3.5,
    shoulder: 1,
    lift: 0.3,
    adsDistance: 2,
    adsShoulder: 1,
    fovDeg: 80,
    adsFovDeg: 60,
    zoomRate: 14,
    swapRate: 10,
    sensitivity: 0.0022,
    adsSensitivityMul: 0.7,
    pitchMinDeg: -70,
    pitchMaxDeg: 70,
    collisionRadius: 0.288,
    collisionRecoverRate: 6,
    followRate: 30,
  },
  /**
   * Touch controls (V2-18): a floating stick under the left thumb (it lands where you touch), a drag anywhere else
   * looks, and thumb buttons on the right. `lookSens` scales a drag (px) against the mouse's counts; `stickRadius` is
   * the thumb's travel to the rim as a share of the screen's short side; `deadzone` and `sprintAt` are shares of
   * that radius (held past `sprintAt` going forward, she runs). `stickZone` is how much of the screen's width, from
   * the left, belongs to the stick.
   */
  touch: {
    lookSens: 1.9,
    stickRadius: 0.11,
    deadzone: 0.12,
    sprintAt: 0.92,
    stickZone: 0.42,
  },
  feel: {
    hitstopCrit: 0,
    hitstopKill: 0,
    hitFlashTime: 0.07,
    traumaDecay: 1.7,
    shakeMaxAngleDeg: 2.6,
    shakeMaxRollDeg: 3.5,
    shakeMaxOffset: 0.096,
    shakeFreq: 24,
    hitMarkerTime: 0.18,
    hurtVignetteTime: 0.45,
    killMarkerTime: 0.42,
    crosshairBaseGap: 4,
    fireBuffer: 0.15,
    /** A roll press is remembered this long (real time), so it survives hitstop and the end of a committed swing. */
    rollBuffer: 0.15,
  },
  reload: {
    weaponTiltDeg: 28,
    weaponDrop: 0.128,
    handReachTime: 0.18,
    magOutAt: 0.28,
    pouchAt: 0.5,
    magInAt: 0.68,
    rackAt: 0.86,
  },
  enemies: {
    skitterer: {
      health: 120,
      poise: 14,
      poiseRegen: 20,
      speed: 9,
      accel: 28,
      turnRate: 9,
      aggroRange: 22,
      hearRange: 7,
      attackRange: 2.4,
      windup: 0.38,
      active: 0.22,
      lungeSpeed: 11,
      recover: 0.75,
      cooldown: 0.6,
      damage: 25,
      knockback: 4,
      hitRadius: 0.75,
      staggerTime: 0.8,
      pollen: 4,
      separation: 1.4,
    },
    spitter: {
      health: 75,
      poise: 28,
      poiseRegen: 18,
      speed: 3.2,
      accel: 14,
      turnRate: 5,
      aggroRange: 30,
      hearRange: 8,
      preferredRange: 16,
      rangeBand: 3.5,
      attackRange: 22,
      windup: 0.85,
      active: 0.1,
      recover: 1.1,
      cooldown: 1.6,
      globFlightTime: 1,
      globGravity: 18,
      splashRadius: 1.5,
      damage: 30,
      knockback: 3,
      staggerTime: 1,
      pollen: 8,
      separation: 2,
    },
    brute: {
      health: 800,
      poise: 110,
      poiseRegen: 15,
      speed: 3.4,
      accel: 10,
      turnRate: 2.6,
      aggroRange: 22,
      hearRange: 10,
      chargeRange: 20,
      chargeWindup: 1.1,
      chargeSpeed: 14,
      chargeTime: 1.3,
      chargeDamage: 40,
      chargeKnockback: 10,
      wallStun: 2.2,
      buttRange: 3.4,
      buttWindup: 0.75,
      buttActive: 0.18,
      buttDamage: 32,
      buttKnockback: 7,
      recover: 1.4,
      cooldown: 1.2,
      staggerTime: 1.6,
      armorMul: 0.2,
      pollen: 60,
      separation: 3,
    },
    hitFlashTime: 0.08,
    corpseTime: 6,
    globDamageGrace: 0.05,
  },
  /**
   * v2 Justice enemies (V2-4), in metres and seconds. Every attack has a wind-up (pose + magenta glow + sound), an
   * active window, and a recovery you can punish. Attacks are picked by range and weight; `hits` > 1 is a mirrored
   * combo (the second swing comes from the other side: answer in kind).
   */
  foes: {
    bailiff: {
      health: 170,
      poise: 40,
      poiseRegen: 22,
      speed: 2.4,
      runSpeed: 4.0,
      accel: 18,
      turnRate: 4.5,
      sightRange: 24,
      leash: 34,
      /** The shield turns blows arriving within this cone of its front, except during and after its own swing. */
      guardConeDeg: 120,
      staggerTime: 0.9,
      separation: 1.8,
      reward: 6,
      attacks: {
        thrust: { range: 2.5, windup: 0.6, active: 0.16, recover: 0.85, cooldown: 0.9, damage: 22, knockback: 4, arcDeg: 70, lunge: 2.6, weight: 1 },
        bash: { range: 1.7, windup: 0.42, active: 0.12, recover: 0.55, cooldown: 2.6, damage: 10, knockback: 9, arcDeg: 90, lunge: 1.8, weight: 0.7 },
      },
    },
    gavel: {
      health: 300,
      poise: 90,
      poiseRegen: 18,
      speed: 1.8,
      runSpeed: 2.8,
      accel: 10,
      turnRate: 2.6,
      sightRange: 22,
      leash: 30,
      staggerTime: 1.4,
      separation: 2.4,
      reward: 12,
      attacks: {
        /** Overhead slam: a ground ring fills during the wind-up and erupts where it lands. */
        slam: { range: 3.6, windup: 1.15, active: 0.12, recover: 1.6, cooldown: 1.0, damage: 42, knockback: 10, arcDeg: 360, lunge: 0.8, weight: 1, radius: 2.6, reach: 2.2 },
        sweep: { range: 2.9, windup: 0.85, active: 0.22, recover: 1.1, cooldown: 2.4, damage: 26, knockback: 7, arcDeg: 170, lunge: 0.6, weight: 0.6 },
      },
    },
    blindfold: {
      health: 140,
      poise: 30,
      poiseRegen: 25,
      speed: 2.0,
      runSpeed: 5.2,
      accel: 24,
      turnRate: 7,
      /** It doesn't see. It hears noises within these radii (m) and feels you when you're this close. */
      senseRange: 3.6,
      searchTime: 2.5,
      leash: 40,
      staggerTime: 0.8,
      separation: 1.6,
      reward: 10,
      attacks: {
        slash: { range: 2.4, windup: 0.45, active: 0.12, recover: 0.95, cooldown: 0.7, damage: 18, knockback: 4, arcDeg: 120, lunge: 2.2, weight: 1, hits: 2, comboWindup: 0.3 },
      },
    },
    page: {
      health: 120,
      poise: 25,
      poiseRegen: 25,
      speed: 3.0,
      runSpeed: 5.6,
      accel: 26,
      turnRate: 7,
      sightRange: 30,
      leash: 36,
      /** Keeps this far away and throws; sees you and whistles the room awake. */
      holdRange: 15,
      alertRadius: 32,
      staggerTime: 0.8,
      separation: 1.6,
      reward: 16,
      attacks: {
        throw: { range: 24, windup: 0.65, active: 0.1, recover: 0.7, cooldown: 1.6, damage: 16, knockback: 3, arcDeg: 360, lunge: 0, weight: 1, speed: 16 },
        cut: { range: 2.2, windup: 0.4, active: 0.12, recover: 0.6, cooldown: 1.0, damage: 14, knockback: 4, arcDeg: 100, lunge: 1.6, weight: 1 },
      },
    },
    /** The Devil's archetypes (V2-9): the guard, harasser and elite verbs re-skinned, plus the chained Thralls. */
    miser: {
      health: 230,
      poise: 70,
      poiseRegen: 20,
      speed: 1.9,
      runSpeed: 3.0,
      accel: 14,
      turnRate: 3.6,
      sightRange: 22,
      leash: 30,
      /** It hugs its chest: blows from this wide a cone in front are turned, except during and after its own swing. */
      guardConeDeg: 150,
      staggerTime: 1.1,
      separation: 2.0,
      reward: 14,
      attacks: {
        club: { range: 2.5, windup: 0.75, active: 0.16, recover: 1.0, cooldown: 1.0, damage: 26, knockback: 6, arcDeg: 90, lunge: 1.4, weight: 1 },
        shove: { range: 1.8, windup: 0.5, active: 0.12, recover: 0.7, cooldown: 2.4, damage: 12, knockback: 11, arcDeg: 100, lunge: 1.6, weight: 0.7 },
      },
    },
    imp: {
      health: 70,
      poise: 14,
      poiseRegen: 30,
      speed: 3.6,
      runSpeed: 6.8,
      accel: 34,
      turnRate: 9,
      sightRange: 22,
      leash: 32,
      staggerTime: 0.6,
      separation: 1.3,
      reward: 4,
      /** Hit and run: it falls back this long after each rake, then darts in again. */
      retreatTime: 0.9,
      attacks: {
        rake: { range: 1.8, windup: 0.34, active: 0.1, recover: 0.4, cooldown: 0.5, damage: 9, knockback: 2, arcDeg: 120, lunge: 1.6, weight: 1, hits: 2, comboWindup: 0.2 },
        pounce: { range: 4.6, windup: 0.5, active: 0.18, recover: 0.6, cooldown: 2.2, damage: 12, knockback: 4, arcDeg: 90, lunge: 4.2, weight: 0.8 },
      },
    },
    pagePentacles: {
      health: 110,
      poise: 22,
      poiseRegen: 25,
      speed: 3.2,
      runSpeed: 5.4,
      accel: 26,
      turnRate: 8,
      sightRange: 26,
      leash: 30,
      /** It runs to keep this far from you, circling inside its room; it cuts only when cornered. */
      holdRange: 16,
      staggerTime: 1.0,
      separation: 1.6,
      /** Its purse. */
      reward: 90,
      attacks: {
        cut: { range: 2.2, windup: 0.42, active: 0.12, recover: 0.6, cooldown: 1.0, damage: 12, knockback: 6, arcDeg: 110, lunge: 1.4, weight: 1 },
      },
    },
    thrall: {
      health: 120,
      poise: 30,
      poiseRegen: 22,
      speed: 2.3,
      runSpeed: 4.6,
      accel: 20,
      turnRate: 5,
      sightRange: 24,
      leash: 34,
      staggerTime: 0.9,
      separation: 1.4,
      reward: 8,
      /** The chain between a pair (m): it can't stretch further. Shoot it (`chainHealth`) and both are freed. */
      chainLength: 6,
      chainHealth: 40,
      /**
       * Freed: the one that fights is this much faster; the other runs into the fog and is gone once it's `fleeGone`
       * metres off (or, cornered, sinks away after `fleeTime`).
       */
      rage: 1.3,
      fleeTime: 8,
      fleeGone: 24,
      attacks: {
        flail: { range: 2.8, windup: 0.62, active: 0.18, recover: 0.8, cooldown: 1.2, damage: 18, knockback: 6, arcDeg: 150, lunge: 1.2, weight: 1 },
        /**
         * The binding (the Devil's rule): the pair runs either side of you and snaps the chain tight across you. Caught,
         * you're held for `delay` and then struck for `damage` — unless you roll, and one roll always breaks it.
         */
        bind: { kind: 'bind', range: 5.5, windup: 1.25, active: 0.15, recover: 1.0, cooldown: 4.5, damage: 48, knockback: 8, arcDeg: 360, lunge: 0, weight: 1, delay: 1.5, radius: 0.9 },
      },
    },
    /**
     * Court-card minibosses (V2-5): rank is the verb (Knight mobility, Queen control, King command), Swords is the
     * flavour. Each escalates at the health fractions in `phases`.
     */
    knight: {
      health: 950,
      poise: 170,
      poiseRegen: 30,
      speed: 3.2,
      runSpeed: 5.8,
      accel: 26,
      turnRate: 5,
      sightRange: 34,
      leash: 70,
      staggerTime: 1.0,
      separation: 2.4,
      reward: 120,
      phases: [0.5],
      /** Hit and run: after striking it falls back this long before closing again. */
      retreatTime: 1.1,
      attacks: {
        /** A gap-closing charge down a wind lane, shown on the ground during the wind-up. */
        charge: { kind: 'charge', range: 18, windup: 0.95, active: 0.6, recover: 1.2, cooldown: 2.4, damage: 30, knockback: 9, arcDeg: 360, lunge: 0, weight: 1.2, speed: 19 },
        /** From phase 2: charge, turn, charge back. */
        recharge: { kind: 'charge', range: 18, windup: 0.85, active: 0.55, recover: 1.3, cooldown: 3.2, damage: 30, knockback: 9, arcDeg: 360, lunge: 0, weight: 1.6, speed: 20, hits: 2, comboWindup: 0.65, minPhase: 1 },
        slash: { range: 2.8, windup: 0.5, active: 0.14, recover: 0.8, cooldown: 0.8, damage: 24, knockback: 5, arcDeg: 130, lunge: 2.4, weight: 1, hits: 2, comboWindup: 0.32 },
      },
    },
    queen: {
      health: 820,
      poise: 140,
      poiseRegen: 30,
      speed: 2.6,
      runSpeed: 4.6,
      accel: 22,
      turnRate: 5,
      sightRange: 36,
      leash: 70,
      staggerTime: 1.0,
      separation: 2.4,
      reward: 160,
      holdRange: 11,
      phases: [0.5],
      attacks: {
        /** Lines of thrown blades with one gap to step into; the follow-up volley leaves the mirrored gap. */
        volley: { kind: 'volley', range: 26, windup: 1.0, active: 0.1, recover: 1.0, cooldown: 2.2, damage: 18, knockback: 3, arcDeg: 360, lunge: 0, weight: 1, speed: 17, lanes: 7, spacing: 1.7, hits: 2, comboWindup: 0.85 },
        storm: { kind: 'volley', range: 26, windup: 0.9, active: 0.1, recover: 1.2, cooldown: 3, damage: 18, knockback: 3, arcDeg: 360, lunge: 0, weight: 1.4, speed: 19, lanes: 9, spacing: 1.6, hits: 3, comboWindup: 0.7, minPhase: 1 },
        riposte: { range: 2.6, windup: 0.38, active: 0.12, recover: 0.7, cooldown: 1.5, damage: 20, knockback: 6, arcDeg: 140, lunge: 1.4, weight: 1 },
      },
    },
    king: {
      health: 1400,
      poise: 240,
      poiseRegen: 30,
      speed: 2.2,
      runSpeed: 3.4,
      accel: 16,
      turnRate: 3.4,
      sightRange: 36,
      leash: 70,
      staggerTime: 1.2,
      separation: 2.8,
      reward: 220,
      phases: [0.66, 0.33],
      /** Bailiffs he calls to his side at each phase. */
      squad: 2,
      attacks: {
        /** Marks where you stand; the verdict strikes there after `delay`. */
        verdict: { kind: 'verdict', range: 26, windup: 0.8, active: 0.1, recover: 0.9, cooldown: 4, damage: 34, knockback: 8, arcDeg: 360, lunge: 0, weight: 1, radius: 2.4, delay: 1.6, count: 1 },
        sentence: { kind: 'verdict', range: 26, windup: 0.8, active: 0.1, recover: 1.0, cooldown: 5, damage: 34, knockback: 8, arcDeg: 360, lunge: 0, weight: 1.3, radius: 2.4, delay: 1.6, count: 3, minPhase: 1 },
        judgement: { range: 3.6, windup: 1.0, active: 0.14, recover: 1.3, cooldown: 1.2, damage: 40, knockback: 9, arcDeg: 360, lunge: 0.6, weight: 1, radius: 2.2, reach: 2.4 },
        sweep: { range: 3.0, windup: 0.7, active: 0.2, recover: 1.0, cooldown: 1.8, damage: 26, knockback: 6, arcDeg: 170, lunge: 0.8, weight: 0.8, hits: 2, comboWindup: 0.45 },
      },
    },
    /**
     * The Tower's commons (V2-12). The Firebrand lobs fire (its landing ring fills as the pot flies; the timber it
     * lands on catches); the Faller drops from the storm when you come within `triggerRadius` of its perch, its
     * shadow growing for `fallTime`; the Builder hammers up barricades (`barricadeTime`); the Page of Wands lights a
     * signal fire (a long channel: stagger it) that calls `count` more.
     */
    firebrand: {
      health: 110,
      poise: 26,
      poiseRegen: 24,
      speed: 2.4,
      runSpeed: 4.2,
      accel: 20,
      turnRate: 5,
      sightRange: 26,
      leash: 34,
      holdRange: 11,
      staggerTime: 0.9,
      separation: 1.8,
      reward: 9,
      attacks: {
        pot: { range: 20, windup: 0.75, active: 0.1, recover: 0.9, cooldown: 2.2, damage: 18, knockback: 4, arcDeg: 360, lunge: 0, weight: 1, radius: 1.9, lob: 1.1, ignite: 2.2 },
        swipe: { range: 2.4, windup: 0.45, active: 0.14, recover: 0.7, cooldown: 1.0, damage: 16, knockback: 5, arcDeg: 120, lunge: 1.4, weight: 1 },
      },
    },
    faller: {
      health: 150,
      poise: 40,
      poiseRegen: 22,
      speed: 2.4,
      runSpeed: 4.4,
      accel: 20,
      turnRate: 5,
      sightRange: 22,
      leash: 30,
      staggerTime: 0.9,
      separation: 1.8,
      reward: 10,
      triggerRadius: 8,
      fallTime: 1.3,
      attacks: {
        /** Its landing (the ring under its fall), then a two-handed grab-and-throw up close. */
        grapple: { range: 2.2, windup: 0.6, active: 0.16, recover: 0.9, cooldown: 1.2, damage: 22, knockback: 9, arcDeg: 100, lunge: 1.6, weight: 1, radius: 1.8, ignite: 0 },
      },
    },
    builder: {
      health: 190,
      poise: 60,
      poiseRegen: 20,
      speed: 2.0,
      runSpeed: 3.4,
      accel: 16,
      turnRate: 4,
      sightRange: 22,
      leash: 30,
      staggerTime: 1.0,
      separation: 2.0,
      reward: 11,
      barricadeTime: 9,
      attacks: {
        /** A barricade hammered up between you (cover for the others; it stands `barricadeTime`). */
        raise: { kind: 'barricade', range: 14, windup: 0.9, active: 0.1, recover: 0.8, cooldown: 7, damage: 0, knockback: 0, arcDeg: 360, lunge: 0, weight: 1.2, radius: 3 },
        hammer: { range: 2.5, windup: 0.7, active: 0.16, recover: 0.9, cooldown: 1.1, damage: 24, knockback: 7, arcDeg: 100, lunge: 1.2, weight: 1 },
      },
    },
    pageWands: {
      health: 120,
      poise: 22,
      poiseRegen: 25,
      speed: 3.0,
      runSpeed: 5.2,
      accel: 26,
      turnRate: 7,
      sightRange: 30,
      leash: 36,
      holdRange: 14,
      alertRadius: 32,
      staggerTime: 1.0,
      separation: 1.6,
      reward: 18,
      attacks: {
        /** The signal fire: a long channel (stagger it, or kill it, to stop it); lit, it calls two Firebrands. */
        signal: { kind: 'signal', range: 60, windup: 2.6, active: 0.1, recover: 0.6, cooldown: 1e9, damage: 0, knockback: 0, arcDeg: 360, lunge: 0, weight: 0, count: 2, spawn: 'firebrand' },
        pot: { range: 20, windup: 0.7, active: 0.1, recover: 0.8, cooldown: 2.0, damage: 16, knockback: 4, arcDeg: 360, lunge: 0, weight: 1, radius: 1.7, lob: 1.0, ignite: 2 },
        jab: { range: 2.4, windup: 0.4, active: 0.12, recover: 0.6, cooldown: 1.0, damage: 14, knockback: 5, arcDeg: 90, lunge: 1.6, weight: 1 },
      },
    },
    /** The Queen of Wands' black cat: small, fast, hit and run. */
    cat: {
      health: 60,
      poise: 12,
      poiseRegen: 30,
      speed: 4.2,
      runSpeed: 7.4,
      accel: 36,
      turnRate: 10,
      sightRange: 26,
      leash: 40,
      staggerTime: 0.5,
      separation: 1.2,
      reward: 3,
      retreatTime: 0.8,
      attacks: {
        swipe: { range: 1.6, windup: 0.3, active: 0.1, recover: 0.35, cooldown: 0.5, damage: 8, knockback: 2, arcDeg: 120, lunge: 1.4, weight: 1, hits: 2, comboWindup: 0.18 },
      },
    },
    /**
     * The Pentacles court (V2-10): the same rank verbs in earth. The Knight's slow, unstoppable charge binds what it
     * hits; the Queen sows gilt seeds that sprout Imps unless trampled; the King hires Misers and rains coin that
     * lies where it falls (tempting, and heavy).
     */
    knightPentacles: {
      health: 1100,
      /** Unstoppable: shots don't stagger it (a parry still does). */
      poise: 100000,
      poiseRegen: 0,
      // (playtest: too slow; it walked where it should stalk)
      speed: 2.6,
      runSpeed: 4.2,
      accel: 18,
      turnRate: 4,
      sightRange: 34,
      leash: 70,
      staggerTime: 1.2,
      separation: 2.6,
      reward: 140,
      phases: [0.5],
      retreatTime: 0.8,
      attacks: {
        /** A slow lane charge that pins you (bound, then struck) instead of knocking you down. */
        charge: { kind: 'charge', binds: true, range: 15, windup: 1.1, active: 1.3, recover: 1.4, cooldown: 3, damage: 34, knockback: 6, arcDeg: 360, lunge: 0, weight: 1.2, speed: 13, delay: 1.4 },
        recharge: { kind: 'charge', binds: true, range: 15, windup: 1.05, active: 1.3, recover: 1.6, cooldown: 4, damage: 34, knockback: 6, arcDeg: 360, lunge: 0, weight: 1.5, speed: 14, hits: 2, comboWindup: 0.8, delay: 1.3, minPhase: 1 },
        maul: { range: 3.4, windup: 0.95, active: 0.14, recover: 1.1, cooldown: 1.2, damage: 32, knockback: 8, arcDeg: 360, lunge: 0.6, weight: 1, radius: 2.4, reach: 2.2 },
      },
    },
    queenPentacles: {
      health: 900,
      poise: 140,
      poiseRegen: 30,
      speed: 2.4,
      runSpeed: 4.2,
      accel: 20,
      turnRate: 5,
      sightRange: 36,
      leash: 70,
      staggerTime: 1.0,
      separation: 2.4,
      reward: 170,
      holdRange: 11,
      phases: [0.5],
      attacks: {
        /** Lines of thrown coin with a gap (the volley verb in earth). */
        coins: { kind: 'volley', range: 26, windup: 1.0, active: 0.1, recover: 1.0, cooldown: 2.4, damage: 16, knockback: 3, arcDeg: 360, lunge: 0, weight: 1, speed: 15, lanes: 7, spacing: 1.7, hits: 2, comboWindup: 0.85 },
        /** Gilt seeds in a ring around you: each sprouts an Imp when it ripens, unless you step on it first. */
        sow: { kind: 'sow', range: 26, windup: 0.8, active: 0.1, recover: 1.0, cooldown: 6, damage: 0, knockback: 0, arcDeg: 360, lunge: 0, weight: 1.1, radius: 1.3, delay: 3, count: 2, spawn: 'imp' },
        harvest: { kind: 'sow', range: 26, windup: 0.8, active: 0.1, recover: 1.1, cooldown: 6.5, damage: 0, knockback: 0, arcDeg: 360, lunge: 0, weight: 1.3, radius: 1.3, delay: 3, count: 4, spawn: 'imp', minPhase: 1 },
        riposte: { range: 2.6, windup: 0.4, active: 0.12, recover: 0.7, cooldown: 1.5, damage: 20, knockback: 6, arcDeg: 140, lunge: 1.4, weight: 1 },
      },
    },
    kingPentacles: {
      health: 1500,
      poise: 240,
      poiseRegen: 30,
      speed: 2.0,
      runSpeed: 3.2,
      accel: 16,
      turnRate: 3.4,
      sightRange: 36,
      leash: 70,
      staggerTime: 1.2,
      separation: 2.8,
      reward: 240,
      phases: [0.66, 0.33],
      /** Misers he hires at each phase. */
      squad: 2,
      attacks: {
        /** Coin rains where you stand and strikes; the coin stays on the floor (each pile a weight if taken). */
        coinRain: { kind: 'verdict', range: 26, windup: 0.8, active: 0.1, recover: 0.9, cooldown: 4, damage: 30, knockback: 7, arcDeg: 360, lunge: 0, weight: 1, radius: 2.4, delay: 1.6, count: 1, coins: 1 },
        fortune: { kind: 'verdict', range: 26, windup: 0.8, active: 0.1, recover: 1.0, cooldown: 5, damage: 30, knockback: 7, arcDeg: 360, lunge: 0, weight: 1.3, radius: 2.4, delay: 1.6, count: 3, coins: 1, minPhase: 1 },
        scepter: { range: 3.6, windup: 1.0, active: 0.14, recover: 1.3, cooldown: 1.2, damage: 38, knockback: 9, arcDeg: 360, lunge: 0.6, weight: 1, radius: 2.2, reach: 2.4 },
        sweep: { range: 3.0, windup: 0.7, active: 0.2, recover: 1.0, cooldown: 1.8, damage: 24, knockback: 6, arcDeg: 170, lunge: 0.8, weight: 0.8, hits: 2, comboWindup: 0.45 },
      },
    },
    /**
     * The Wands court (V2-12): the Knight's charge leaves the timber burning; the Queen's fire zones set it alight and
     * her cat comes at each phase; the King calls Firebrands and his phases burn the floor away.
     */
    knightWands: {
      health: 980,
      poise: 170,
      poiseRegen: 30,
      speed: 3.2,
      runSpeed: 6.0,
      accel: 26,
      turnRate: 5,
      sightRange: 34,
      leash: 70,
      staggerTime: 1.0,
      separation: 2.4,
      reward: 130,
      phases: [0.5],
      retreatTime: 1.1,
      attacks: {
        charge: { kind: 'charge', range: 18, windup: 0.95, active: 0.65, recover: 1.2, cooldown: 2.6, damage: 28, knockback: 9, arcDeg: 360, lunge: 0, weight: 1.2, speed: 19, ignite: 1.4 },
        recharge: { kind: 'charge', range: 18, windup: 0.85, active: 0.6, recover: 1.3, cooldown: 3.4, damage: 28, knockback: 9, arcDeg: 360, lunge: 0, weight: 1.6, speed: 20, hits: 2, comboWindup: 0.65, minPhase: 1, ignite: 1.4 },
        slash: { range: 2.8, windup: 0.5, active: 0.14, recover: 0.8, cooldown: 0.8, damage: 24, knockback: 5, arcDeg: 130, lunge: 2.4, weight: 1, hits: 2, comboWindup: 0.32 },
      },
    },
    queenWands: {
      health: 880,
      poise: 140,
      poiseRegen: 30,
      speed: 2.6,
      runSpeed: 4.6,
      accel: 22,
      turnRate: 5,
      sightRange: 36,
      leash: 70,
      staggerTime: 1.0,
      separation: 2.4,
      reward: 160,
      holdRange: 11,
      phases: [0.66, 0.33],
      /** Her black cat, called at each phase. */
      squad: 1,
      attacks: {
        /** Zones marked where you stand and where you're heading; they flare and the timber there catches. */
        firezone: { kind: 'verdict', range: 26, windup: 0.8, active: 0.1, recover: 0.9, cooldown: 3.2, damage: 26, knockback: 6, arcDeg: 360, lunge: 0, weight: 1, radius: 2.4, delay: 1.4, count: 1, ignite: 2.4 },
        blaze: { kind: 'verdict', range: 26, windup: 0.8, active: 0.1, recover: 1.0, cooldown: 4, damage: 26, knockback: 6, arcDeg: 360, lunge: 0, weight: 1.3, radius: 2.4, delay: 1.4, count: 3, ignite: 2.4, minPhase: 1 },
        riposte: { range: 2.6, windup: 0.4, active: 0.12, recover: 0.7, cooldown: 1.5, damage: 20, knockback: 6, arcDeg: 140, lunge: 1.4, weight: 1 },
      },
    },
    kingWands: {
      health: 1450,
      poise: 240,
      poiseRegen: 30,
      speed: 2.2,
      runSpeed: 3.4,
      accel: 16,
      turnRate: 3.4,
      sightRange: 36,
      leash: 70,
      staggerTime: 1.2,
      separation: 2.8,
      reward: 230,
      phases: [0.66, 0.33],
      squad: 2,
      attacks: {
        judgement: { range: 3.6, windup: 1.0, active: 0.14, recover: 1.3, cooldown: 1.2, damage: 38, knockback: 9, arcDeg: 360, lunge: 0.6, weight: 1, radius: 2.4, reach: 2.4, ignite: 2.6 },
        wildfire: { kind: 'verdict', range: 26, windup: 0.8, active: 0.1, recover: 1.0, cooldown: 4.5, damage: 30, knockback: 7, arcDeg: 360, lunge: 0, weight: 1.2, radius: 2.4, delay: 1.5, count: 3, ignite: 2.4, minPhase: 1 },
        sweep: { range: 3.0, windup: 0.7, active: 0.2, recover: 1.0, cooldown: 1.8, damage: 24, knockback: 6, arcDeg: 170, lunge: 0.8, weight: 0.8, hits: 2, comboWindup: 0.45 },
      },
    },
    /**
     * The Crowned Tower, the arcana (V2-12). Its arena is the top floor, all timber: at 66% and 33% a ring of it
     * cracks and falls into the storm, ending on a last platform under open sky.
     */
    crownedTower: {
      /** Wakes as you step into its arena (it stands ~32 m from the way in). */
      wakeRadius: 30,
      health: 3200,
      poise: 480,
      poiseRegen: 40,
      speed: 2.0,
      runSpeed: 3.0,
      accel: 12,
      turnRate: 2.6,
      sightRange: 60,
      leash: 200,
      staggerTime: 1.4,
      separation: 4,
      reward: 750,
      phases: [0.66, 0.33],
      attacks: {
        smash: { range: 10, windup: 1.15, active: 0.15, recover: 1.5, cooldown: 1.6, damage: 44, knockback: 11, arcDeg: 360, lunge: 1.0, weight: 1, radius: 3.4, reach: 5, ignite: 1.8 },
        lightning: { kind: 'verdict', range: 40, windup: 0.9, active: 0.1, recover: 1.0, cooldown: 3.5, damage: 34, knockback: 8, arcDeg: 360, lunge: 0, weight: 1, radius: 2.6, delay: 1.4, count: 1, ignite: 1.8 },
        storm: { kind: 'verdict', range: 40, windup: 0.9, active: 0.1, recover: 1.1, cooldown: 4, damage: 34, knockback: 8, arcDeg: 360, lunge: 0, weight: 1.3, radius: 2.6, delay: 1.4, count: 3, ignite: 1.8, minPhase: 1 },
        topple: { range: 30, windup: 0.85, active: 0.1, recover: 1.0, cooldown: 3, damage: 26, knockback: 6, arcDeg: 360, lunge: 0, weight: 0.9, radius: 2.2, lob: 1.2, ignite: 1.6, hits: 3, comboWindup: 0.4 },
        sweep: { range: 7, windup: 0.8, active: 0.22, recover: 1.1, cooldown: 1.2, damage: 30, knockback: 8, arcDeg: 160, lunge: 1.4, weight: 1, hits: 2, comboWindup: 0.5 },
      },
    },
    /**
     * The Moon's own (V2-14). Dog and Wolf come as a pair: either may stop and howl (a telegraphed wind-up), and the
     * other is maddened for `rageTime`. The Crayfish lurks unseen until you come within `triggerRadius`, its ripples
     * spread for `fallTime`, and it surges out. Phantoms are always reflections. The Page of Cups pours fish.
     */
    dog: {
      health: 80,
      poise: 18,
      poiseRegen: 28,
      speed: 3.6,
      runSpeed: 6.8,
      accel: 30,
      turnRate: 8,
      sightRange: 24,
      leash: 34,
      staggerTime: 0.7,
      separation: 1.4,
      reward: 5,
      retreatTime: 0.7,
      rage: 1.35,
      rageTime: 6,
      attacks: {
        bite: { range: 2.0, windup: 0.36, active: 0.12, recover: 0.5, cooldown: 0.7, damage: 12, knockback: 3, arcDeg: 100, lunge: 1.8, weight: 1 },
        howl: { kind: 'howl', range: 30, windup: 1.1, active: 0.2, recover: 0.6, cooldown: 7, damage: 0, knockback: 0, arcDeg: 360, lunge: 0, weight: 0.7 },
      },
    },
    wolf: {
      health: 150,
      poise: 34,
      poiseRegen: 24,
      speed: 3.2,
      runSpeed: 6.2,
      accel: 26,
      turnRate: 7,
      sightRange: 26,
      leash: 36,
      staggerTime: 0.8,
      separation: 1.6,
      reward: 9,
      rage: 1.35,
      rageTime: 6,
      attacks: {
        maul: { range: 2.4, windup: 0.5, active: 0.16, recover: 0.7, cooldown: 0.9, damage: 20, knockback: 6, arcDeg: 110, lunge: 2.4, weight: 1, hits: 2, comboWindup: 0.28 },
        howl: { kind: 'howl', range: 30, windup: 1.1, active: 0.2, recover: 0.6, cooldown: 8, damage: 0, knockback: 0, arcDeg: 360, lunge: 0, weight: 0.7 },
      },
    },
    crayfish: {
      health: 200,
      poise: 60,
      poiseRegen: 22,
      speed: 2.0,
      runSpeed: 3.6,
      accel: 16,
      turnRate: 4,
      sightRange: 20,
      leash: 28,
      /** The armoured front turns blows; its soft tail is the weak spot. */
      guardConeDeg: 100,
      staggerTime: 1.0,
      separation: 2.0,
      reward: 12,
      triggerRadius: 6.5,
      fallTime: 1.1,
      attacks: {
        /** Its surge: out of the ripples where you stood (the ring hurts), then pincers. */
        surge: { range: 2.4, windup: 0.6, active: 0.16, recover: 0.9, cooldown: 1.0, damage: 26, knockback: 9, arcDeg: 100, lunge: 1.2, weight: 1, radius: 2.0 },
        pinch: { range: 2.3, windup: 0.5, active: 0.14, recover: 0.8, cooldown: 0.9, damage: 18, knockback: 5, arcDeg: 90, lunge: 1.0, weight: 1, hits: 2, comboWindup: 0.26 },
      },
    },
    phantom: {
      health: 1,
      poise: 1,
      poiseRegen: 0,
      speed: 2.4,
      runSpeed: 4.6,
      accel: 20,
      turnRate: 6,
      sightRange: 26,
      leash: 36,
      staggerTime: 0.5,
      separation: 1.6,
      reward: 0,
      attacks: {
        reach: { range: 2.4, windup: 0.6, active: 0.14, recover: 0.7, cooldown: 0.9, damage: 18, knockback: 5, arcDeg: 110, lunge: 1.8, weight: 1 },
      },
    },
    pageCups: {
      health: 120,
      poise: 22,
      poiseRegen: 25,
      speed: 3.0,
      runSpeed: 5.2,
      accel: 26,
      turnRate: 7,
      sightRange: 30,
      leash: 36,
      holdRange: 13,
      alertRadius: 30,
      staggerTime: 1.0,
      separation: 1.6,
      reward: 18,
      attacks: {
        /** Fish poured from its cup (a channel you can stagger); two at a time, again and again. */
        pour: { kind: 'spawn', range: 30, windup: 1.4, active: 0.1, recover: 0.8, cooldown: 7, damage: 0, knockback: 0, arcDeg: 360, lunge: 0, weight: 1, count: 2, spawn: 'fish' },
        jab: { range: 2.4, windup: 0.4, active: 0.12, recover: 0.6, cooldown: 1.0, damage: 14, knockback: 5, arcDeg: 90, lunge: 1.6, weight: 1 },
      },
    },
    fish: {
      health: 30,
      poise: 6,
      poiseRegen: 30,
      speed: 4.0,
      runSpeed: 7.0,
      accel: 34,
      turnRate: 10,
      sightRange: 22,
      leash: 30,
      staggerTime: 0.4,
      separation: 1.0,
      reward: 1,
      retreatTime: 0.6,
      attacks: {
        nip: { range: 1.4, windup: 0.3, active: 0.1, recover: 0.35, cooldown: 0.5, damage: 6, knockback: 1, arcDeg: 110, lunge: 1.4, weight: 1 },
      },
    },
    /**
     * The Cups court (V2-14). The Knight sets down a cup that heals or poisons (the tell: the true cup is full of
     * moonlight, the poisoned one is dark); the Queen makes two copies of herself and takes one's place (only she
     * casts a shadow); the King sends tidal waves across the room, wall to wall: roll through them.
     */
    knightCups: {
      health: 980,
      poise: 170,
      poiseRegen: 30,
      speed: 3.2,
      runSpeed: 5.8,
      accel: 26,
      turnRate: 5,
      sightRange: 34,
      leash: 70,
      staggerTime: 1.0,
      separation: 2.4,
      reward: 130,
      phases: [0.5],
      retreatTime: 1.1,
      attacks: {
        charge: { kind: 'charge', range: 18, windup: 0.95, active: 0.6, recover: 1.2, cooldown: 2.4, damage: 28, knockback: 9, arcDeg: 360, lunge: 0, weight: 1.2, speed: 19 },
        /** The offered cup: set down between you; drink (walk over it) for good or ill. */
        offer: { kind: 'offer', range: 26, minRange: 6, windup: 0.9, active: 0.1, recover: 0.9, cooldown: 9, damage: 30, knockback: 0, arcDeg: 360, lunge: 0, weight: 1 },
        slash: { range: 2.8, windup: 0.5, active: 0.14, recover: 0.8, cooldown: 0.8, damage: 24, knockback: 5, arcDeg: 130, lunge: 2.4, weight: 1, hits: 2, comboWindup: 0.32 },
      },
    },
    queenCups: {
      health: 900,
      poise: 140,
      poiseRegen: 30,
      speed: 2.6,
      runSpeed: 4.6,
      accel: 22,
      turnRate: 5,
      sightRange: 36,
      leash: 70,
      staggerTime: 1.0,
      separation: 2.4,
      reward: 170,
      holdRange: 11,
      phases: [0.66, 0.33],
      attacks: {
        volley: { kind: 'volley', range: 26, windup: 1.0, active: 0.1, recover: 1.0, cooldown: 2.4, damage: 18, knockback: 3, arcDeg: 360, lunge: 0, weight: 1, speed: 16, lanes: 7, spacing: 1.7, hits: 2, comboWindup: 0.85 },
        /** Two copies of her rise; she trades places with one. Only she casts a shadow. */
        mirror: { kind: 'mirror', range: 30, windup: 1.0, active: 0.1, recover: 0.8, cooldown: 12, damage: 0, knockback: 0, arcDeg: 360, lunge: 0, weight: 1.2, count: 2 },
        riposte: { range: 2.6, windup: 0.4, active: 0.12, recover: 0.7, cooldown: 1.5, damage: 20, knockback: 6, arcDeg: 140, lunge: 1.4, weight: 1 },
      },
    },
    kingCups: {
      health: 1500,
      poise: 240,
      poiseRegen: 30,
      speed: 2.0,
      runSpeed: 3.2,
      accel: 16,
      turnRate: 3.4,
      sightRange: 40,
      leash: 70,
      staggerTime: 1.2,
      separation: 2.8,
      reward: 240,
      phases: [0.66, 0.33],
      squad: 2,
      attacks: {
        /** A tidal wave down the room toward you, wall to wall: roll through it (the i-frames carry you). */
        wave: { kind: 'wave', range: 30, windup: 1.3, active: 2.2, recover: 1.0, cooldown: 4.5, damage: 30, knockback: 10, arcDeg: 360, lunge: 0, weight: 1, speed: 12, lanes: 9, spacing: 2.2 },
        flood: { kind: 'wave', range: 30, windup: 1.1, active: 2.0, recover: 1.2, cooldown: 5, damage: 30, knockback: 10, arcDeg: 360, lunge: 0, weight: 1.3, speed: 14, lanes: 11, spacing: 2.2, hits: 2, comboWindup: 0.9, minPhase: 1 },
        trident: { range: 3.4, windup: 0.9, active: 0.14, recover: 1.2, cooldown: 1.2, damage: 34, knockback: 8, arcDeg: 360, lunge: 0.6, weight: 1, radius: 2.2, reach: 2.4 },
      },
    },
    /**
     * The Shadow, the last arcana (V2-14): the Moon's light casts her own shadow, and it fights with her moves. Her
     * shots (fast, read by the wind-up), her rifle (a long lane, a heavy bolt), her three-swing combo, her charged
     * strike; it rolls out of your line of fire. At 60% and 30% the Moon shifts and it splits into reflections (only
     * the real one casts a shadow).
     */
    shadow: {
      /** Wakes as you step into its arena (it stands ~32 m from the way in). */
      wakeRadius: 30,
      health: 2600,
      poise: 380,
      poiseRegen: 40,
      speed: 3.0,
      runSpeed: 5.4,
      accel: 24,
      turnRate: 5,
      sightRange: 60,
      leash: 200,
      staggerTime: 1.2,
      separation: 2,
      reward: 800,
      phases: [0.6, 0.3],
      /** How often it rolls aside when you aim at it (s), and how far. */
      dodgeCooldown: 2.2,
      dodgeSpeed: 9,
      attacks: {
        shots: { range: 26, windup: 0.5, active: 0.1, recover: 0.4, cooldown: 1.4, damage: 10, knockback: 2, arcDeg: 360, lunge: 0, weight: 1, speed: 26, hits: 3, comboWindup: 0.22 },
        rifle: { kind: 'volley', range: 32, windup: 1.1, active: 0.1, recover: 1.0, cooldown: 3.5, damage: 34, knockback: 8, arcDeg: 360, lunge: 0, weight: 1, speed: 30, lanes: 1, spacing: 1 },
        combo: { range: 2.8, windup: 0.45, active: 0.14, recover: 0.8, cooldown: 1.0, damage: 22, knockback: 6, arcDeg: 140, lunge: 2.4, weight: 1.2, hits: 3, comboWindup: 0.3 },
        charged: { range: 4, windup: 1.0, active: 0.16, recover: 1.2, cooldown: 2.5, damage: 40, knockback: 10, arcDeg: 360, lunge: 1.4, weight: 0.8, radius: 2.8, reach: 1.8 },
        split: { kind: 'mirror', range: 40, windup: 1.0, active: 0.1, recover: 0.6, cooldown: 1e9, damage: 0, knockback: 0, arcDeg: 360, lunge: 0, weight: 0, count: 2 },
      },
    },
    /**
     * The Devil, the arcana (V2-10). Phase 1: claws, a torch brand with a ground ring, and shackles that close where
     * you stand (bound if you're caught; roll). At half health he stops and offers a pact: double the damage you deal,
     * and double what you take. Phase 2 adds coin rain and a second shackle.
     */
    devil: {
      /** Wakes as you step into its arena (it stands ~32 m from the way in). */
      wakeRadius: 30,
      health: 3000,
      poise: 460,
      poiseRegen: 40,
      speed: 2.2,
      runSpeed: 3.6,
      accel: 14,
      turnRate: 2.6,
      sightRange: 60,
      leash: 200,
      staggerTime: 1.4,
      separation: 4,
      reward: 700,
      phases: [0.5],
      /** How long he holds out the pact (s); E accepts, letting it pass refuses. */
      pactTime: 6,
      attacks: {
        rake: { range: 7.5, windup: 0.8, active: 0.22, recover: 1.1, cooldown: 1.0, damage: 32, knockback: 8, arcDeg: 160, lunge: 1.6, weight: 1, hits: 2, comboWindup: 0.5 },
        brand: { range: 10, windup: 1.2, active: 0.15, recover: 1.5, cooldown: 1.8, damage: 44, knockback: 11, arcDeg: 360, lunge: 1.0, weight: 0.9, radius: 3.4, reach: 5.5 },
        shackles: { kind: 'shackle', range: 34, windup: 0.9, active: 0.1, recover: 1.0, cooldown: 4, damage: 40, knockback: 8, arcDeg: 360, lunge: 0, weight: 1, radius: 2.2, delay: 1.3, count: 1 },
        chains: { kind: 'shackle', range: 34, windup: 0.9, active: 0.1, recover: 1.1, cooldown: 4.5, damage: 40, knockback: 8, arcDeg: 360, lunge: 0, weight: 1.1, radius: 2.2, delay: 1.3, count: 3, minPhase: 1 },
        coinRain: { kind: 'verdict', range: 34, windup: 0.9, active: 0.1, recover: 1.0, cooldown: 4, damage: 34, knockback: 8, arcDeg: 360, lunge: 0, weight: 0.9, radius: 2.8, delay: 1.5, count: 3, coins: 1, minPhase: 1 },
      },
    },
    /**
     * Justice, the arcana (V2-6). Phase 1 is the sword: mirrored combos. In phase 2 the scales come down: two great
     * pans settle into the arena, and what she throws onto one side lands on the other (strikes echo across her
     * arena's axis).
     */
    justice: {
      /** Wakes as you step into its arena (it stands ~32 m from the way in). */
      wakeRadius: 30,
      health: 2600,
      poise: 420,
      poiseRegen: 40,
      speed: 2.4,
      runSpeed: 3.8,
      accel: 14,
      turnRate: 2.8,
      sightRange: 60,
      leash: 200,
      staggerTime: 1.4,
      separation: 4,
      reward: 600,
      phases: [0.5],
      attacks: {
        edict: { range: 8, windup: 0.8, active: 0.22, recover: 1.2, cooldown: 1.0, damage: 34, knockback: 8, arcDeg: 170, lunge: 1.6, weight: 1, hits: 2, comboWindup: 0.5 },
        verdictOfThree: { range: 8, windup: 0.75, active: 0.22, recover: 1.3, cooldown: 1.6, damage: 34, knockback: 8, arcDeg: 170, lunge: 1.6, weight: 1.2, hits: 3, comboWindup: 0.44, minPhase: 1 },
        cleave: { range: 10, windup: 1.2, active: 0.15, recover: 1.6, cooldown: 1.6, damage: 46, knockback: 11, arcDeg: 360, lunge: 1.0, weight: 0.9, radius: 3.6, reach: 6 },
        weigh: { kind: 'volley', range: 34, windup: 1.1, active: 0.1, recover: 1.1, cooldown: 3.0, damage: 22, knockback: 4, arcDeg: 360, lunge: 0, weight: 0.8, speed: 18, lanes: 9, spacing: 2.0, hits: 2, comboWindup: 0.9 },
        balance: { kind: 'verdict', range: 34, windup: 0.9, active: 0.1, recover: 1.0, cooldown: 3.5, damage: 36, knockback: 9, arcDeg: 360, lunge: 0, weight: 1.1, radius: 3.0, delay: 1.5, count: 1, minPhase: 1 },
      },
    },
    /**
     * The Devil's temptation (V2-9): what a hoard pays and what taking it costs. The bell wakes everyone within
     * `bellRadius`; each weight shortens rolls and slows the walk until you rest; an ambush brings Imps up through the
     * cracked floor around it. A risk branch's hoard pays `branchMul` times as much.
     */
    /** Coin the King of Pentacles' rain leaves on the floor: each pile pays this and weighs like a chained hoard. */
    coinPile: { pentacles: 15, pickupRadius: 1.2 },
    hoard: {
      pentacles: { bell: 40, weight: 60, ambush: 80 },
      branchMul: 2,
      bellRadius: 36,
      weightRollMul: 0.82,
      weightMoveMul: 0.9,
      weightMax: 3,
      ambushImps: 2,
      ambushBranchImps: 3,
    },
    /** How far each noise carries (m). Walking is nearly silent: the Blindfold hunts gunfire and haste. */
    noise: { pistol: 42, rifle: 55, blade: 16, sprint: 9, roll: 7, walk: 2.5 },
    hitFlashTime: 0.08,
    corpseTime: 5,
    /** An enemy this far below where it stood has fallen off the stage (m). */
    fallDepth: 10,
    /** A melee blow lands within the attacker's arm-and-weapon reach plus this much (her body, a little grace) (m). */
    reachMargin: 0.7,
    /** Idle enemies beyond this distance are hidden and skip their update (they're lost in the fog). */
    sleepDistance: 75,
  },
  dummy: {
    health: 220,
    respawnTime: 2.2,
    flinchStiffness: 140,
    flinchDamping: 9,
    flinchPerDamage: 0.12,
    slideSpeed: 5.6,
    slideRange: 9.6,
    poise: 40,
    poiseRegenDelay: 1,
    poiseRegen: 30,
    staggerTime: 0.9,
    /** Guard dummies block blows arriving within this cone of their front (degrees). */
    guardConeDeg: 120,
  },
  audio: {
    master: 0.7,
    hitGain: 0.5,
    critGain: 0.6,
    killGain: 0.7,
    reloadGain: 0.5,
    footstepGain: 0.12,
    sfxGain: 0.8,
  },
  debug: {
    slowmo: false,
    slowmoScale: 0.25,
    godMode: false,
    showIK: false,
    showHitboxes: false,
    showAI: false,
    showGraph: false,
    overview: false,
    showStats: true,
  },
  /** Justice's unbinding (V2-7): meet a blow as it lands. V to parry, once Justice has fallen. */
  parry: {
    window: 0.2,
    recover: 0.38,
    coneDeg: 140,
    /** SwordRifle charges a parry pours back. */
    chargeGain: 1,
    hitstop: 0.12,
  },
  swap: {
    lowerTime: 0.16,
    raiseTime: 0.2,
    dropDistance: 0.4,
    tiltDeg: 50,
    /** The SwordRifle rides on her back when it isn't in hand: reaching over the shoulder to stow or draw it. */
    stowTime: 0.38,
    drawTime: 0.36,
  },
  weapons: {
    pistol: AUTO_PISTOL,
    swordRifle: SWORD_RIFLE,
  },
  /** The SwordRifle's sword mode (swings, combo, charged strike, charge economy). */
  melee: SWORD_MELEE,
  swordRifle: {
    /** Committed rifle ⇄ sword transform, seconds (× the repair stage's switchMul). */
    switchTime: 0.4,
    /** 0 = rusted (the start) … 4 = fully restored. See REPAIR_STAGES in src/weapons/defs.ts. */
    repairStage: 0,
    /** Charge cell flare when a hit refills a charge, seconds. */
    cellFlareTime: 0.5,
  },
};

export type Tuning = typeof tuning;

/** Snapshot of defaults for "reset". */
export const DEFAULT_TUNING_JSON = JSON.stringify(tuning);

/** Deep-assign `src` into `dst` in place, keeping object identity (systems hold references). */
export function deepAssign(dst: Record<string, unknown>, src: Record<string, unknown>) {
  for (const k of Object.keys(src)) {
    const sv = src[k];
    const dv = dst[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && dv && typeof dv === 'object') {
      deepAssign(dv as Record<string, unknown>, sv as Record<string, unknown>);
    } else if (k in dst && typeof dv === typeof sv) {
      dst[k] = sv;
    }
  }
}
