// Debug overlay: draws the zone graph (clearings by role, paths), the player and enemies. Toggle with M.
import type { ZoneLayout } from '../world/gen';

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
