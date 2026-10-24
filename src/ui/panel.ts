// lil-gui tuning panel (backtick). Built generically from the tuning object so every number appears.
import GUI, { type Controller } from 'lil-gui';
import { DEFAULT_TUNING_JSON, deepAssign, tuning } from '../tuning';

const PRESET_KEY = 'abd.presets.v1';

type Obj = Record<string, unknown>;

/** Slider range heuristics from the default value; anything odd stays a number box (drag to edit). */
/** Explicit slider ranges where the default-value heuristic would pick a bad range. */
const RANGES: Record<string, [number, number, number]> = {
  kuwaharaRadius: [0, 6, 1],
  posterizeLevels: [2, 16, 1],
  posterizeMix: [0, 1, 0.01],
  edgeStrength: [0, 1, 0.01],
  edgeThreshold: [0.005, 0.3, 0.005],
  edgeWidth: [0.5, 4, 0.1],
  saturation: [0, 2, 0.01],
  grain: [0, 0.15, 0.005],
  resolutionScale: [0.25, 1, 0.05],
  keepSignals: [0, 1, 0.05],
  signalSaturation: [0.2, 1, 0.01],
};

function addNumber(folder: GUI, obj: Obj, key: string): Controller {
  const v = obj[key] as number;
  const lower = key.toLowerCase();
  const r = RANGES[key];
  if (r) return folder.add(obj, key, r[0], r[1], r[2]);
  if (lower.includes('color')) return folder.addColor(obj, key);
  if (Number.isInteger(v) && Math.abs(v) >= 1 && Math.abs(v) < 64 && !lower.includes('deg')) {
    return folder.add(obj, key, Math.min(0, v * 3), Math.max(1, v * 3), 1);
  }
  if (v > 0) return folder.add(obj, key, 0, v * 4);
  if (v < 0) return folder.add(obj, key, v * 4, -v * 4);
  return folder.add(obj, key);
}

/** Weapon defs are long and flat; present them in sub-folders. Unlisted keys land in "other". */
const WEAPON_GROUPS: Record<string, string[]> = {
  damage: ['damage', 'critMultiplier', 'falloffStart', 'falloffEnd', 'falloffMinMul', 'pellets', 'pierce', 'stagger', 'knockback', 'selfKnockback', 'range'],
  handling: ['rpm', 'auto', 'magSize', 'reserve', 'reloadMode', 'reloadTime', 'cycle', 'cycleTime', 'hitscan', 'projectileSpeed', 'projectileGravity'],
  spread: ['hipSpread', 'adsSpread', 'moveSpreadMul', 'airSpreadMul', 'bloomPerShot', 'bloomMax', 'bloomRecovery', 'pelletSpread', 'adsPelletMul', 'pelletJitter'],
  recoil: ['recoilVertical', 'recoilHorizontal', 'recoilHorizontalFreq', 'recoilHorizontalBias', 'recoilRandom', 'recoilRampShots', 'recoilRamp', 'adsRecoilMul', 'kickReturn', 'cameraKickMul', 'cameraKickStiffness', 'cameraKickDamping'],
  'weapon kick / fov / shake': ['weaponKickBack', 'weaponKickPitch', 'weaponKickRoll', 'weaponKickStiffness', 'weaponKickDamping', 'fovPunch', 'fovPunchStiffness', 'fovPunchDamping', 'trauma'],
  fx: ['tracerColor', 'tracerSpeed', 'tracerLength', 'tracerWidth', 'flashScale', 'flashFrames', 'flashLight', 'flashColor', 'impactParticles', 'impactSpeed', 'casingSpeed'],
  audio: ['pitchJitter', 'volume', 'layers', 'cycleLayers'],
};

function buildWeapon(folder: GUI, obj: Obj, skip: Set<string>) {
  const used = new Set<string>(skip);
  for (const [name, keys] of Object.entries(WEAPON_GROUPS)) {
    const sub = folder.addFolder(name);
    for (const k of keys) if (k in obj) used.add(k);
    build(sub, obj, new Set([...Object.keys(obj).filter((k) => !keys.includes(k)), '__flat']));
    sub.close();
  }
  const rest = Object.keys(obj).filter((k) => !used.has(k));
  if (rest.length) build(folder.addFolder('other'), obj, new Set([...Object.keys(obj).filter((k) => !rest.includes(k)), '__flat']));
}

function build(folder: GUI, obj: Obj, skip: Set<string>) {
  if ('rpm' in obj && 'layers' in obj && !skip.has('__flat')) {
    buildWeapon(folder, obj, new Set([...skip, 'id', 'name', 'slot']));
    return;
  }
  for (const key of Object.keys(obj)) {
    if (skip.has(key)) continue;
    const v = obj[key];
    if (typeof v === 'number') addNumber(folder, obj, key);
    else if (typeof v === 'boolean') folder.add(obj, key);
    else if (typeof v === 'string' && key === 'wave') folder.add(obj, key, ['sine', 'triangle', 'square', 'sawtooth']);
    else if (typeof v === 'string' && key === 'filter') folder.add(obj, key, ['lowpass', 'highpass', 'bandpass']);
    else if (typeof v === 'string' && key === 'kind') folder.add(obj, key, ['osc', 'noise']);
    else if (typeof v === 'string' && key === 'reloadMode') folder.add(obj, key, ['mag', 'single']);
    else if (typeof v === 'string' && key === 'cycle') folder.add(obj, key, ['none', 'pump', 'bolt']);
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
      if (key !== 'debug' && key !== 'post') f.close();
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
