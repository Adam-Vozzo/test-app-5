// The level generator (LEVELS.md → Generation pipeline). Pure: no Three/DOM.
//
//   seed → script → mission graph → space → kit structure → encounters → dressing → validate ─┬→ LevelLayout
//                                                                                             └→ fail: reseed
//
// Each layer forks the RNG by name, so changing the dressing never moves a wall. A failed attempt re-rolls with
// hash(seed, attempt); the report says which checks failed and how many attempts it took.
import { hash2, makeRng } from '../core/rng';
import type { DimensionDef } from './dimensions';
import { dress, encounters, furnish, type Dressing, type Furnishing, type Socket } from './gen-dress';
import { levelScript, missionGraph, type LevelScript, type MissionGraph } from './gen-graph';
import { embed, embedFailure, roomRect, type Rect, type Space } from './gen-space';
import { validate } from './gen-validate';

export interface LevelLayout {
  dimension: string;
  level: number;
  seed: number;
  script: LevelScript;
  graph: MissionGraph;
  space: Space;
  furn: Furnishing;
  sockets: Socket[];
  dressing: Dressing;
  bounds: Rect;
}

export interface LevelReport {
  ok: boolean;
  attempts: number;
  /** Per failed attempt: the first few reasons. */
  failures: string[][];
  ms: number;
}

export const MAX_ATTEMPTS = 24;

/** Rules that depend on enemy feel numbers, passed in so generation stays free of tuning. */
export interface GenOptions {
  /** The least distance a ranged enemy may start from its room's entry (m). */
  rangedMin?: number;
}

/** One attempt with a given RNG seed. Returns the parts and what failed (empty = valid). */
export function attemptLevel(dim: DimensionDef, level: number, seed: number, opts: GenOptions = {}): { layout: LevelLayout | null; fail: string[] } {
  const rng = makeRng(seed).fork(`${dim.id}-level${level}`);
  const script = levelScript(dim, level, rng.fork('script'));
  const graph = missionGraph(dim, script, rng.fork('graph'));
  if (!graph) return { layout: null, fail: ['graph: no order satisfies the constraints'] };
  const space = embed(dim, graph, rng.fork('space'));
  if (!space) return { layout: null, fail: [`space: ${embedFailure}`] };
  const furn = furnish(dim, space, rng.fork('kits'), graph);
  const sockets = encounters(dim, graph, space, furn, level, rng.fork('encounters'), opts.rangedMin ?? 0);
  const dressing = dress(dim, graph, space, furn, sockets, rng.fork('dress'), level);
  const b = space.rooms.map((r) => roomRect(r));
  const bounds = {
    minX: Math.min(...b.map((r) => r.minX)),
    maxX: Math.max(...b.map((r) => r.maxX)),
    minZ: Math.min(...b.map((r) => r.minZ)),
    maxZ: Math.max(...b.map((r) => r.maxZ)),
  };
  const layout: LevelLayout = { dimension: dim.id, level, seed, script, graph, space, furn, sockets, dressing, bounds };
  return { layout, fail: validate({ dim, script, graph, space, furn, sockets, dressing, rangedMin: opts.rangedMin ?? 0 }) };
}

/** Generate a valid level for (dimension, level, seed), reseeding on failure. Same inputs → same level. */
export function generateLevel(dim: DimensionDef, level: number, seed: number, opts: GenOptions = {}): { layout: LevelLayout; report: LevelReport } {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const failures: string[][] = [];
  let last: LevelLayout | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const s = attempt === 0 ? seed >>> 0 : hash2(seed >>> 0, attempt);
    const { layout, fail } = attemptLevel(dim, level, s, opts);
    if (layout) last = layout;
    if (layout && !fail.length) {
      layout.seed = seed >>> 0;
      return { layout, report: { ok: true, attempts: attempt + 1, failures, ms: elapsed(t0) } };
    }
    failures.push(fail.slice(0, 4));
  }
  if (!last) throw new Error(`level generation failed for seed ${seed}: ${failures.flat().slice(0, 6).join('; ')}`);
  return { layout: last, report: { ok: false, attempts: MAX_ATTEMPTS, failures, ms: elapsed(t0) } };
}

function elapsed(t0: number) {
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
}
