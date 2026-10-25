# PLAYTEST.md

Newest milestone first. Each entry says what to try and what I'm unsure about.
Feel and difficulty can only be judged by playing; nothing here claims they're good.
v1 entries (M0–M6, tuning passes, render passes) are in `archive/v1/PLAYTEST.md`.

## V2-0 follow-up: decisions recorded
Your answers are now in the docs:
- **Title:** *Eight*.
- **The four pairings, their order, and Justice as the slice.**
- **SwordRifle:** sword hits refill charges, and every level and lantern starts full. The rifle mode is built from
  the staple driver's def so it feels as heavy.
- **Progression:** each arcana boss frees one restraint, which is a new move.
- **Trial grounds:** a dev sandbox (`?mode=trials`) for the Chariot (momentum) and the Hanged Man (the world moves only
  while you stand still). It's a side track in `PLAN.md` that doesn't block the slice.

**Also decided since:**
- **No rifle reload.** The SwordRifle shows its charge as glowing cells on the weapon (plus HUD pips), in a new
  reserved violet.
- **Parry** is Justice's unbinding move.

**Unsure about:** the violet charge colour (`#9C7BFF`) is a first pick. It needs to stay readable on the weapon at
pixel scale and never be mistaken for telegraph magenta. It's well clear of magenta (74° of hue apart), but it shares
a hue family with the Tower's grey-violet fog and the Moon's indigo. It's much more saturated than either, which is
fine on paper, but check it in those dimensions' screenshots.

## V2-0: Direction and docs
Nothing new to play: the build is still the v1 prototype. Read `DESIGN.md`, `LEVELS.md` and `STYLE.md`, and accept,
change or reject each **Proposed** item.

**Decide before V2-2 (the SwordRifle):**
- **The charge loop:** sword hits refill charges and rifle shots spend them. Is that the SwordRifle you imagined?
- **The four dimensions:** Justice × Swords, the Devil × Pentacles, the Tower × Wands and the Moon × Cups, in that
  order. And is Justice the right slice?

**Decide before V2-7 (the hub):**
- Unbinding as the progression arc (`DESIGN.md → The protagonist`).
- The hub as The World, and its cast (Magician, High Priestess, the Star arriving after the Tower).

**Unsure about:**
- **The palettes** in `STYLE.md` are first guesses from screenshots of the references, not tested in-engine. V2-1's
  greybox courtyard is where they get judged.
- **Pixel mode on by default** suits Brume, but it may fight the painterly sky. Both are evaluated in V2-1.
- **The Moon's illusions** stretch pillar 2. The tells (no shadow, no footsteps) need to be readable in pixel mode
  and fog, and that can't be known until it's played.
