# A bugs death

A playable web prototype of a cute, bug-scale, souls-like third-person shooter. Everything is generated in code:
geometry, animation, sound. No asset files.

```
npm install
npm run dev        # play at the printed URL
npm test           # unit tests (IK, gait, RNG)
npm run smoke      # build + headless Chromium run with screenshots (add -- --range for the gun scenario)
npm run build      # static build in dist/ (relative base, GitHub Pages ready)
```

URL params: `?seed=123` (any string works) and `?mode=arena|range` to skip the menu.

See `CLAUDE.md` (pillars and conventions), `STYLE.md` (look), `PLAN.md` (milestones) and `PLAYTEST.md` (what to try).
