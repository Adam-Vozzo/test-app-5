// A virtual thumbstick, pure (touch controls, V2-18): how far the thumb has dragged from where it landed becomes a
// move vector. Inside the dead zone it reads zero; past it the push ramps up to 1 at the rim; held at the rim it
// sprints. Screen y grows downward, so dragging up is forward (+y).

export interface StickTune {
  /** How far the thumb travels to the rim (px). */
  radius: number;
  /** The share of the radius that reads as nothing (thumbs never land perfectly still). */
  deadzone: number;
  /** The share of the radius past which a forward push sprints. */
  sprintAt: number;
}

export interface StickRead {
  /** Right is +x, forward (up the screen) is +y; length 0..1. */
  x: number;
  y: number;
  /** Pushed to the rim: run. */
  sprint: boolean;
  /** Where the knob is drawn, relative to the base (px), clamped to the rim. */
  knobX: number;
  knobY: number;
}

export function readStick(dx: number, dy: number, t: StickTune): StickRead {
  const len = Math.hypot(dx, dy);
  const r = Math.max(1, t.radius);
  const k = len > r ? r / len : 1;
  const knobX = dx * k;
  const knobY = dy * k;
  const raw = Math.min(1, len / r);
  if (raw <= t.deadzone || len < 1e-6) return { x: 0, y: 0, sprint: false, knobX, knobY };
  const mag = (raw - t.deadzone) / Math.max(1e-6, 1 - t.deadzone);
  return { x: (dx / len) * mag, y: (-dy / len) * mag, sprint: raw >= t.sprintAt, knobX, knobY };
}
