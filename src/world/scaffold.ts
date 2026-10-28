// The Tower's rule, collapse (DESIGN.md → The Tower × Wands: "ground is temporary"). Pure logic, no Three/DOM:
// a scaffold room's floor is a grid of timber decks. A rotten deck cracks when you step on it (glowing magenta) and
// falls after `crackTime`; a burning deck hurts while you stand on it, spreads fire to its neighbours, and falls
// after `burnTime`. Lightning sets decks alight. Fire spreads one step only: a deck lit by its neighbour doesn't pass
// it on (spreading on and on, any spark used to take the whole floor). A fallen deck is built back after `regrowTime` (the stage keeps
// changing under the fight instead of only emptying), and everything comes back when you rest.

export type DeckState = 'sound' | 'cracking' | 'burning' | 'gone';

export interface CollapseTune {
  /** A rotten deck holds this long once stepped on (s). */
  crackTime: number;
  /** A burning deck holds this long (s). */
  burnTime: number;
  /** Chance per second that fire spreads to each sound neighbour. */
  spreadPerSec: number;
  /** A fallen deck stands again after this long (s); 0 = only a rest brings it back. */
  regrowTime?: number;
}

export interface DeckEvent {
  i: number;
  kind: 'crack' | 'ignite' | 'fall' | 'regrow';
}

export class ScaffoldGrid {
  readonly state: DeckState[];
  /** Seconds in the current state. */
  readonly t: number[];
  /** Burning decks lit directly (lightning, a torch) pass fire to their neighbours; ones those lit don't. */
  private spreads: boolean[];
  constructor(
    readonly cols: number,
    readonly rows: number,
    /** Indices of the rotten decks (the tell: darker, gapped planks). */
    readonly rotten: readonly number[],
    /** Cells with no deck at all (a grid laid over a round floor). */
    readonly holes: readonly number[] = [],
  ) {
    this.state = new Array(cols * rows).fill('sound');
    this.t = new Array(cols * rows).fill(0);
    this.spreads = new Array(cols * rows).fill(false);
    for (const i of holes) this.state[i] = 'gone';
  }

  index(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows ? r * this.cols + c : -1;
  }

  isRotten(i: number) {
    return this.rotten.includes(i);
  }

  /** She stands on deck `i`: a rotten one starts to crack. */
  step(i: number): DeckEvent | null {
    if (i < 0 || this.state[i] !== 'sound' || !this.isRotten(i)) return null;
    this.state[i] = 'cracking';
    this.t[i] = 0;
    return { i, kind: 'crack' };
  }

  /**
   * Crack deck `i` whatever it's made of (the Crowned Tower's floor giving way): it falls after `crackTime` plus
   * `warn` seconds of extra warning.
   */
  crack(i: number, warn = 0): DeckEvent | null {
    if (i < 0 || this.state[i] === 'gone' || this.state[i] === 'cracking') return null;
    this.state[i] = 'cracking';
    this.t[i] = -warn;
    return { i, kind: 'crack' };
  }

  /**
   * Set deck `i` alight (lightning, a Firebrand). Gone or burning decks don't light again. `spreads`: it passes the
   * fire to its neighbours (a deck caught from a neighbour doesn't).
   */
  ignite(i: number, spreads = true): DeckEvent | null {
    if (i < 0 || this.state[i] === 'gone' || this.state[i] === 'burning') return null;
    this.state[i] = 'burning';
    this.t[i] = 0;
    this.spreads[i] = spreads;
    return { i, kind: 'ignite' };
  }

  /**
   * Advance: cracking decks fall, burning decks spread and then fall, fallen decks are built back. `roll` gives seeded
   * numbers in [0, 1); `occupied(i)` says something stands where deck `i` would come back (it waits until clear).
   */
  update(dt: number, tune: CollapseTune, roll: () => number, occupied: (i: number) => boolean = () => false): DeckEvent[] {
    const out: DeckEvent[] = [];
    const spread: number[] = [];
    const holes = new Set(this.holes);
    for (let i = 0; i < this.state.length; i++) {
      const s = this.state[i];
      if (s === 'sound') continue;
      if (s === 'gone') {
        if (holes.has(i) || !tune.regrowTime) continue;
        this.t[i] += dt;
        if (this.t[i] >= tune.regrowTime && !occupied(i)) {
          this.state[i] = 'sound';
          this.t[i] = 0;
          out.push({ i, kind: 'regrow' });
        }
        continue;
      }
      this.t[i] += dt;
      if (s === 'cracking' && this.t[i] >= tune.crackTime) {
        this.state[i] = 'gone';
        this.t[i] = 0;
        out.push({ i, kind: 'fall' });
      } else if (s === 'burning') {
        const c = i % this.cols;
        const r = Math.floor(i / this.cols);
        const p = 1 - Math.exp(-tune.spreadPerSec * dt);
        if (this.spreads[i]) {
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const j = this.index(c + dc, r + dr);
            if (j >= 0 && this.state[j] === 'sound' && roll() < p) spread.push(j);
          }
        }
        if (this.t[i] >= tune.burnTime) {
          this.state[i] = 'gone';
          this.t[i] = 0;
          out.push({ i, kind: 'fall' });
        }
      }
    }
    for (const j of spread) {
      const e = this.ignite(j, false);
      if (e) out.push(e);
    }
    return out;
  }

  /** Everything stands again (a rest); holes stay holes. */
  reset() {
    this.state.fill('sound');
    this.t.fill(0);
    this.spreads.fill(false);
    for (const i of this.holes) this.state[i] = 'gone';
  }
}

/**
 * Is there a way across sound (not rotten) decks from any `from` cell to every `to` cell? 4-connected. The
 * generator re-rolls a room whose rot would cut its doors apart: collapse may close a way behind you, but never
 * the only way on before you've stepped on anything.
 */
export function connected(cols: number, rows: number, blocked: (i: number) => boolean, from: [number, number][], to: [number, number][]): boolean {
  const seen = new Uint8Array(cols * rows);
  const queue: number[] = [];
  for (const [c, r] of from) {
    const i = r * cols + c;
    if (c < 0 || r < 0 || c >= cols || r >= rows || blocked(i) || seen[i]) continue;
    seen[i] = 1;
    queue.push(i);
  }
  while (queue.length) {
    const i = queue.shift()!;
    const c = i % cols;
    const r = Math.floor(i / cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const j = nr * cols + nc;
      if (seen[j] || blocked(j)) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return to.every(([c, r]) => c >= 0 && r >= 0 && c < cols && r < rows && seen[r * cols + c] === 1);
}
