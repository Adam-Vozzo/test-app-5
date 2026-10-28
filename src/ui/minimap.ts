// Debug overlay: draws the zone graph (clearings by role, paths) or a generated level's mission graph (rooms by
// node kind, connectors, the shortcut), the player and enemies. Toggle with M.
import type { ZoneLayout } from '../world/gen';
import type { LevelWorld } from '../world/level';
import { segmentsOf, toWorld } from '../world/gen-space';

/** Node kinds (LEVELS.md → Mission graph). Signal colours mark only the miniboss and the dummies. */
const KIND_COLOR: Record<string, string> = {
  start: '#ffffff',
  combat: '#d9b35c',
  traverse: '#9aa4ad',
  vista: '#7fc8f0',
  lantern: '#f0b266',
  branch: '#9cc79a',
  setpiece: '#c49ae8',
  gate: '#e8806a',
  miniboss: '#ff2e9a',
  exit: '#ffffff',
  key: '#e8d27a',
};

const ROLE_COLOR: Record<string, string> = { start: '#ffffff', encounter: '#d9b35c', boss: '#ff2e9a', cache: '#ffe14d' };

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = 220;
    Object.assign(this.canvas.style, {
      position: 'fixed',
      right: '16px',
      top: '16px',
      width: '220px',
      height: '220px',
      background: 'rgba(30,20,20,0.6)',
      borderRadius: '8px',
      zIndex: '12',
      pointerEvents: 'none',
      display: 'none',
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  drawLevel(lv: LevelWorld, visible: boolean, player: { x: number; z: number }, dummies: { x: number; z: number; alive: boolean }[]) {
    this.canvas.style.display = visible ? '' : 'none';
    if (!visible) return;
    const L = lv.generated;
    const g = this.ctx;
    const { minX, maxX, minZ, maxZ } = L.bounds;
    const size = 220;
    const pad = 12;
    const scale = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    // Centre the shorter axis.
    const ox = pad + (size - pad * 2 - (maxX - minX) * scale) / 2;
    const oz = pad + (size - pad * 2 - (maxZ - minZ) * scale) / 2;
    const X = (x: number) => ox + (x - minX) * scale;
    const Z = (z: number) => oz + (z - minZ) * scale;
    g.clearRect(0, 0, size, size);
    g.lineCap = 'butt';
    L.space.connectors.forEach((c, i) => {
      const shortcut = i === L.space.shortcut;
      g.strokeStyle = shortcut ? (lv.shortcutOpen() ? 'rgba(254,238,197,0.8)' : '#e8806a') : 'rgba(254,238,197,0.7)';
      g.setLineDash(shortcut && !lv.shortcutOpen() ? [3, 2] : []);
      g.lineWidth = Math.max(1.5, c.width * scale);
      g.beginPath();
      g.moveTo(X(c.ax), Z(c.az));
      for (const s of segmentsOf(c)) g.lineTo(X(s.bx), Z(s.bz));
      g.stroke();
    });
    g.setLineDash([]);
    for (const r of L.space.rooms) {
      const nd = L.graph.nodes[r.node];
      // Rooms stand at any heading: draw each as its own quad.
      g.beginPath();
      for (const [u, v] of [
        [-r.w / 2, -r.d / 2],
        [r.w / 2, -r.d / 2],
        [r.w / 2, r.d / 2],
        [-r.w / 2, r.d / 2],
      ]) {
        const [x, z] = toWorld(r, u, v);
        g.lineTo(X(x), Z(z));
      }
      g.closePath();
      g.fillStyle = 'rgba(254,238,197,0.25)';
      g.fill();
      g.strokeStyle = KIND_COLOR[nd.kind];
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = '#fff';
      g.font = 'bold 9px monospace';
      g.textAlign = 'center';
      g.fillText(nd.index >= 0 ? String(nd.index) : 'b', X(r.x), Z(r.z) + 3);
    }
    g.fillStyle = '#f0b266';
    for (const l of L.dressing.lanterns) g.fillRect(X(l.x) - 2, Z(l.z) - 2, 4, 4);
    g.fillStyle = '#ff2e9a';
    for (const d of dummies) if (d.alive) g.fillRect(X(d.x) - 1.5, Z(d.z) - 1.5, 3, 3);
    g.fillStyle = '#ff6a3d';
    g.beginPath();
    g.arc(X(player.x), Z(player.z), 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = '10px monospace';
    g.textAlign = 'left';
    g.fillText(`seed ${L.seed} · L${L.level + 1} · ${L.script.setPiece.id}`, 6, size - 6);
  }

  draw(L: ZoneLayout | null, visible: boolean, player: { x: number; z: number }, enemies: { x: number; z: number; alive: boolean }[]) {
    this.canvas.style.display = visible && L ? '' : 'none';
    if (!visible || !L) return;
    const g = this.ctx;
    const { minX, maxX, minZ, maxZ } = L.bounds;
    const size = 220;
    const pad = 12;
    const scale = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    const X = (x: number) => pad + (x - minX) * scale;
    const Z = (z: number) => pad + (z - minZ) * scale;
    g.clearRect(0, 0, size, size);
    g.strokeStyle = 'rgba(254,238,197,0.7)';
    g.lineWidth = Math.max(2, L.pathWidth * scale);
    g.lineCap = 'round';
    for (const [a, b] of L.edges) {
      g.beginPath();
      g.moveTo(X(L.nodes[a].x), Z(L.nodes[a].z));
      g.lineTo(X(L.nodes[b].x), Z(L.nodes[b].z));
      g.stroke();
    }
    for (const n of L.nodes) {
      g.fillStyle = 'rgba(254,238,197,0.85)';
      g.beginPath();
      g.arc(X(n.x), Z(n.z), n.r * scale, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = ROLE_COLOR[n.role];
      g.lineWidth = 2.5;
      g.stroke();
      g.fillStyle = '#1e1414';
      g.font = 'bold 10px monospace';
      g.textAlign = 'center';
      g.fillText(n.role === 'encounter' ? String(n.id) : n.role[0].toUpperCase(), X(n.x), Z(n.z) + 3);
    }
    g.fillStyle = '#ff2e9a';
    for (const e of enemies) if (e.alive) g.fillRect(X(e.x) - 1.5, Z(e.z) - 1.5, 3, 3);
    g.fillStyle = '#ff6a3d';
    g.beginPath();
    g.arc(X(player.x), Z(player.z), 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = '10px monospace';
    g.textAlign = 'left';
    g.fillText(`seed ${L.seed} · ${L.theme}`, 6, size - 6);
  }
}
