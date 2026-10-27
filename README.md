# Eight

A souls-like third-person shooter set in a world built from the tarot, played as the Eight of Swords. Everything is
generated in code: geometry, animation, levels and sound. No asset files.

v2 is an iteration of *A bugs death*, the bug-scale v1 prototype. Its docs are frozen in `archive/v1/`. The playable
build is the first slice (V2-7): from the hub (The World, with the Magician's shop and the High Priestess) through
the angel's gate into Justice's three generated levels (Bailiffs, Gavels, Blindfolds, Pages; the Knight, Queen and King
of Swords) to Justice herself, who frees the parry. Progress saves in the browser. There's also a training courtyard.
The second dimension is built too (V2-8 to V2-10). Once Justice is cleared, the bull's gate leads down through the
Devil's descending levels: Misers, Imps, chained Thralls, the Page of Pentacles, tempting hoards, and the Pentacles
court. At the bottom is the Devil and his pact. He frees the dash. Then the lion's gate opens on the Tower: three climbing
levels on timber decks that crack, burn and fall under you; Firebrands, Fallers, Builders and the Page of Wands; the
Wands court; and the Crowned Tower on its collapsing top floor. Then the Star comes to the hub, and the eagle's gate
opens on the Moon's marsh, where some enemies and paths are reflections (they cast no shadow and make no sound).

```
npm install
npm run dev        # play at the printed URL
npm test           # unit tests (IK, gait, RNG, generation)
npm run smoke      # build + headless Chromium run with screenshots (add -- --level --pistol --sword for v2 scenarios)
npm run build      # static build in dist/ (relative base, GitHub Pages ready)
```

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs the tests, builds, and deploys `dist/` on every push to `main` (or on demand from the Actions tab).
One-time setup: **Settings → Pages → Source: GitHub Actions**. The Vite `base` is relative (`./`), so it works under any repository sub-path.

URL params: `?seed=123` (any string works), `?mode=hub`, `?mode=level&level=1` (a generated Justice level, 1–3; 4 is Justice's arena; add `&dim=devil` for the Devil's levels) or `?mode=justice`
(the training courtyard) to skip the menu. The v1 bug-scale scenes are still
reachable with `?mode=garden|kitchen|arena|range` until v2 replaces them.

## Docs

- `DESIGN.md`: game structure, the four dimensions, court-card minibosses, hub and characters
- `LEVELS.md`: level design principles and the procedural generation pipeline
- `STYLE.md`: the look
- `PLAN.md`: milestones
- `PLAYTEST.md`: what to try at each milestone
- `CLAUDE.md`: pillars and conventions
