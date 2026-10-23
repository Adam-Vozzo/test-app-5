// Start / pause menus. (Death screen arrives in M4.) No other menus. See CLAUDE.md out-of-scope list.

const KEYS: [string, string][] = [
  ['WASD', 'move'],
  ['Mouse', 'look'],
  ['LMB / RMB', 'fire / aim'],
  ['Space', 'dodge-roll'],
  ['Shift', 'sprint'],
  ['R', 'reload'],
  ['Q', 'heal (3 charges)'],
  ['E', 'rest at sugar cube'],
  ['1 / 2 / 3 · wheel', 'swap weapon'],
  ['C', 'swap shoulder'],
  ['`', 'tuning panel'],
  ['T', 'slow-mo 0.25×'],
  ['I / H / L', 'IK / hitbox / AI debug'],
  ['G', 'god mode'],
  ['P', 'pixel mode'],
  ['Esc', 'pause'],
];

export class Menus {
  private start: HTMLDivElement;
  private pause: HTMLDivElement;
  private death: HTMLDivElement;
  private deathNote: HTMLElement;
  onRise: () => void = () => {};
  onPlay: (mode: 'arena' | 'range') => void = () => {};
  onResume: () => void = () => {};
  onQuit: () => void = () => {};

  constructor(seed: number) {
    const keys = KEYS.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('');
    this.start = this.make(`
      <h1>A bug<span>s</span> death</h1>
      <p>A tiny beetle with an improvised gun. Everything here is generated in code.</p>
      <button data-a="arena">Play: test arena</button>
      <button data-a="range">Target-dummy range</button>
      <div class="keys">${keys}</div>
      <div class="seed">seed ${seed} · add ?seed=… to the URL to change it</div>`);
    this.pause = this.make(`
      <h1>Paused</h1>
      <button data-a="resume">Resume</button>
      <button data-a="quit">Quit to menu</button>
      <div class="keys">${keys}</div>`);
    this.pause.classList.add('hidden');
    this.death = this.make(`
      <h1>Squished</h1>
      <p class="note"></p>
      <button data-a="rise">Rise at the sugar cube</button>`);
    this.death.classList.add('death', 'hidden');
    this.deathNote = this.death.querySelector('.note')!;
    for (const el of [this.start, this.pause, this.death]) {
      el.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).dataset.a;
        if (a === 'arena' || a === 'range') this.onPlay(a);
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
