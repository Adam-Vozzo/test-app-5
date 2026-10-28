// The Tower's timber decks at runtime (V2-11): one instanced draw per scaffold room, one collider per deck. The
// rules live in scaffold.ts (pure); this file shows them. Sound decks are timber, rotten ones charred and sagging
// (the tell), cracking ones pulse telegraph magenta, burning ones flicker in the Tower's fire orange, and fallen ones
// are gone (the collider too) until they're built back a few seconds later, or you rest.
import * as THREE from 'three';
import type { Rng } from '../core/rng';
import { Physics, RAPIER } from '../physics/world';
import { paint, toonMat } from '../render/geo';
import { SIGNAL, type AreaPalette } from '../render/palette';
import { tuning } from '../tuning';
import { deckCell, type Scaffold } from './gen-dress';
import { ScaffoldGrid, type DeckEvent } from './scaffold';

const DECK_H = 0.3;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _tele = new THREE.Color(SIGNAL.telegraph);

interface Room {
  s: Scaffold;
  grid: ScaffoldGrid;
  mesh: THREE.InstancedMesh;
  cols: (RAPIER.Collider | null)[];
}

export class Decks {
  readonly group = new THREE.Group();
  private rooms: Room[] = [];
  private mat = toonMat();
  private time = 0;
  private sound: THREE.Color;
  private rot: THREE.Color;
  private fire: THREE.Color;
  private fireHot: THREE.Color;

  constructor(
    scaffolds: Scaffold[],
    private physics: Physics,
    palette: AreaPalette,
  ) {
    this.sound = new THREE.Color(palette.surfaces.mid);
    this.rot = new THREE.Color(palette.surfaces.dark).lerp(new THREE.Color(palette.surfaces.shadow), 0.35);
    this.fire = new THREE.Color(palette.accent);
    this.fireHot = new THREE.Color(palette.accentShade);
    for (const s of scaffolds) {
      // Three planks per deck, a gap between: timber, not stone.
      const plank = new THREE.BoxGeometry(1, DECK_H, 1);
      const mesh = new THREE.InstancedMesh(paint(plank, 0xffffff), this.mat, s.cols * s.rows);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      const grid = new ScaffoldGrid(s.cols, s.rows, s.rotten, s.holes ?? []);
      const room: Room = { s, grid, mesh, cols: [] };
      for (let i = 0; i < s.cols * s.rows; i++) room.cols.push(grid.state[i] === 'gone' ? null : this.addCollider(s, i));
      this.rooms.push(room);
      this.group.add(mesh);
      this.paint(room);
    }
  }

  private centre(s: Scaffold, i: number, out: THREE.Vector3) {
    const c = i % s.cols;
    const r = Math.floor(i / s.cols);
    return out.set(s.x0 + (c + 0.5) * s.tx, s.y - DECK_H / 2, s.z0 + (r + 0.5) * s.tz);
  }

  private addCollider(s: Scaffold, i: number) {
    this.centre(s, i, _p);
    return this.physics.addStatic(RAPIER.ColliderDesc.cuboid(s.tx / 2, DECK_H / 2, s.tz / 2).setTranslation(_p.x, _p.y, _p.z));
  }

  /** Lay out and colour every deck from its state. */
  private paint(room: Room) {
    const { s, grid, mesh } = room;
    for (let i = 0; i < s.cols * s.rows; i++) {
      const st = grid.state[i];
      const rotten = grid.isRotten(i);
      this.centre(s, i, _p);
      // Rotten decks sag a little, are charred, and sit loose in a wider gap: the tell.
      if (rotten) _p.y -= 0.06;
      const gone = st === 'gone';
      const gap = rotten ? 0.5 : 0.12;
      _s.set(gone ? 0 : s.tx - gap, gone ? 0 : 1, gone ? 0 : s.tz - gap);
      _m.compose(_p, _q.identity(), _s);
      mesh.setMatrixAt(i, _m);
      if (st === 'cracking') {
        const k = Math.max(0, grid.t[i]) / Math.max(0.05, tuning.tower.crackTime);
        _c.copy(this.rot).lerp(_tele, 0.45 + 0.55 * Math.abs(Math.sin(this.time * (10 + 30 * k))));
      } else if (st === 'burning') _c.copy(this.fire).lerp(this.fireHot, 0.5 + 0.5 * Math.sin(this.time * 17 + i));
      else _c.copy(rotten ? this.rot : this.sound).multiplyScalar(0.94 + ((i * 37) % 11) / 100);
      mesh.setColorAt(i, _c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** The deck under a point, if it's standing: [room, index] or null. */
  private at(pos: THREE.Vector3): [Room, number] | null {
    for (const room of this.rooms) {
      if (Math.abs(pos.y - room.s.y) > 0.6) continue;
      const [c, r] = deckCell(room.s, pos.x, pos.z);
      if (c < 0) continue;
      const i = r * room.s.cols + c;
      return room.grid.state[i] === 'gone' ? null : [room, i];
    }
    return null;
  }

  /** What she's standing on: 'sound' | 'cracking' | 'burning' (or null off the decks). */
  standing(pos: THREE.Vector3) {
    const hit = this.at(pos);
    return hit ? hit[0].grid.state[hit[1]] : null;
  }

  /** She stands here: a rotten deck starts to crack. Returns true on the frame it starts. */
  step(pos: THREE.Vector3): boolean {
    const hit = this.at(pos);
    return !!hit && !!hit[0].grid.step(hit[1]);
  }

  /** Lightning (or a torch) lands: light every deck within `radius`. Returns how many caught. */
  ignite(at: THREE.Vector3, radius: number): number {
    let n = 0;
    for (const room of this.rooms) {
      if (Math.abs(at.y - room.s.y) > 1.5) continue;
      for (let i = 0; i < room.s.cols * room.s.rows; i++) {
        this.centre(room.s, i, _p);
        if (Math.hypot(_p.x - at.x, _p.z - at.z) <= radius && room.grid.ignite(i)) n++;
      }
    }
    return n;
  }

  /** Crack every standing deck whose centre lies where `pick` says (a ring of the top floor giving way). */
  crackWhere(pick: (x: number, z: number) => boolean, warn = 0): number {
    let n = 0;
    for (const room of this.rooms) {
      for (let i = 0; i < room.s.cols * room.s.rows; i++) {
        this.centre(room.s, i, _p);
        if (pick(_p.x, _p.z) && room.grid.crack(i, warn)) n++;
      }
      this.paint(room);
    }
    return n;
  }

  /**
   * Advance fire and cracks; fallen decks lose their colliders, and are built back once nothing (in `occupants`, feet
   * positions) stands in their space. Returns what happened (for sounds).
   */
  update(dt: number, rng: Rng, occupants: readonly THREE.Vector3[] = []): DeckEvent[] {
    this.time += dt;
    const out: DeckEvent[] = [];
    const tune = tuning.tower;
    for (const room of this.rooms) {
      const s = room.s;
      const occupied = (i: number) => {
        this.centre(s, i, _p);
        return occupants.some((o) => Math.abs(o.x - _p.x) < s.tx / 2 + 0.6 && Math.abs(o.z - _p.z) < s.tz / 2 + 0.6 && o.y > s.y - 3 && o.y < s.y + 2.5);
      };
      const ev = room.grid.update(dt, tune, rng, occupied);
      for (const e of ev) {
        if (e.kind === 'fall') {
          const c = room.cols[e.i];
          if (c) this.physics.removeCollider(c);
          room.cols[e.i] = null;
        } else if (e.kind === 'regrow' && !room.cols[e.i]) room.cols[e.i] = this.addCollider(s, e.i);
        out.push(e);
      }
      // Only rooms with something happening need repainting.
      if (ev.length || room.grid.state.some((s) => s === 'cracking' || s === 'burning')) this.paint(room);
    }
    return out;
  }

  /** The centre of the standing (not cracking) deck nearest to `pos`, if any: where a fall in the arena puts her. */
  nearestStanding(pos: THREE.Vector3): THREE.Vector3 | null {
    let best: THREE.Vector3 | null = null;
    let bestD = Infinity;
    for (const room of this.rooms) {
      for (let i = 0; i < room.s.cols * room.s.rows; i++) {
        if (room.grid.state[i] !== 'sound') continue;
        this.centre(room.s, i, _p);
        const d = Math.hypot(_p.x - pos.x, _p.z - pos.z);
        if (d < bestD) {
          bestD = d;
          best = (best ?? new THREE.Vector3()).set(_p.x, room.s.y, _p.z);
        }
      }
    }
    return best;
  }

  /** Counts for tests and the debug line (decks only: holes in a round floor aren't decks). */
  get counts() {
    let gone = 0;
    let burning = 0;
    let rotten = 0;
    let total = 0;
    for (const r of this.rooms) {
      const holes = new Set(r.grid.holes);
      rotten += r.grid.rotten.length;
      r.grid.state.forEach((s, i) => {
        if (holes.has(i)) return;
        total++;
        if (s === 'gone') gone++;
        else if (s === 'burning') burning++;
      });
    }
    return { total, rotten, gone, burning };
  }

  /** A rest: every deck stands again. */
  reset() {
    for (const room of this.rooms) {
      room.grid.reset();
      for (let i = 0; i < room.cols.length; i++) if (!room.cols[i] && room.grid.state[i] !== 'gone') room.cols[i] = this.addCollider(room.s, i);
      this.paint(room);
    }
  }
}
