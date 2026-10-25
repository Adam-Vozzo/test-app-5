import { describe, expect, it } from 'vitest';
import { bladePose, chargeAfterHit, inGuardCone, SwingState, type MeleeTiming, type SwingDef, type SwingEvent, type SwingInput } from '../src/weapons/swing';

const swing = (over: Partial<SwingDef> = {}): SwingDef => ({
  windup: 0.1,
  active: 0.1,
  recover: 0.3,
  damage: 10,
  lunge: 1,
  stagger: 5,
  knockback: 1,
  yawFromDeg: -100,
  yawToDeg: 90,
  pitchFromDeg: -10,
  pitchToDeg: -20,
  rollDeg: -80,
  ...over,
});
const M: MeleeTiming = { combo: [swing(), swing(), swing({ recover: 0.5 })], charged: swing({ windup: 0.05, active: 0.15, recover: 0.6 }), comboWindow: 0.25, cancelInto: 0.4, chargeHold: 0.4 };
const NONE: SwingInput = { light: false, heavyHeld: false, heavyPressed: false, heavyReleased: false };
const DT = 1 / 60;

/** Run frames, pressing light on the given frame numbers. */
function run(s: SwingState, frames: number, inp: (f: number) => SwingInput = () => NONE) {
  const ev: SwingEvent[] = [];
  for (let f = 0; f < frames; f++) s.step(DT, inp(f), M, ev);
  return ev;
}

describe('melee swing state', () => {
  it('a tap runs windup → active → recover → idle', () => {
    const s = new SwingState();
    const ev = run(s, 40, (f) => ({ ...NONE, light: f === 0 }));
    expect(ev.map((e) => e.type)).toEqual(['begin', 'activeStart', 'activeEnd', 'end']);
    expect(s.phase).toBe('idle');
  });

  it('a press during the swing chains the next one, up to the finisher', () => {
    const s = new SwingState();
    // Mash: press every 5 frames for a second.
    const ev = run(s, 90, (f) => ({ ...NONE, light: f % 5 === 0 }));
    const begins = ev.filter((e) => e.type === 'begin').map((e) => (e as { index: number }).index);
    expect(begins.slice(0, 3)).toEqual([0, 1, 2]);
  });

  it('a press after the combo window does not chain', () => {
    const s = new SwingState();
    // windup+active = 0.2 s; recover starts then. Press at 0.2 + 0.28 s (past the 0.25 s window, before recovery ends).
    const late = Math.round((0.2 + 0.28) / DT);
    const ev = run(s, 60, (f) => ({ ...NONE, light: f === 0 || f === late }));
    const begins = ev.filter((e) => e.type === 'begin');
    expect(begins.length).toBe(1);
  });

  it('holding RMB charges, and releasing when ready strikes', () => {
    const s = new SwingState();
    const hold = Math.ceil(0.45 / DT);
    const ev = run(s, hold + 60, (f) => ({ ...NONE, heavyPressed: f === 0, heavyHeld: f < hold, heavyReleased: f === hold }));
    const types = ev.map((e) => e.type);
    expect(types.slice(0, 3)).toEqual(['chargeStart', 'chargeReady', 'begin']);
    expect(ev.find((e) => e.type === 'begin')).toMatchObject({ charged: true });
    expect(types).toContain('activeStart');
  });

  it('releasing RMB early cancels the charge without striking', () => {
    const s = new SwingState();
    const ev = run(s, 30, (f) => ({ ...NONE, heavyPressed: f === 0, heavyHeld: f < 10, heavyReleased: f === 10 }));
    expect(ev.map((e) => e.type)).toEqual(['chargeStart', 'chargeCancel']);
    expect(s.phase).toBe('idle');
  });

  it('only recovery and charging can be rolled out of', () => {
    const s = new SwingState();
    s.step(DT, { ...NONE, light: true }, M);
    expect(s.phase).toBe('windup');
    expect(s.canCancel).toBe(false);
    run(s, 8);
    expect(s.phase).toBe('active');
    expect(s.canCancel).toBe(false);
    run(s, 6);
    expect(s.phase).toBe('recover');
    expect(s.canCancel).toBe(true);
  });

  it('a long frame steps through every phase without skipping events', () => {
    const s = new SwingState();
    s.step(DT, { ...NONE, light: true }, M);
    const ev = s.step(0.25, NONE, M);
    expect(ev.map((e) => e.type)).toEqual(['activeStart', 'activeEnd']);
  });

  it('the blade pose is continuous across phase boundaries', () => {
    const s = new SwingState();
    const guard = { yaw: 0.2, pitch: 0.4, roll: 0 };
    const charge = { yaw: 0, pitch: 2.4, roll: 0 };
    const out = { yaw: 0, pitch: 0, roll: 0 };
    s.step(DT, { ...NONE, light: true }, M);
    let prev = { ...bladePose(s, M, guard, charge, out) };
    for (let f = 0; f < 40; f++) {
      s.step(DT, NONE, M);
      const p = bladePose(s, M, guard, charge, out);
      // Big jumps only happen inside the fast active sweep; never a teleport at a boundary.
      expect(Math.abs(p.yaw - prev.yaw)).toBeLessThan(1.2);
      prev = { ...p };
    }
    expect(prev).toEqual(guard);
  });
});

describe('charge economy', () => {
  it('a hit adds a charge, capped per swing and at the maximum', () => {
    expect(chargeAfterHit(3, 6, 1, 0, 1)).toBe(4);
    expect(chargeAfterHit(3, 6, 1, 1, 1)).toBe(3);
    expect(chargeAfterHit(6, 6, 1, 0, 2)).toBe(6);
    expect(chargeAfterHit(5, 6, 2, 0, 2)).toBe(6);
  });
});

describe('guard cone', () => {
  it('blocks blows at its front and not from the flank or behind', () => {
    // Guard faces +Z. A blow from in front travels along -Z.
    expect(inGuardCone(0, 1, 0, -1, 120)).toBe(true);
    expect(inGuardCone(0, 1, 0.5, -0.5, 120)).toBe(true);
    expect(inGuardCone(0, 1, -1, 0, 120)).toBe(false);
    expect(inGuardCone(0, 1, 0, 1, 120)).toBe(false);
  });
});
