import { describe, expect, it } from 'vitest';
import { GARDEN, KITCHEN, SIGNAL, type BiomePalette } from '../src/render/palette';

const rgb = (hex: number) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => v / 255);
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex: number) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number, b: number) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hue = (hex: number) => {
  const [r, g, b] = rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return null; // grey: any hue contrasts
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const hueGap = (a: number, b: number) => {
  const ha = hue(a);
  const hb = hue(b);
  if (ha === null || hb === null) return 180;
  const d = Math.abs(ha - hb) % 360;
  return Math.min(d, 360 - d);
};

describe('telegraph colour stands out in every biome (STYLE.md pillar 2)', () => {
  for (const p of [GARDEN, KITCHEN] as BiomePalette[]) {
    it(p.name, () => {
      const surfaces = [p.groundLit, p.groundLight, p.groundShade, p.groundShadow, p.stalk, p.pebbleA, p.pebbleB, p.leafA, p.leafB, p.fog];
      for (const s of surfaces) {
        // Either a clearly different hue, or a strong brightness difference.
        const ok = hueGap(SIGNAL.telegraph, s) >= 35 || contrast(SIGNAL.telegraph, s) >= 2.5;
        expect(ok, `telegraph vs #${s.toString(16)}`).toBe(true);
      }
      // Readable over the lit ground and against the fog at range.
      expect(contrast(SIGNAL.telegraph, p.fog)).toBeGreaterThanOrEqual(2.5);
    });
  }
  it('signal colours are distinct from each other', () => {
    expect(hueGap(SIGNAL.telegraph, SIGNAL.weakSpot)).toBeGreaterThan(90);
    expect(hueGap(SIGNAL.telegraph, SIGNAL.crit)).toBeGreaterThan(60);
    expect(hueGap(SIGNAL.telegraph, 0xff6a3d)).toBeGreaterThan(30); // player's orange torso
  });
});
