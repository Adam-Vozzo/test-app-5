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
    for (const el of [this.start, this.pause, this.death]) {
      el.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).dataset.a;
        if (a === 'justice' || a === 'level' || a === 'hub' || a === 'new') this.onPlay(a);
        else if (a === 'resume') this.onResume();
        else if (a === 'quit') this.onQuit();
        else if (a === 'rise') this.onRise();
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
  showDeath(v: boolean, note = '') {
    this.death.classList.toggle('hidden', !v);
    this.deathNote.textContent = note;
  }
}
