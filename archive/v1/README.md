# v1 archive: *A bugs death* (bug-scale prototype)

These are the planning docs for v1. They are frozen and not edited any more. v2 is an iteration of the same project,
not a new one, and the code in `src/` carried over from v1.

v1 asked: **is a cute, bug-scale, souls-like third-person shooter satisfying for 10 minutes? Does each weapon feel
distinct within three shots, and can the player read and dodge everything that kills them?** It ran milestones M0–M6
plus two tuning passes and a render-style pass. The last v1 commit is `effce00`.

| File | What it was |
|---|---|
| `CLAUDE.md` | v1 pillars, scope and conventions (snapshot of the root file at the end of v1) |
| `README.v1.md` | v1 readme (renamed so this file can be the archive's index) |
| `PLAN.md` | M0–M6 milestones, all complete |
| `STYLE.md` | White Lavender style study: warm lamp-lit stage, fog toward dark, bug-scale props |
| `PLAYTEST.md` | Per-milestone playtest notes, newest first |

## What v1 proved and what carries into v2

- **Carries over (systems):** gun feel (hitscan on the input frame, recoil springs, juice, hitstop, synth audio),
  the stamina/roll/heal/death loop, the telegraph system and its reserved colours, procedural biped and multi-leg IK,
  the AI state machine, the seeded zone graph, the tuning panel with Copy JSON, pixel mode, the painterly pass, and the
  smoke-test harness.
- **Retired:** the bug-scale conceit, the household/garden props, the three bug weapons (rubber-band repeater,
  seed-spitter, staple driver) and the three bug enemies. Their *code paths* (hitscan, pellets, projectiles,
  lunge/lob/charge AI) remain as the basis for v2 content.
- **Changed by decision:** the tone is no longer cute, and fog now runs toward light, not dark. See the root
  `STYLE.md`.
