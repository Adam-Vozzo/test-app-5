// Seeded zone generator (pure: no Three/DOM). A Remnant-style graph of 6–10 clearings joined by paths over
// a noise heightfield: start (checkpoint) → encounters → boss (the farthest clearing), plus one optional
// side branch holding a pollen cache. Same seed + theme → same zone.
import { fbm } from '../core/noise';
import { makeRng, type Rng } from '../core/rng';
import type { EnemyKind } from '../enemies/types';
import { THEMES, type DecorId, type ThemeDef, type ThemeId } from './themes';

export type NodeRole = 'start' | 'encounter' | 'boss' | 'cache';

export interface ZoneNode {
  id: number;
  x: number;
  z: number;
  r: number;
  role: NodeRole;
  /** Graph distance from the start. */
  depth: number;
  /** Ground height at the clearing (it is flattened to this). */
  h: number;
}

export interface ZoneSpawn {
  kind: EnemyKind;
  x: number;
  z: number;
  yaw: number;
  node: number;
}

export interface ZoneDecor {
  id: DecorId | 'trowel' | 'fork' | 'bottlecap' | 'sugar';
  x: number;
  z: number;
  s: number;
  rot: number;
}

export interface ZoneLayout {
  seed: number;
  theme: ThemeId;
  nodes: ZoneNode[];
  edges: [number, number][];
  mainPath: number[];
  spawns: ZoneSpawn[];
  decor: ZoneDecor[];
  checkpoint: { x: number; z: number };
  spawn: { x: number; z: number; yaw: number };
  cache: { x: number; z: number; amount: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  pathWidth: number;
  /** Seed of the ground noise. */
  heightSeed: number;
}

const PATH_WIDTH = 5.5;

export function generateZone(seed: number, themeId: ThemeId): ZoneLayout {
  const theme = THEMES[themeId];
  const rng = makeRng(seed).fork(`zone-${themeId}`);
  const total = rng.int(6, 10);
  const mainCount = total - 1;
  const nodes: ZoneNode[] = [];
  const edges: [number, number][] = [];

  const fits = (x: number, z: number, r: number) => nodes.every((n) => Math.hypot(n.x - x, n.z - z) >= n.r + r + 6);

  // ---- main path: a wandering chain
  nodes.push({ id: 0, x: 0, z: 0, r: 10, role: 'start', depth: 0, h: 0 });
  let heading = rng.range(0, Math.PI * 2);
  for (let i = 1; i < mainCount; i++) {
    const prev = nodes[i - 1];
    const isBoss = i === mainCount - 1;
    const r = isBoss ? 16 : rng.range(10, 14);
    let placed = false;
    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      const turn = rng.range(-0.9, 0.9) * (attempt < 20 ? 1 : 2);
      const a = heading + turn;
      const d = prev.r + r + rng.range(10, 18);
      const x = prev.x + Math.cos(a) * d;
      const z = prev.z + Math.sin(a) * d;
      if (fits(x, z, r)) {
        heading = a;
        nodes.push({ id: i, x, z, r, role: isBoss ? 'boss' : 'encounter', depth: i, h: 0 });
        edges.push([i - 1, i]);
        placed = true;
      }
    }
    if (!placed) {
      // Very rare: push straight out far enough to fit.
      const d = prev.r + r + 40;
      nodes.push({ id: i, x: prev.x + Math.cos(heading) * d, z: prev.z + Math.sin(heading) * d, r, role: isBoss ? 'boss' : 'encounter', depth: i, h: 0 });
      edges.push([i - 1, i]);
    }
  }
  const mainPath = nodes.map((n) => n.id);

  // ---- side branch: a dead-end clearing off a middle node holds the pollen cache
  const candidates = mainPath.slice(1, -1);
  let cacheNode: ZoneNode | null = null;
  for (let attempt = 0; attempt < 80 && !cacheNode; attempt++) {
    const parent = nodes[rng.pick(candidates)];
    const next = nodes[parent.id + 1];
    const prev = nodes[parent.id - 1];
    // Branch roughly perpendicular to the main path.
    const along = Math.atan2(next.z - prev.z, next.x - prev.x);
    const a = along + (rng.chance(0.5) ? 1 : -1) * (Math.PI / 2 + rng.range(-0.5, 0.5));
    const r = 7;
    const d = parent.r + r + rng.range(8, 14);
    const x = parent.x + Math.cos(a) * d;
    const z = parent.z + Math.sin(a) * d;
    if (fits(x, z, r)) {
      cacheNode = { id: nodes.length, x, z, r, role: 'cache', depth: parent.depth + 1, h: 0 };
      nodes.push(cacheNode);
      edges.push([parent.id, cacheNode.id]);
    }
  }
  if (!cacheNode) {
    const parent = nodes[candidates[0]];
    cacheNode = { id: nodes.length, x: parent.x, z: parent.z + parent.r + 60, r: 7, role: 'cache', depth: parent.depth + 1, h: 0 };
    nodes.push(cacheNode);
    edges.push([parent.id, cacheNode.id]);
  }

  // ---- ground height per clearing
  const hs = makeRng(seed).fork('height').seed;
  for (const n of nodes) n.h = rawHeight(theme, hs, n.x, n.z);

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.r - 24);
    maxX = Math.max(maxX, n.x + n.r + 24);
    minZ = Math.min(minZ, n.z - n.r - 24);
    maxZ = Math.max(maxZ, n.z + n.r + 24);
  }

  const layout: ZoneLayout = {
    seed,
    theme: themeId,
    nodes,
    edges,
    mainPath,
    spawns: [],
    decor: [],
    checkpoint: { x: 0, z: 0 },
    spawn: { x: 0, z: 0, yaw: 0 },
    cache: { x: cacheNode.x, z: cacheNode.z, amount: 40 },
    bounds: { minX, maxX, minZ, maxZ },
    pathWidth: PATH_WIDTH,
    heightSeed: hs,
  };

  // ---- start: checkpoint a little off-centre, player faces the first path
  const first = nodes[1];
  const toFirst = Math.atan2(first.z - nodes[0].z, first.x - nodes[0].x);
  layout.checkpoint = { x: -Math.cos(toFirst) * 4, z: -Math.sin(toFirst) * 4 };
  layout.spawn = { x: -Math.cos(toFirst) * 1.5, z: -Math.sin(toFirst) * 1.5, yaw: yawToward(Math.cos(toFirst), Math.sin(toFirst)) };
  layout.decor.push({ id: 'sugar', x: layout.checkpoint.x, z: layout.checkpoint.z, s: 2.2, rot: rng.range(0, 6.28) });

  placeEncounters(layout, theme, rng.fork('enemies'));
  placeDecor(layout, theme, rng.fork('decor'));
  return layout;
}

/** Yaw (0 = facing -Z) that faces along (dx, dz). */
export const yawToward = (dx: number, dz: number) => Math.atan2(-dx, -dz);

function placeEncounters(layout: ZoneLayout, theme: ThemeDef, rng: Rng) {
  const { nodes } = layout;
  const maxDepth = Math.max(...nodes.filter((n) => n.role !== 'cache').map((n) => n.depth));
  for (const n of nodes) {
    const parent = layout.edges.find((e) => e[1] === n.id)?.[0];
    const from = parent !== undefined ? nodes[parent] : n;
    // Enemies face the way the player arrives.
    const arriveYaw = yawToward(from.x - n.x, from.z - n.z);
    if (n.role === 'boss') {
      layout.spawns.push({ kind: 'brute', x: n.x, z: n.z, yaw: arriveYaw, node: n.id });
      continue;
    }
    if (n.role === 'cache') {
      if (rng.chance(0.6)) layout.spawns.push({ kind: 'spitter', x: n.x + rng.range(-2, 2), z: n.z + rng.range(-2, 2), yaw: arriveYaw, node: n.id });
      continue;
    }
    if (n.role !== 'encounter') continue;
    // Difficulty ramps with depth: 2 enemies early, up to 5 near the boss.
    const t = n.depth / Math.max(1, maxDepth);
    const count = Math.min(5, 2 + Math.round(t * 2) + rng.int(0, 1));
    const w = theme.enemyWeights;
    for (let i = 0; i < count; i++) {
      const kind: EnemyKind = rng() < w.skitterer / (w.skitterer + w.spitter) ? 'skitterer' : 'spitter';
      // Spitters sit at the back of the clearing; skitterers anywhere.
      const back = kind === 'spitter' ? rng.range(0.45, 0.8) : rng.range(0, 0.6);
      const side = rng.range(-0.7, 0.7);
      const fx = -Math.sin(arriveYaw);
      const fz = -Math.cos(arriveYaw);
      const x = n.x - fx * back * n.r + fz * side * n.r * 0.8 * -1;
      const z = n.z - fz * back * n.r + fx * side * n.r * 0.8;
      layout.spawns.push({ kind, x, z, yaw: arriveYaw + rng.range(-0.3, 0.3), node: n.id });
    }
  }
}

function placeDecor(layout: ZoneLayout, theme: ThemeDef, rng: Rng) {
  const { nodes } = layout;
  const taken: { x: number; z: number; r: number }[] = [
    { x: layout.checkpoint.x, z: layout.checkpoint.z, r: 3 },
    { x: layout.spawn.x, z: layout.spawn.z, r: 3 },
    ...layout.spawns.map((s) => ({ x: s.x, z: s.z, r: s.kind === 'brute' ? 6 : 1.5 })),
  ];
  const free = (x: number, z: number, r: number) => taken.every((t) => Math.hypot(t.x - x, t.z - z) > t.r + r);

  // Hero landmark in a middle encounter clearing.
  const mids = nodes.filter((n) => n.role === 'encounter');
  if (mids.length) {
    const n = mids[Math.floor(mids.length / 2)];
    const rot = rng.range(0, Math.PI * 2);
    layout.decor.push({ id: theme.hero, x: n.x, z: n.z, s: 1, rot });
    taken.push({ x: n.x, z: n.z, r: 6 });
  }
  const boss = nodes.find((n) => n.role === 'boss');
  if (boss && theme.bossArena) {
    // Entrance faces the way in.
    const parent = nodes[layout.edges.find((e) => e[1] === boss.id)![0]];
    layout.decor.push({ id: 'bottlecap', x: boss.x, z: boss.z, s: boss.r - 1.5, rot: Math.atan2(parent.z - boss.z, parent.x - boss.x) });
  }

  for (const n of nodes) {
    if (n.role === 'boss' && theme.bossArena) continue;
    for (const [id, min, max] of theme.decor) {
      const count = rng.int(min, max);
      for (let i = 0; i < count; i++) {
        for (let attempt = 0; attempt < 12; attempt++) {
          const a = rng.range(0, Math.PI * 2);
          const d = Math.sqrt(rng()) * n.r * 0.85;
          const x = n.x + Math.cos(a) * d;
          const z = n.z + Math.sin(a) * d;
          const s = decorScale(id, rng);
          const r = decorRadius(id) * s;
          if (free(x, z, r + 1.2)) {
            layout.decor.push({ id, x, z, s, rot: rng.range(0, Math.PI * 2) });
            taken.push({ x, z, r });
            break;
          }
        }
      }
    }
  }
}

function decorScale(id: DecorId, rng: Rng) {
  switch (id) {
    case 'pebble':
      return rng.range(0.9, 2.4);
    case 'leaf':
      return rng.range(0.8, 1.2);
    case 'grass':
      return rng.range(0.5, 1.0);
    case 'crumb':
      return rng.range(0.6, 1.6);
    case 'chairLeg':
      return rng.range(0.9, 1.2);
    case 'box':
      return rng.range(0.8, 1.3);
  }
}

function decorRadius(id: DecorId) {
  return { pebble: 1.1, leaf: 4, grass: 1, crumb: 1, chairLeg: 1.6, box: 4 }[id];
}

// ---------------------------------------------------------------------------------------------
// Heightfield and walkable area (shared by the mesh builder, colliders and tests)

function rawHeight(theme: ThemeDef, hs: number, x: number, z: number) {
  const g = theme.ground;
  if (g.amplitude <= 0) return 0;
  return fbm(hs, x / g.scale, z / g.scale, 4) * g.amplitude;
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return { d: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t };
}

/** Signed distance to the walkable area (negative inside a clearing or path). */
export function walkDistance(L: ZoneLayout, x: number, z: number): number {
  let best = Infinity;
  for (const n of L.nodes) best = Math.min(best, Math.hypot(x - n.x, z - n.z) - n.r);
  for (const [a, b] of L.edges) {
    const A = L.nodes[a];
    const B = L.nodes[b];
    best = Math.min(best, segDist(x, z, A.x, A.z, B.x, B.z).d - L.pathWidth / 2);
  }
  return best;
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Ground height: noise, flattened inside clearings and along paths. */
export function zoneHeight(L: ZoneLayout, x: number, z: number): number {
  let h = rawHeight(THEMES[L.theme], L.heightSeed, x, z);
  let wSum = 0;
  let target = 0;
  for (const n of L.nodes) {
    const w = 1 - smooth(n.r * 0.85, n.r * 1.35, Math.hypot(x - n.x, z - n.z));
    if (w > 0) {
      target += n.h * w;
      wSum += w;
    }
  }
  for (const [a, b] of L.edges) {
    const A = L.nodes[a];
    const B = L.nodes[b];
    const { d, t } = segDist(x, z, A.x, A.z, B.x, B.z);
    const w = 1 - smooth(L.pathWidth * 0.5, L.pathWidth * 1.4, d);
    if (w > 0) {
      target += (A.h + (B.h - A.h) * t) * w;
      wSum += w;
    }
  }
  if (wSum > 0) {
    const k = Math.min(1, wSum);
    h = h * (1 - k) + (target / wSum) * k;
  }
  return h;
}
