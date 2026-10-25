# Eight

A souls-like third-person shooter set in a world built from the tarot, played as the Eight of Swords. Everything is
generated in code: geometry, animation, levels and sound. No asset files.

v2 is an iteration of *A bugs death*, the bug-scale v1 prototype. Its docs are frozen in `archive/v1/`. The playable
build is V2-4: the Eight of Swords, her auto-pistol and the SwordRifle, in generated Justice levels with Justice's
enemies (Bailiff, Gavel, Blindfold, Page of Swords), and a training courtyard.

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

URL params: `?seed=123` (any string works), `?mode=level&level=1` (a generated Justice level, 1–3) or `?mode=justice`
(the training courtyard) to skip the menu. The v1 bug-scale scenes are still
reachable with `?mode=garden|kitchen|arena|range` until v2 replaces them.

## Docs

- `DESIGN.md`: game structure, the four dimensions, court-card minibosses, hub and characters
- `LEVELS.md`: level design principles and the procedural generation pipeline
- `STYLE.md`: the look
- `PLAN.md`: milestones
- `PLAYTEST.md`: what to try at each milestone
- `CLAUDE.md`: pillars and conventions
