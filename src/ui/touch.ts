// Touch controls (V2-18): the game on a phone or tablet. A floating stick lands under the left thumb (push it to
// the rim to run); a drag anywhere else on the screen looks, and so does the thumb holding Fire; thumb buttons on the
// right hold the verbs. They press the same codes the keyboard and mouse do (`Input`), so every system reads them as
// it always has. The buttons show only what she can do now: the SwordRifle's mode with the SwordRifle out, the parry
// and the dash once they're unbound, Use while there's something to use. Feel numbers: `tuning.touch`.
import type { Input } from '../core/input';
import { readStick } from '../core/stick';
import { tuning } from '../tuning';

type Verb = 'fire' | 'aim' | 'roll' | 'reload' | 'swap' | 'mode' | 'heal' | 'use' | 'parry' | 'dash' | 'pause';

/** What the game tells the controls each frame. */
export interface TouchState {
  /** Playing, alive, not in a menu: the controls are up. */
  visible: boolean;
  /** The SwordRifle is in hand (its mode button shows). */
  swordRifle: boolean;
  /** ...in sword mode: Aim becomes a held charge. */
  swordMode: boolean;
  parry: boolean;
  dash: boolean;
  /** The interaction prompt, if there's something to use. */
  prompt: string | null;
}

/** Each verb: its label, the code it presses, and how: held while touched, tapped, or toggled on and off. */
const VERBS: { verb: Verb; label: string; code: string; kind: 'hold' | 'tap' | 'toggle' }[] = [
  { verb: 'fire', label: 'Fire', code: 'Mouse0', kind: 'hold' },
  { verb: 'aim', label: 'Aim', code: 'Mouse2', kind: 'toggle' },
  { verb: 'roll', label: 'Roll', code: 'Space', kind: 'tap' },
  { verb: 'reload', label: 'Reload', code: 'KeyR', kind: 'tap' },
  { verb: 'swap', label: 'Swap', code: '', kind: 'tap' },
  { verb: 'mode', label: 'Sword', code: 'KeyF', kind: 'tap' },
  { verb: 'heal', label: 'Heal', code: 'KeyQ', kind: 'tap' },
  { verb: 'parry', label: 'Parry', code: 'KeyV', kind: 'tap' },
  { verb: 'dash', label: 'Dash', code: 'KeyX', kind: 'tap' },
  { verb: 'use', label: 'Use', code: 'KeyE', kind: 'tap' },
  { verb: 'pause', label: 'Ⅱ', code: '', kind: 'tap' },
];

interface Track {
  kind: 'stick' | 'look' | 'button';
  verb?: Verb;
  x: number;
  y: number;
  /** The stick's base (where the thumb landed). */
  ox: number;
  oy: number;
}

export class TouchControls {
  readonly root: HTMLDivElement;
  private buttons = new Map<Verb, HTMLButtonElement>();
  private base: HTMLDivElement;
  private knob: HTMLElement;
  private tracks = new Map<number, Track>();
  private aimOn = false;
  private visible = false;
  private state: TouchState = { visible: false, swordRifle: false, swordMode: false, parry: false, dash: false, prompt: null };
  /** Pause asked for (the game drops its soft lock, which pauses). */
  onPause: () => void = () => {};

  constructor(private input: Input) {
    this.root = document.createElement('div');
    this.root.className = 'touch';
    this.root.style.display = 'none';
    this.root.innerHTML = `<div class="stick"><i></i></div>${VERBS.map((v) => `<button class="tb ${v.verb}" data-v="${v.verb}">${v.label}</button>`).join('')}`;
    document.body.appendChild(this.root);
    this.base = this.root.querySelector<HTMLDivElement>('.stick')!;
    this.knob = this.base.querySelector<HTMLDivElement>('i')!;
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('button[data-v]')) this.buttons.set(b.dataset.v as Verb, b);
    // The layer itself lets everything through (a mouse on a touch laptop still reaches the game); its buttons, and
    // touches on the bare screen while it's up, are caught at the window.
    window.addEventListener('pointerdown', (e) => this.down(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    // No long-press menus, no double-tap zoom, no text selection under a thumb.
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** The game's state this frame: show or hide, and which buttons. */
  sync(s: TouchState) {
    this.state = s;
    if (s.visible !== this.visible) {
      this.visible = s.visible;
      this.root.style.display = s.visible ? '' : 'none';
      if (!s.visible) this.reset();
    }
    if (!s.visible) return;
    const show = (v: Verb, on: boolean) => this.buttons.get(v)!.classList.toggle('off', !on);
    show('mode', s.swordRifle);
    show('parry', s.parry);
    show('dash', s.dash);
    show('use', !!s.prompt);
    const use = this.buttons.get('use')!;
    const label = s.prompt ? s.prompt.replace(/^E:\s*/, '') : 'Use';
    if (use.textContent !== label) use.textContent = label;
    // In sword mode Aim is the charged strike: held, not toggled.
    const aim = this.buttons.get('aim')!;
    const aimLabel = s.swordMode ? 'Charge' : 'Aim';
    if (aim.textContent !== aimLabel) aim.textContent = aimLabel;
    if (s.swordMode && this.aimOn) this.setAim(false);
    this.buttons.get('mode')!.textContent = s.swordMode ? 'Rifle' : 'Sword';
  }

  private setAim(on: boolean) {
    this.aimOn = on;
    this.buttons.get('aim')!.classList.toggle('on', on);
    if (on) this.input.press('Mouse2');
    else this.input.release('Mouse2');
  }

  /** Every thumb lifted and every code let go. */
  private reset() {
    this.tracks.clear();
    this.aimOn = false;
    for (const b of this.buttons.values()) b.classList.remove('on', 'held');
    this.base.classList.remove('active');
    this.input.releaseAll();
  }

  private down(e: PointerEvent) {
    if (!this.visible || e.pointerType === 'mouse') return;
    // (no mouse events made up from the touch, no scrolling)
    e.preventDefault();
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-v]');
    if (btn && !btn.classList.contains('off')) {
      const verb = btn.dataset.v as Verb;
      this.tracks.set(e.pointerId, { kind: 'button', verb, x: e.clientX, y: e.clientY, ox: 0, oy: 0 });
      btn.classList.add('held');
      this.press(verb);
      return;
    }
    // Bare screen: the left of it is the stick's (it lands under the thumb), the rest looks.
    const stick = e.clientX < window.innerWidth * tuning.touch.stickZone && ![...this.tracks.values()].some((t) => t.kind === 'stick');
    this.tracks.set(e.pointerId, { kind: stick ? 'stick' : 'look', x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY });
    if (stick) {
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('active');
      this.updateStick(e.clientX, e.clientY);
    }
  }

  private move(e: PointerEvent) {
    const t = this.tracks.get(e.pointerId);
    if (!t) return;
    e.preventDefault();
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    t.x = e.clientX;
    t.y = e.clientY;
    if (t.kind === 'stick') this.updateStick(e.clientX, e.clientY);
    // The thumb on Fire looks too: hold and drag to walk the shots onto a target.
    else if (t.kind === 'look' || t.verb === 'fire') this.input.look(dx * tuning.touch.lookSens, dy * tuning.touch.lookSens);
  }

  private up(e: PointerEvent) {
    const t = this.tracks.get(e.pointerId);
    if (!t) return;
    this.tracks.delete(e.pointerId);
    if (t.kind === 'stick') {
      this.base.classList.remove('active');
      this.input.stickX = 0;
      this.input.stickY = 0;
      this.input.stickSprint = false;
    } else if (t.kind === 'button' && t.verb) {
      this.buttons.get(t.verb)!.classList.remove('held');
      this.release(t.verb);
    }
  }

  private updateStick(x: number, y: number) {
    const t = [...this.tracks.values()].find((k) => k.kind === 'stick');
    if (!t) return;
    const r = tuning.touch.stickRadius * Math.min(window.innerWidth, window.innerHeight);
    const s = readStick(x - t.ox, y - t.oy, { radius: r, deadzone: tuning.touch.deadzone, sprintAt: tuning.touch.sprintAt });
    this.base.style.setProperty('--r', `${r}px`);
    this.knob.style.transform = `translate(${s.knobX}px, ${s.knobY}px)`;
    this.input.stickX = s.x;
    this.input.stickY = s.y;
    this.input.stickSprint = s.sprint;
    this.base.classList.toggle('sprint', s.sprint && s.y > 0);
  }

  private press(verb: Verb) {
    const v = VERBS.find((x) => x.verb === verb)!;
    if (verb === 'pause') return this.onPause();
    // Swap: the next weapon, as the mouse wheel does.
    if (verb === 'swap') {
      this.input.wheel += 1;
      return;
    }
    if (v.kind === 'toggle' && !this.state.swordMode) return this.setAim(!this.aimOn);
    this.input.press(v.code);
  }

  private release(verb: Verb) {
    const v = VERBS.find((x) => x.verb === verb)!;
    if (!v.code || (v.kind === 'toggle' && !this.state.swordMode)) return;
    this.input.release(v.code);
  }
}

/** Should the touch controls be on? `?touch=1` / `?touch=0` decide; otherwise a touch screen without a mouse does. */
export function wantsTouch(search: string): boolean {
  const q = new URLSearchParams(search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches;
}
