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
  private slots: HTMLDivElement;
  private slotsKey = '';
  private ammoKey = '';
  private chargesEl: HTMLDivElement;
  private chargesKey = '';
  private stats: HTMLDivElement;
  private range: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private hp: HTMLElement;
  private hpLag: HTMLElement;
  private st: HTMLElement;
  private stBar: HTMLElement;
  private heals: HTMLElement;
  private pollenEl: HTMLElement;
  private boss: HTMLElement;
  private bossName: HTMLElement;
  private bossFill: HTMLElement;
  private vignette: HTMLElement;
  private labelsEl: HTMLElement;
  private labelPool: HTMLElement[] = [];
  private vignetteT = 0;
  private promptEl!: HTMLElement;
  private promptText: string | null = null;
  private hpLagValue = 1;
  private healsKey = '';
  private pollenKey = -1;
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
      <div class="charges" style="display:none"></div>
      <div class="slots"></div>
      <div class="ammo"></div>
      <div class="stats"></div>
      <div class="range" style="display:none"></div>
      <div class="toast"></div>
      <div class="prompt" style="display:none"></div>
      <div class="vitals">
        <div class="bar hp"><i></i><b></b></div>
        <div class="bar st"><i></i></div>
        <div class="heals"></div>
        <div class="pollen"></div>
      </div>
      <div class="boss" style="display:none"><div class="name"></div><div class="bar"><i></i></div></div>
      <div class="stage"></div>
      <div class="vignette"></div>
      <div class="labels"></div>`;
    document.body.appendChild(this.root);
    this.xhair = this.root.querySelector('.xhair')!;
    this.ticks = [...this.xhair.querySelectorAll('i')] as HTMLElement[];
    this.hitmark = this.root.querySelector('.hitmark')!;
    this.hitTicks = [...this.hitmark.querySelectorAll('i')] as HTMLElement[];
    this.ammo = this.root.querySelector('.ammo')!;
    this.chargesEl = this.root.querySelector('.charges')!;
    this.chargesEl.style.setProperty('--charge', hex(SIGNAL.charge));
    this.slots = this.root.querySelector('.slots')!;
    this.stats = this.root.querySelector('.stats')!;
    this.range = this.root.querySelector('.range')!;
    this.toastEl = this.root.querySelector('.toast')!;
    this.hp = this.root.querySelector('.bar.hp i')!;
    this.hpLag = this.root.querySelector('.bar.hp b')!;
    this.st = this.root.querySelector('.bar.st i')!;
    this.stBar = this.root.querySelector('.bar.st')!;
    this.heals = this.root.querySelector('.heals')!;
    this.pollenEl = this.root.querySelector('.pollen')!;
    this.boss = this.root.querySelector('.boss')!;
    this.bossName = this.root.querySelector('.boss .name')!;
    this.bossFill = this.root.querySelector('.boss .bar i')!;
    this.vignette = this.root.querySelector('.vignette')!;
    this.labelsEl = this.root.querySelector('.labels')!;
    this.promptEl = this.root.querySelector('.prompt')!;
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

  /** Weapon slots (1/2/3) with the held one highlighted. */
  setSlots(names: string[], current: number) {
    const key = `${current}|${names.join()}`;
    if (key === this.slotsKey) return;
    this.slotsKey = key;
    this.slots.innerHTML = names.map((n, i) => `<span class="${i === current ? 'on' : ''}"><b>${i + 1}</b> ${n}</span>`).join('');
  }

  /** `charges` = the SwordRifle: the count is its charge pool (mag / max), not ammo with a reserve. */
  setAmmo(name: string, mag: number, magSize: number, reserve: number, reloading: number, charges = false) {
    const key = `${name}|${mag}|${reserve}|${Math.round(reloading * 100)}|${charges}`;
    if (key === this.ammoKey) return;
    this.ammoKey = key;
    const low = mag <= Math.ceil(magSize * 0.2);
    const color = charges ? (mag > 0 ? hex(SIGNAL.charge) : '#fff') : low ? hex(SIGNAL.kill) : '#fff';
    const tail = charges ? `<span class="res"> / ${magSize} charges</span>` : `<span class="res"> / ${reserve === Infinity ? '∞' : reserve}</span>`;
    this.ammo.innerHTML =
      `<div class="wname">${name}</div>` +
      `<div class="mag" style="color:${color}">${mag}${tail}</div>` +
      (reloading > 0 ? `<div class="reload">reloading ${Math.round(reloading * 100)}%</div>` : '');
  }

  /** SwordRifle charge pips under the crosshair, mirroring the cells on the weapon. Hidden for other weapons. */
  setCharges(n: number, max: number, visible: boolean) {
    const key = visible ? `${n}/${max}` : '';
    if (key === this.chargesKey) return;
    this.chargesKey = key;
    this.chargesEl.style.display = visible ? '' : 'none';
    if (visible) this.chargesEl.innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  }

  setStats(text: string) {
    this.stats.style.display = tuning.debug.showStats ? '' : 'none';
    if (tuning.debug.showStats) this.stats.textContent = text;
  }

  setRange(text: string | null) {
    this.range.style.display = text ? '' : 'none';
    if (text) this.range.textContent = text;
  }

  /** Health / stamina / heal charges / carried currency (with its glyph). */
  setVitals(hp: number, maxHp: number, st: number, maxSt: number, exhausted: boolean, heals: number, maxHeals: number, currency: number, glyph = '✿', burden = 0) {
    const h = Math.max(0, hp / maxHp);
    this.hp.style.width = `${h * 100}%`;
    this.hpLagValue = Math.max(h, this.hpLagValue);
    this.hpLag.style.width = `${this.hpLagValue * 100}%`;
    this.st.style.width = `${Math.max(0, st / maxSt) * 100}%`;
    this.stBar.classList.toggle('exhausted', exhausted);
    const hk = `${heals}/${maxHeals}`;
    if (hk !== this.healsKey) {
      this.healsKey = hk;
      this.heals.innerHTML = Array.from({ length: maxHeals }, (_, i) => `<span class="${i < heals ? 'on' : ''}"></span>`).join('') + '<em>Q</em>';
    }
    const key = currency * 64 + glyph.charCodeAt(0) * 8 + burden;
    if (key !== this.pollenKey) {
      this.pollenKey = key;
      // The Devil's weight shows beside the purse: what you carry is what slows you.
      this.pollenEl.textContent = burden > 0 ? `${glyph} ${currency}  ⛓ heavy ×${burden}` : `${glyph} ${currency}`;
    }
  }

  setBoss(name: string | null, frac = 0) {
    this.boss.style.display = name ? '' : 'none';
    if (!name) return;
    this.bossName.textContent = name;
    this.bossFill.style.width = `${Math.max(0, frac) * 100}%`;
  }

  /** Contextual interaction prompt (white box, like the reference's button prompts). */
  prompt(text: string | null) {
    if (text === this.promptText) return;
    this.promptText = text;
    this.promptEl.style.display = text ? '' : 'none';
    if (text) this.promptEl.textContent = text;
  }

  hurt() {
    this.vignetteT = tuning.feel.hurtVignetteTime;
  }

  /** Debug labels at screen positions (x,y in px), or hidden when null. */
  setLabels(items: { x: number; y: number; text: string }[] | null) {
    const list = items ?? [];
    while (this.labelPool.length < list.length) {
      const d = document.createElement('div');
      this.labelsEl.appendChild(d);
      this.labelPool.push(d);
    }
    this.labelPool.forEach((el, i) => {
      const it = list[i];
      el.style.display = it ? '' : 'none';
      if (it) {
        el.textContent = it.text;
        el.style.transform = `translate(${it.x}px, ${it.y}px) translate(-50%, -100%)`;
      }
    });
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
    // Lagging health chunk drains after a beat.
    const real = parseFloat(this.hp.style.width) / 100 || 0;
    if (this.hpLagValue > real) this.hpLagValue = Math.max(real, this.hpLagValue - realDt * 0.6);
    this.vignetteT = Math.max(0, this.vignetteT - realDt);
    this.vignette.style.opacity = String(Math.min(1, this.vignetteT / Math.max(0.01, tuning.feel.hurtVignetteTime)) * 0.9);
    if (this.toastTime > 0) {
      this.toastTime -= realDt;
      if (this.toastTime <= 0) this.toastEl.style.opacity = '0';
    }
  }
}
