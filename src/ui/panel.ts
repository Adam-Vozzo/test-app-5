// lil-gui tuning panel (backtick). Built generically from the tuning object so every number appears.
import GUI, { type Controller } from 'lil-gui';
import { DEFAULT_TUNING_JSON, deepAssign, tuning } from '../tuning';

const PRESET_KEY = 'abd.presets.v1';

type Obj = Record<string, unknown>;

/** Slider range heuristics from the default value; anything odd stays a number box (drag to edit). */
function addNumber(folder: GUI, obj: Obj, key: string): Controller {
  const v = obj[key] as number;
  const lower = key.toLowerCase();
  if (lower.includes('color')) return folder.addColor(obj, key);
  if (Number.isInteger(v) && Math.abs(v) >= 1 && Math.abs(v) < 64 && !lower.includes('deg')) {
    return folder.add(obj, key, Math.min(0, v * 3), Math.max(1, v * 3), 1);
  }
  if (v > 0) return folder.add(obj, key, 0, v * 4);
  if (v < 0) return folder.add(obj, key, v * 4, -v * 4);
  return folder.add(obj, key);
}

function build(folder: GUI, obj: Obj, skip: Set<string>) {
  for (const key of Object.keys(obj)) {
    if (skip.has(key)) continue;
    const v = obj[key];
    if (typeof v === 'number') addNumber(folder, obj, key);
    else if (typeof v === 'boolean') folder.add(obj, key);
    else if (typeof v === 'string' && key === 'wave') folder.add(obj, key, ['sine', 'triangle', 'square', 'sawtooth']);
    else if (typeof v === 'string' && key === 'filter') folder.add(obj, key, ['lowpass', 'highpass', 'bandpass']);
    else if (typeof v === 'string' && key === 'kind') folder.add(obj, key, ['osc', 'noise']);
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sub = folder.addFolder(key);
      build(sub, v as Obj, skip);
      sub.close();
    }
  }
}

export class Panel {
  readonly gui: GUI;
  open = false;
  onVisibility: (open: boolean) => void = () => {};
  private refreshPresets: () => void = () => {};

  constructor() {
    this.gui = new GUI({ title: 'Tuning  ( ` to close )', width: 330 });
    this.gui.domElement.style.zIndex = '50';
    const presets = this.gui.addFolder('Presets');
    const state = { name: 'my-preset', preset: '' };
    const names = () => Object.keys(this.loadAll());
    presets.add(state, 'name').name('save as');
    presets.add({ save: () => this.save(state.name) }, 'save').name('💾 Save preset');
    let pick: Controller | null = null;
    this.refreshPresets = () => {
      pick?.destroy();
      pick = presets.add(state, 'preset', names()).name('load');
      pick.onChange((n: string) => this.load(n));
    };
    this.refreshPresets();
    presets.add({ copy: () => this.copyJson() }, 'copy').name('📋 Copy JSON');
    presets.add({ paste: () => this.pasteJson() }, 'paste').name('📥 Paste JSON');
    presets.add({ reset: () => this.apply(JSON.parse(DEFAULT_TUNING_JSON)) }, 'reset').name('↺ Reset to defaults');

    const t = tuning as unknown as Obj;
    for (const key of Object.keys(t)) {
      const f = this.gui.addFolder(key);
      build(f, t[key] as Obj, new Set(['id', 'name']));
      if (key !== 'debug') f.close();
    }
    this.gui.hide();
  }

  addAction(label: string, fn: () => void) {
    this.gui.add({ [label]: fn }, label);
  }

  toggle(force?: boolean) {
    this.open = force ?? !this.open;
    if (this.open) this.gui.show();
    else this.gui.hide();
    this.onVisibility(this.open);
  }

  refresh() {
    for (const c of this.gui.controllersRecursive()) c.updateDisplay();
  }

  private loadAll(): Record<string, Obj> {
    try {
      return JSON.parse(localStorage.getItem(PRESET_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  save(name: string) {
    const all = this.loadAll();
    all[name] = JSON.parse(JSON.stringify(tuning));
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(all));
    } catch {
      /* storage unavailable */
    }
    this.refreshPresets();
  }

  load(name: string) {
    const p = this.loadAll()[name];
    if (p) this.apply(p);
  }

  apply(data: Obj) {
    deepAssign(tuning as unknown as Obj, data);
    this.refresh();
  }

  copyJson() {
    const text = JSON.stringify(tuning, null, 2);
    navigator.clipboard?.writeText(text).catch(() => window.prompt('Copy tuning JSON:', text));
    if (!navigator.clipboard) window.prompt('Copy tuning JSON:', text);
  }

  pasteJson() {
    const text = window.prompt('Paste tuning JSON:');
    if (!text) return;
    try {
      this.apply(JSON.parse(text));
    } catch (e) {
      console.warn('Bad tuning JSON', e);
    }
  }
}
