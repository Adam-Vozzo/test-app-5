// DOM HUD: crosshair (bloom from spread), hit markers (normal / crit / kill), ammo, debug stats, range readout.
import { SIGNAL } from '../render/palette';
import { tuning } from '../tuning';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export type HitKind = 'hit' | 'crit' | 'kill';

export class Hud {
  readonly root: HTMLDivElement;
  private xhair: HTMLDivElement;
  private ticks: HTMLElement[];
  private hitmark: HTMLDivElement;
  private hitTicks: HTMLElement[];
  private ammo: HTMLDivElement;
  private stats: HTMLDivElement;
  private range: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private hitTime = 0;
  private hitDur = 0.2;
  private hitKind: HitKind = 'hit';
  private toastTime = 0;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="xhair"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="dot"></i></div>
      <div class="hitmark"><i></i><i></i><i></i><i></i></div>
      <div class="ammo"></div>
      <div class="stats"></div>
      <div class="range" style="display:none"></div>
      <div class="toast"></div>`;
    document.body.appendChild(this.root);
    this.xhair = this.root.querySelector('.xhair')!;
    this.ticks = [...this.xhair.querySelectorAll('i')] as HTMLElement[];
    this.hitmark = this.root.querySelector('.hitmark')!;
    this.hitTicks = [...this.hitmark.querySelectorAll('i')] as HTMLElement[];
    this.ammo = this.root.querySelector('.ammo')!;
    this.stats = this.root.querySelector('.stats')!;
    this.range = this.root.querySelector('.range')!;
    this.toastEl = this.root.querySelector('.toast')!;
  }

  show(v: boolean) {
    this.root.style.display = v ? '' : 'none';
  }

  /** Crosshair gap in pixels for a spread half-angle (degrees) at the current vertical FOV. */
  setSpread(spreadDeg: number, fovDeg: number, visible: boolean) {
    const h = window.innerHeight;
    const px = (Math.tan((spreadDeg * Math.PI) / 180) / Math.tan((fovDeg * Math.PI) / 360)) * (h / 2);
    const gap = tuning.feel.crosshairBaseGap + px;
    const [t, b, l, r] = this.ticks;
    t.style.transform = `translateY(${-gap - 8}px)`;
    b.style.transform = `translateY(${gap}px)`;
    l.style.transform = `translateX(${-gap - 8}px)`;
    r.style.transform = `translateX(${gap}px)`;
    this.xhair.style.opacity = visible ? '1' : '0.25';
  }

  hit(kind: HitKind) {
    // Never downgrade a kill marker that's still showing.
    if (this.hitTime > 0 && this.hitKind === 'kill' && kind !== 'kill') return;
    this.hitKind = kind;
    this.hitDur = kind === 'kill' ? tuning.feel.killMarkerTime : tuning.feel.hitMarkerTime;
    this.hitTime = this.hitDur;
    const color = kind === 'crit' ? hex(SIGNAL.crit) : kind === 'kill' ? hex(SIGNAL.kill) : '#ffffff';
    for (const t of this.hitTicks) t.style.background = color;
  }

  setAmmo(name: string, mag: number, magSize: number, reserve: number, reloading: number) {
    const low = mag <= Math.ceil(magSize * 0.2);
    this.ammo.innerHTML =
      `<div class="wname">${name}</div>` +
      `<div class="mag" style="color:${low ? hex(SIGNAL.kill) : '#fff'}">${mag}<span class="res"> / ${reserve === Infinity ? '∞' : reserve}</span></div>` +
      (reloading > 0 ? `<div class="reload">reloading ${Math.round(reloading * 100)}%</div>` : '');
  }

  setStats(text: string) {
    this.stats.style.display = tuning.debug.showStats ? '' : 'none';
    if (tuning.debug.showStats) this.stats.textContent = text;
  }

  setRange(text: string | null) {
    this.range.style.display = text ? '' : 'none';
    if (text) this.range.textContent = text;
  }

  toast(text: string, seconds = 1.2) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    this.toastTime = seconds;
  }

  update(realDt: number) {
    if (this.hitTime > 0) {
      this.hitTime -= realDt;
      const k = Math.max(0, this.hitTime / this.hitDur);
      const big = this.hitKind === 'kill' ? 1.6 : this.hitKind === 'crit' ? 1.3 : 1;
      const spread = (6 + (1 - k) * 8) * big;
      const rot = this.hitKind === 'kill' ? 45 + (1 - k) * 20 : 45;
      this.hitTicks.forEach((t, i) => {
        const a = rot + i * 90;
        t.style.transform = `rotate(${a}deg) translateY(${-spread}px) scaleY(${big})`;
      });
      this.hitmark.style.opacity = String(Math.min(1, k * 2));
    } else {
      this.hitmark.style.opacity = '0';
    }
    if (this.toastTime > 0) {
      this.toastTime -= realDt;
      if (this.toastTime <= 0) this.toastEl.style.opacity = '0';
    }
  }
}
