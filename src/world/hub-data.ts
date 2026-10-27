// The hub's content as data: the Magician's table, and the short state-based lines (no trees, no voice; DESIGN.md
// → Hub characters → dialogue budget).
import type { ShopItem } from '../core/save';

/** Dimension order: each gate opens when the one before is cleared (DESIGN.md). Justice and the Devil are built. */
export const DIMENSION_ORDER = ['justice', 'devil', 'tower', 'moon'] as const;

/** The unbinding each arcana frees. */
export const UNBINDINGS: Record<string, string> = { justice: 'parry', devil: 'dash' };

/** What each arcana says as it falls and its cord comes away (first time; then the short line). */
export const UNBINDING_LINES: Record<string, { first: string; again: string }> = {
  justice: { first: 'Justice is weighed. A cord falls away: you can parry (V). Meet a blow as it lands.', again: 'Justice is weighed again.' },
  devil: {
    first: 'The Devil falls from his pedestal. A chain breaks: you can dash (X), straight through chains.',
    again: 'The Devil falls again. The chains were always loose.',
  },
};

export const SHOP: ShopItem[] = [
  { id: 'repair1', name: 'Mend the edge', blurb: "The SwordRifle's first repair: the blade remembered.", price: 400, requires: { relic: 'swords' }, effect: { repairStage: 1 } },
  { id: 'repair2', name: 'True the barrel', blurb: "The second repair: the barrel straightened, the rifle's bite back.", price: 650, requires: { relic: 'pentacles', upgrade: 'repair1' }, effect: { repairStage: 2 } },
  { id: 'pistolDamage', name: 'Tempered rounds', blurb: 'The auto-pistol hits 15% harder.', price: 250, effect: { pistolDamageMul: 1.15 } },
  { id: 'pistolMag', name: 'Deeper magazine', blurb: '+8 rounds in the auto-pistol.', price: 200, effect: { pistolMagBonus: 8 } },
  { id: 'flask', name: 'Another flask', blurb: '+1 heal flask.', price: 300, effect: { healBonus: 1 } },
];

/** Lines by save state: 'fresh' (never gone through), 'walking' (on the road), 'cleared' (Justice is weighed). */
export const PRIESTESS_LINES: Record<string, readonly string[]> = {
  fresh: [
    'You wake bound, and the bindings are loose. They always were.',
    'Four gates. Only the angel is awake.',
    'Beyond it, everything is weighed. Walk toward the scales.',
    "Rest where the Hermit's lantern burns. It remembers you.",
  ],
  walking: [
    'You came back. That is most of it.',
    'The Bailiffs turn their shields to whoever faces them. Do not face them.',
    'The one who wears the band hears you. It does not see you.',
    'A court of Swords waits at the end of every road.',
  ],
  cleared: [
    'Justice is weighed, and so are you. One cord is gone.',
    'Answer in kind. When a blow comes, meet it. (V: parry)',
    "The bull is awake. Below its gate, everything has a price.",
    'The Magician will want the relic of Swords.',
  ],
  // The Devil has fallen (V2-10).
  devil: [
    'The chains were loose. You knew that, and you went down anyway.',
    'What you carried out of the pit, you chose to carry.',
    'A chain breaks for you now. (X: dash, straight through)',
    "The lion is awake. Its road isn't built yet.",
  ],
};

export const MAGICIAN_LINES: Record<string, readonly string[]> = {
  default: ['Pentacles for parts. A fair trade.', 'Everything on this table was one thing once.', 'The rifle remembers being whole.'],
};
