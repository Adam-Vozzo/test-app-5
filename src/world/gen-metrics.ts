// Level generation: measures of a generated level's shape (LEVELS.md → Measuring the generator). Pure: no Three/DOM.
// The generator's expressive range, read off its output rather than its parameters: how straight the way runs, how
// often it turns, how far it climbs or falls, how many landings it turns on, and how often you see a room long
// before you reach it. `tests/gen-metrics.test.ts` holds each dimension to its card's shape with these.
import { landmarkShare, occluders, type LevelParts } from './gen-validate';
import { EYE, segmentHitsOccluder } from './gen-sight';
import { wrapAngle } from './gen-space';

export interface LevelMetrics {
  /** Start to exit in a straight line, over the length of the way between them (1: dead straight). */
  straightness: number;
  /** Times the way's heading swings by more than 15° from one room to the next. */
  turns: number;
  /** The spread of the critical rooms' headings (circular standard deviation, radians; 0: all one way). */
  headingSpread: number;
  /** Highest floor minus lowest (m). */
  heightRange: number;
  /** Landings the connectors turn on. */
  landings: number;
  /** Share of critical rooms the landmark is in sight from. */
  landmarkShare: number;
  /** Rooms seen before they're reached: in plain sight from a room three or more steps earlier on the way. */
  seenEarly: number;
}

export function levelMetrics(p: LevelParts): LevelMetrics {
  const { graph, space } = p;
  const crit = graph.critical.map((id) => space.rooms.find((r) => r.node === id)!);
  let len = 0;
  let turns = 0;
  for (let i = 1; i < crit.length; i++) {
    len += Math.hypot(crit[i].x - crit[i - 1].x, crit[i].z - crit[i - 1].z);
    if (Math.abs(wrapAngle(crit[i].yaw - crit[i - 1].yaw)) > (15 * Math.PI) / 180) turns++;
  }
  const a = crit[0];
  const b = crit[crit.length - 1];
  const sx = crit.reduce((t, r) => t + Math.sin(r.yaw), 0) / crit.length;
  const cx = crit.reduce((t, r) => t + Math.cos(r.yaw), 0) / crit.length;
  const rbar = Math.min(1, Math.hypot(sx, cx));
  const ys = space.rooms.map((r) => r.y);
  const occ = occluders(p);
  // Eye to eye, room middle to room middle: occluded by anything but the two rooms' own floors.
  const sees = (i: number, j: number) => {
    const e: [number, number, number] = [crit[i].x, crit[i].y + EYE, crit[i].z];
    const t: [number, number, number] = [crit[j].x, crit[j].y + EYE, crit[j].z];
    return !occ.some((o) => segmentHitsOccluder(e, t, o) && !(o.y1 === crit[i].y && o.x === crit[i].x && o.z === crit[i].z) && !(o.y1 === crit[j].y && o.x === crit[j].x && o.z === crit[j].z));
  };
  let seenEarly = 0;
  for (let j = 3; j < crit.length; j++) {
    for (let i = 0; i <= j - 3; i++) {
      if (sees(i, j)) {
        seenEarly++;
        break;
      }
    }
  }
  return {
    straightness: Math.hypot(b.x - a.x, b.z - a.z) / Math.max(len, 1e-6),
    turns,
    headingSpread: Math.sqrt(-2 * Math.log(Math.max(rbar, 1e-9))),
    heightRange: Math.max(...ys) - Math.min(...ys),
    landings: space.connectors.reduce((t, c) => t + c.bends.length, 0),
    landmarkShare: landmarkShare(p, occ),
    seenEarly,
  };
}

/** Means over many levels (and how many distinct room-kind sequences they ran). */
export function meanMetrics(ms: LevelMetrics[]): LevelMetrics {
  const keys = Object.keys(ms[0]) as (keyof LevelMetrics)[];
  const out = {} as LevelMetrics;
  for (const k of keys) out[k] = ms.reduce((t, m) => t + m[k], 0) / ms.length;
  return out;
}
