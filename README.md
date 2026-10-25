# Eight

A souls-like third-person shooter set in a world built from the tarot, played as the Eight of Swords. Everything is
generated in code: geometry, animation, levels and sound. No asset files.

v2 is an iteration of *A bugs death*, the bug-scale v1 prototype. Its docs are frozen in `archive/v1/`. Until
milestone V2-1 lands, the playable build is still the v1 prototype.

```
npm install
npm run dev        # play at the printed URL
npm test           # unit tests (IK, gait, RNG, generation)
npm run smoke      # build + headless Chromium run with screenshots (add -- --range for the gun scenario)
npm run build      # static build in dist/ (relative base, GitHub Pages ready)
```

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` runs the tests, builds, and deploys `dist/` on every push to `main` (or on demand from the Actions tab).
One-time setup: **Settings → Pages → Source: GitHub Actions**. The Vite `base` is relative (`./`), so it works under any repository sub-path.

URL params: `?seed=123` (any string works) and `?mode=garden|kitchen|arena|range` to skip the menu (v1 scenes).

## Docs

- `DESIGN.md`: game structure, the four dimensions, court-card minibosses, hub and characters
- `LEVELS.md`: level design principles and the procedural generation pipeline
- `STYLE.md`: the look
- `PLAN.md`: milestones
- `PLAYTEST.md`: what to try at each milestone
- `CLAUDE.md`: pillars and conventions
