// Start / pause / death menus. No other menus. See CLAUDE.md out-of-scope list.

const KEYS: [string, string][] = [
  ['WASD', 'move'],
  ['Mouse', 'look'],
  ['LMB / RMB', 'fire / aim'],
  ['1 / 2 · wheel', 'auto-pistol / SwordRifle'],
  ['F', 'SwordRifle: rifle ⇄ sword'],
  ['LMB / hold RMB', 'sword: combo / charged strike'],
  ['Space', 'dodge-roll'],
  ['Shift', 'sprint'],
  ['R', 'reload'],
  ['Q', 'heal (3 charges)'],
  ['E', 'rest at a lantern · use (doors, gates, people)'],
  ['V', 'parry (once Justice has fallen)'],
  ['X', 'dash, through chains (once the Devil has fallen)'],
  ['C', 'swap shoulder'],
  ['`', 'tuning panel'],
  ['T', 'slow-mo 0.25×'],
  ['I / H / L', 'IK / hitbox / AI debug'],
  ['G', 'god mode'],
  ['P', 'pixel mode (on by default)'],
  ['M / O / B', 'level map / overview / next vista'],
  ['N', 'new level seed'],
  ['Esc', 'pause'],
];

export class Menus {
  private start: HTMLDivElement;
  private pause: HTMLDivElement;
  private death: HTMLDivElement;
  private sun: HTMLDivElement;
  private pact: HTMLDivElement;
  /** The Devil's pact is answered: true accepts. */
  onPact: (accept: boolean) => void = () => {};
  /** The ending is closed: back to the World. */
  onSunClose: () => void = () => {};
  private deathNote: HTMLElement;
  onRise: () => void = () => {};
  /** 'hub': play (continue the save); 'new': wipe the save and start; 'justice': the training courtyard. */
  onPlay: (mode: 'hub' | 'new' | 'justice' | 'level') => void = () => {};
  private playBtn!: HTMLButtonElement;
  onResume: () => void = () => {};
  onQuit: () => void = () => {};

  constructor(seed: number) {
    const keys = KEYS.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('');
    this.start = this.make(`
      <h1>Eight</h1>
      <p>The Eight of Swords, bound only by herself. Everything here is generated in code.</p>
      <button data-a="hub">Play</button>
      <div class="row"><button data-a="new" class="small">New game</button><button data-a="justice" class="small">Training courtyard</button></div>
      <p class="note">The World: walk through the angel's gate into Justice (three generated levels, each ending with a court card, then Justice beneath the scales). Spend pentacles at the Magician's table; the High Priestess knows the way. Progress is saved in this browser.</p>
      <div class="keys">${keys}</div>
      <div class="seed">seed ${seed} · add ?seed=… to the URL to change it</div>`);
    this.pause = this.make(`
      <h1>Paused</h1>
      <button data-a="resume">Resume</button>
      <button data-a="quit">Quit to menu</button>
      <div class="keys">${keys}</div>`);
    this.pause.classList.add('hidden');
    this.death = this.make(`
      <h1>Fallen</h1>
      <p class="note"></p>
      <button data-a="rise">Rise</button>`);
    this.death.classList.add('death', 'hidden');
    this.deathNote = this.death.querySelector('.note')!;
    this.sun = this.make(`
      ${sunCard()}
      <h1>The Sun</h1>
      <p class="line"></p>
      <button data-a="sun">Return to the World</button>`);
    this.sun.classList.add('sun', 'hidden');
    this.pact = this.make(`
      <h1>The Devil's Pact</h1>
      <p class="line"></p>
      <div class="row"><button data-a="pact-yes">Accept (E)</button><button data-a="pact-no">Refuse (Esc)</button></div>`);
    this.pact.classList.add('pact', 'hidden');
    for (const el of [this.start, this.pause, this.death, this.sun, this.pact]) {
      el.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).dataset.a;
        if (a === 'justice' || a === 'level' || a === 'hub' || a === 'new') this.onPlay(a);
        else if (a === 'resume') this.onResume();
        else if (a === 'quit') this.onQuit();
        else if (a === 'rise') this.onRise();
        else if (a === 'sun') this.onSunClose();
        else if (a === 'pact-yes' || a === 'pact-no') this.onPact(a === 'pact-yes');
      });
    }
  }

  private make(html: string) {
    const d = document.createElement('div');
    d.className = 'overlay';
    d.innerHTML = html;
    document.body.appendChild(d);
    return d;
  }

  /** With a save in progress, Play continues it. */
  setContinue(has: boolean) {
    this.playBtn ??= this.start.querySelector('button[data-a="hub"]')!;
    this.playBtn.textContent = has ? 'Continue' : 'Play';
  }

  showStart(v: boolean) {
    this.start.classList.toggle('hidden', !v);
  }
  showPause(v: boolean) {
    this.pause.classList.toggle('hidden', !v);
  }
  /** The Devil holds out his pact: the game waits for an answer. */
  showPact(v: boolean, terms = '') {
    this.pact.classList.toggle('hidden', !v);
    this.pact.querySelector('.line')!.textContent = terms;
  }
  get pactShown() {
    return !this.pact.classList.contains('hidden');
  }

  /** The ending: the card's image and one line. */
  showSun(v: boolean, line = '') {
    this.sun.classList.toggle('hidden', !v);
    this.sun.querySelector('.line')!.textContent = line;
  }
  get sunShown() {
    return !this.sun.classList.contains('hidden');
  }

  showDeath(v: boolean, note = '') {
    this.death.classList.toggle('hidden', !v);
    this.deathNote.textContent = note;
  }
}

/**
 * The Sun (XIX), drawn in code: the sun with straight and wavy rays over a garden wall, sunflowers along it, and the
 * child on a pale horse, arms open. Card proportions, an SVG string.
 */
function sunCard() {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const r0 = 46;
    const r1 = i % 2 ? 78 : 70;
    const x0 = 120 + Math.cos(a) * r0;
    const y0 = 100 + Math.sin(a) * r0;
    if (i % 2) return `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${(120 + Math.cos(a) * r1).toFixed(1)}" y2="${(100 + Math.sin(a) * r1).toFixed(1)}" stroke="#e8b84a" stroke-width="5" stroke-linecap="round"/>`;
    const n = [0.33, 0.66, 1].map((k, j) => {
      const r = r0 + (r1 - r0) * k;
      const off = (j % 2 ? 1 : -1) * 0.06;
      return `${(120 + Math.cos(a + off) * r).toFixed(1)},${(100 + Math.sin(a + off) * r).toFixed(1)}`;
    });
    return `<polyline points="${x0.toFixed(1)},${y0.toFixed(1)} ${n.join(' ')}" fill="none" stroke="#d99a3a" stroke-width="3" stroke-linecap="round"/>`;
  }).join('');
  const flowers = [40, 80, 160, 200]
    .map((x) => `<line x1="${x}" y1="246" x2="${x}" y2="222" stroke="#5f7a3a" stroke-width="3"/><circle cx="${x}" cy="218" r="9" fill="#e8b84a"/><circle cx="${x}" cy="218" r="4" fill="#7a4a2a"/>`)
    .join('');
  return `<svg class="card" viewBox="0 0 240 380" width="200" height="316" aria-label="The Sun">
    <rect x="2" y="2" width="236" height="376" rx="10" fill="#f2e6c4" stroke="#2a2420" stroke-width="4"/>
    <rect x="12" y="12" width="216" height="330" fill="#a9c8e0"/>
    ${rays}
    <circle cx="120" cy="100" r="44" fill="#f0c95a" stroke="#d99a3a" stroke-width="3"/>
    <rect x="12" y="246" width="216" height="40" fill="#b8a48a"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${12 + i * 36}" y1="246" x2="${12 + i * 36}" y2="286" stroke="#8a7a64" stroke-width="2"/>`).join('')}
    ${flowers}
    <rect x="12" y="286" width="216" height="56" fill="#9ab07a"/>
    <path d="M70 300 q10 -34 50 -30 q40 -2 48 26 l-6 36 h-8 l-4 -26 h-46 l-6 26 h-8 z" fill="#f4f0e8" stroke="#2a2420" stroke-width="2"/>
    <circle cx="118" cy="244" r="11" fill="#f0d0b0" stroke="#2a2420" stroke-width="2"/>
    <path d="M118 256 v20 M96 246 l22 14 l22 -14" stroke="#2a2420" stroke-width="3" fill="none" stroke-linecap="round"/>
    <text x="120" y="364" text-anchor="middle" font-family="serif" font-size="18" fill="#2a2420">XIX · THE SUN</text>
  </svg>`;
}
