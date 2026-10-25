import { describe, expect, it } from 'vitest';
import { FOES, GARDEN, GEAR, JUSTICE, KITCHEN, PLAYER, SIGNAL, WORLD, type AreaPalette, type BiomePalette } from '../src/render/palette';

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
  for (const p of [JUSTICE, WORLD] as AreaPalette[]) {
    it(`${p.name} (v2 area)`, () => {
      const s = p.surfaces;
      const surfaces = [s.light, s.mid, s.dark, s.shadow, s.growth, p.accent, p.accentShade, p.fog, p.sky ?? p.fog, GEAR.lantern];
      for (const c of surfaces) {
        const ok = hueGap(SIGNAL.telegraph, c) >= 35 || contrast(SIGNAL.telegraph, c) >= 2.5;
        expect(ok, `telegraph vs #${c.toString(16)}`).toBe(true);
      }
      // v2 fog runs toward light, so the telegraph must still read against a pale horizon.
      expect(contrast(SIGNAL.telegraph, p.fog)).toBeGreaterThanOrEqual(2.5);
      // The accent motif is never mistaken for crit gold.
      expect(hueGap(p.accent, SIGNAL.crit) >= 15 || contrast(p.accent, SIGNAL.crit) >= 1.5).toBe(true);
    });
  }
  it("the Eight of Swords' robe never reads as kill red or telegraph magenta", () => {
    for (const robe of [PLAYER.robe, PLAYER.robeShade, PLAYER.cowl]) {
      expect(contrast(robe, SIGNAL.kill)).toBeGreaterThanOrEqual(2);
      expect(hueGap(robe, SIGNAL.telegraph)).toBeGreaterThan(30);
    }
  });
  it('the charge colour reads in every area and is never mistaken for a telegraph', () => {
    expect(hueGap(SIGNAL.charge, SIGNAL.telegraph)).toBeGreaterThan(60);
    expect(hueGap(SIGNAL.charge, SIGNAL.weakSpot)).toBeGreaterThan(60);
    for (const p of [JUSTICE, WORLD] as AreaPalette[]) {
      const s = p.surfaces;
      for (const c of [s.light, s.mid, s.dark, s.shadow, s.growth, p.fog, p.accent]) {
        const ok = hueGap(SIGNAL.charge, c) >= 35 || contrast(SIGNAL.charge, c) >= 2;
        expect(ok, `charge vs #${c.toString(16)}`).toBe(true);
      }
    }
  });
  it("Justice's enemies never wear a signal colour, and read dark against the fog (STYLE.md → Characters)", () => {
    // Saturation: a near-grey never reads as a saturated signal, whatever its nominal hue.
    const sat = (hex: number) => {
      const [r, g, b] = rgb(hex);
      const max = Math.max(r, g, b);
      return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    };
    for (const [name, c] of Object.entries(FOES)) {
      for (const sig of [SIGNAL.telegraph, SIGNAL.kill, SIGNAL.weakSpot, SIGNAL.crit, SIGNAL.charge]) {
        const ok = hueGap(c, sig) >= 35 || contrast(c, sig) >= 2 || sat(c) < 0.2;
        expect(ok, `${name} vs signal #${sig.toString(16)}`).toBe(true);
      }
    }
    // The bodies (not the small gear accents) stand out as silhouettes against the pale horizon.
    for (const body of [FOES.bailiffArmour, FOES.shield, FOES.gavelBody, FOES.blindfoldRobe, FOES.pageCoat, FOES.limb]) {
      expect(contrast(body, JUSTICE.fog), `#${body.toString(16)}`).toBeGreaterThanOrEqual(4);
    }
  });
  it('signal colours are distinct from each other', () => {
    expect(hueGap(SIGNAL.telegraph, SIGNAL.weakSpot)).toBeGreaterThan(90);
    expect(hueGap(SIGNAL.telegraph, SIGNAL.crit)).toBeGreaterThan(60);
    expect(hueGap(SIGNAL.telegraph, 0xff6a3d)).toBeGreaterThan(30); // v1 beetle's orange torso
  });
});
