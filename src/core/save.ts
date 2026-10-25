// The progress save (CLAUDE.md → Allowed, but keep it minimal): seed, progress per dimension, cleared dimensions,
// relics, upgrades, repair stage, pentacles and unbindings. Pure functions over plain data; the two small storage
// helpers at the bottom are the only part that touches localStorage (and survive it being absent or broken).

export interface SaveData {
  version: 1;
  /** Level seeds are fixed per save, so layouts stay learnable across deaths. */
  seed: number;
  /** Next level to enter per dimension: 0–2 are levels, 3 is the arcana's arena. */
  progress: Record<string, number>;
  cleared: string[];
  /** Suit relics (each King drops his suit's). */
  relics: string[];
  /** Magician's items bought, by id. */
  upgrades: string[];
  repairStage: number;
  pentacles: number;
  /** Moves freed by defeated arcana ('parry' from Justice). */
  unbound: string[];
  /** How many times each hub character has been spoken to (their lines cycle). */
  talks: Record<string, number>;
}

export interface UpgradeEffect {
  pistolDamageMul?: number;
  pistolMagBonus?: number;
  healBonus?: number;
  repairStage?: number;
}

export interface ShopItem {
  id: string;
  name: string;
  blurb: string;
  price: number;
  requires?: { relic?: string; upgrade?: string };
  effect: UpgradeEffect;
}

export function newSave(seed: number): SaveData {
  return { version: 1, seed: seed >>> 0, progress: {}, cleared: [], relics: [], upgrades: [], repairStage: 0, pentacles: 0, unbound: [], talks: {} };
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const numbers = (v: unknown) => {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && Number.isFinite(x)) out[k] = x;
  return out;
};

/** Read a stored save, tolerating anything: unknown or broken data falls back to a fresh save. */
export function parseSave(raw: string | null, fallbackSeed: number): SaveData {
  if (!raw) return newSave(fallbackSeed);
  try {
    const o = JSON.parse(raw);
    if (!o || o.version !== 1) return newSave(fallbackSeed);
    const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    return {
      version: 1,
      seed: n(o.seed, fallbackSeed) >>> 0,
      progress: numbers(o.progress),
      cleared: strings(o.cleared),
      relics: strings(o.relics),
      upgrades: strings(o.upgrades),
      repairStage: Math.max(0, Math.round(n(o.repairStage, 0))),
      pentacles: Math.max(0, Math.round(n(o.pentacles, 0))),
      unbound: strings(o.unbound),
      talks: numbers(o.talks),
    };
  } catch {
    return newSave(fallbackSeed);
  }
}

/** Can the player buy this now? (Not twice, not without the price, not without what it needs.) */
export function canBuy(s: SaveData, item: ShopItem): { ok: boolean; reason?: string } {
  if (s.upgrades.includes(item.id)) return { ok: false, reason: 'owned' };
  if (item.requires?.relic && !s.relics.includes(item.requires.relic)) return { ok: false, reason: `needs the relic of ${item.requires.relic[0].toUpperCase()}${item.requires.relic.slice(1)}` };
  if (item.requires?.upgrade && !s.upgrades.includes(item.requires.upgrade)) return { ok: false, reason: 'needs an earlier part' };
  if (s.pentacles < item.price) return { ok: false, reason: `${item.price - s.pentacles} pentacles short` };
  return { ok: true };
}

/** Buy an item: a new save with the price paid, the item owned and its repair stage applied. */
export function buy(s: SaveData, item: ShopItem): SaveData {
  if (!canBuy(s, item).ok) return s;
  return {
    ...s,
    pentacles: s.pentacles - item.price,
    upgrades: [...s.upgrades, item.id],
    repairStage: Math.max(s.repairStage, item.effect.repairStage ?? 0),
  };
}

/** Everything bought, folded into the numbers the game applies (upgrades are data applied to defs). */
export function effects(s: SaveData, shop: readonly ShopItem[]) {
  const out = { pistolDamageMul: 1, pistolMagBonus: 0, healBonus: 0, repairStage: s.repairStage };
  for (const id of s.upgrades) {
    const e = shop.find((i) => i.id === id)?.effect;
    if (!e) continue;
    out.pistolDamageMul *= e.pistolDamageMul ?? 1;
    out.pistolMagBonus += e.pistolMagBonus ?? 0;
    out.healBonus += e.healBonus ?? 0;
  }
  return out;
}

/** A dimension's arcana fell: it's cleared, its unbinding is freed, and its road starts from level 1 again. */
export function clearDimension(s: SaveData, dim: string, unbinding: string | null): SaveData {
  return {
    ...s,
    cleared: s.cleared.includes(dim) ? s.cleared : [...s.cleared, dim],
    unbound: unbinding && !s.unbound.includes(unbinding) ? [...s.unbound, unbinding] : s.unbound,
    progress: { ...s.progress, [dim]: 0 },
  };
}

export function gainRelic(s: SaveData, relic: string): SaveData {
  return s.relics.includes(relic) ? s : { ...s, relics: [...s.relics, relic] };
}

/** Gates in dimension order: the first is always open, each later one when the one before is cleared. */
export function gateOpen(s: SaveData, order: readonly string[], dim: string): boolean {
  const i = order.indexOf(dim);
  return i === 0 || (i > 0 && s.cleared.includes(order[i - 1]));
}

/** A character's next line for the current state of the save; lines cycle as you keep talking. */
export function nextLine(s: SaveData, who: string, lines: Record<string, readonly string[]>, state: string): { line: string; save: SaveData } {
  const list = lines[state] ?? lines.default ?? ['…'];
  const n = s.talks[`${who}:${state}`] ?? 0;
  return { line: list[n % list.length], save: { ...s, talks: { ...s.talks, [`${who}:${state}`]: n + 1 } } };
}

const KEY = 'eight.save.v1';

export function loadSave(fallbackSeed: number): SaveData {
  try {
    return parseSave(globalThis.localStorage?.getItem(KEY) ?? null, fallbackSeed);
  } catch {
    return newSave(fallbackSeed);
  }
}

export function storeSave(s: SaveData) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or storage full: progress lives only in this session.
  }
}
