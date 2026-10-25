# STYLE.md: the look of *Eight* (v2)

The v1 style study (White Lavender, the warm lamp-lit stage, bug-scale props) is in `archive/v1/STYLE.md`.
v2 keeps v1's *technique* (no textures, vertex colours, toon ramp, reserved signal colours) and changes its *look*.

Three references, and what each one gives us. We take the *spirit* and copy no shapes, characters or layouts.
- **Brume** (Sokpop, 2019): a souls-like set on a foggy island, rendered in low-res 3D.
- **Grey Scout** (Sokpop, 2020): a stealth game on a rainy island.
- **Remnant 2** (Gunfire Games, 2023): scale and atmospheric perspective. It is rendered in a style far richer than
  ours, so we take its *composition*, not its surfaces.

## What makes the references work

Notes from studying the store screenshots, plus a Remnant 2 screenshot the user shared:

1. **Fog runs toward light.** Distance dissolves into a pale sky colour (atmospheric perspective). This is the
   **opposite of v1**, where fog ran toward dark. Depth reads as layers of silhouettes that lighten with distance.
2. **Values step from near to far.** Remnant puts near-black rock walls in the foreground, grey-teal cliffs in the
   middle and a bright fog opening at the back. Brume frames shots with dark trunks and arches against pale distance.
   Dark near, light far: the eye goes to the light.
3. **A framed landmark.** Converging walls, an overhead arch and hanging chains all point at one big thing (a statue
   on a pedestal, a keep, a giant figure). The bright opening behind it is where you're going.
4. **Scale through contrast.** A giant sword planted in the ground (Grey Scout), a towering cloaked figure (Brume),
   stacked ruins rising out of sight (Remnant). The player is small *in the world*, not small *as a bug*.
5. **A very limited palette per area.** It's desaturated and close in value: greys, mauves, lavenders, sage and
   teal-grey. Brume gives each area its own 4–5 colour palette (snow white, pale teal, dusty pink, olive, deep violet).
6. **One accent motif.** Remnant threads crimson growth through a teal-grey scene. Grey Scout's warm lanterns are the
   only saturated warmth in a cool world. One accent per area, used sparingly, means something.
7. **Warm light marks the way.** A lantern, a brazier, a fire at the goal. Light is navigation.
8. **Blocky, faceted forms, not rounded.** Grey Scout's grass is a field of upright boxes, and its rocks are low-poly
   lumps. Brume's trees are a slab trunk with a blob canopy. Hard edges, few faces and no cute roundness.
9. **Small, stocky, readable figures.** A hooded or helmeted head, a box or capsule body and stick limbs. The face is
   a dark hole or a single dot. Figures are read by their gear silhouette (sword, spear, shield, lantern).
10. **Painterly sky, posterised ground and low resolution.** Grey Scout has smeared, banded clouds and a diagonal rain
    hatch over the whole frame. Brume renders at low resolution with crisp pixels. We have pixel mode; a painterly
    or hatch pass is still to find (see *Shading and post*).

## v2 rules

### Tone: not cute (Decided)
- Proportions are about **3 heads tall** (stocky but not chibi), with angular silhouettes, flat-shaded facets and hard
  edges.
- No squash-and-stretch bounciness on characters. Weight comes from the procedural rig (lean, plant, recoil), not
  from cartoon deformation.
- Muted palettes and dark themes. Humour, if any, is dry.

### Scale (Decided: humanoid)
Units change in v2: **1 world unit = 1 metre**, and the player is about 1.6 m tall. The rescale is a `PLAN.md`
milestone; until it lands, the code still uses v1's beetle units.

| Thing | Size | Notes |
|---|---|---|
| Player | 1.6 m | stocky: ~0.55 m wide at the shoulders |
| Half cover | 0.8–1.0 m | waist height: crouch-free cover you shoot over |
| Full cover | ≥ 2.0 m | blocks the player and line of sight |
| Path width | 3–6 m | enough to roll sideways out of a lane |
| Combat clearing | 18–40 m across | see `LEVELS.md → Combat spaces` |
| Doorway / arch | 2.5–4 m tall | arches frame vistas, so err tall |
| Hero props | 8–30 m | planted swords, statues, chained pillars |
| Landmark | 60–450 m | the dimension's symbol, visible through fog; generated levels stand Justice's 175 m scales ≥ 360 m from the spawn, so the beam rides above the height fog |

### Atmospheric perspective (the core look)
- **Fog colour = the horizon/sky colour of the area**, and it is light. The play space stays clear and the distance
  walls off quickly. On flat ground (the user's tuning: density 0.0075, power 1.4) it's ~17% at 40 m, ~58% at 120 m and
  ~91% at 250 m. Height mix 1 thins it for anything tall, so a landmark's upper parts read at ~70–85% fog: a
  silhouette, never a detailed one.
- **Three value planes per shot:**
  - **foreground frame**: darkest, near the camera (walls, trunks, arches)
  - **play space**: mid values, where the toon bands live
  - **distance**: pale, low contrast, silhouettes only
- **Height fog** (denser low, thinner high) makes valleys mysterious and peaks clear. It's a cheap shader tweak, so
  the decision is (Proposed) to add it in the rescale milestone.
- **Sky** is a vertical gradient with painterly, posterised cloud bands generated in code. Never a texture.

### Palettes (Proposed, first pass; screenshots decide)
Each area has 4–5 surface colours, one fog/sky colour and **one accent motif**. Values are first guesses to test
against screenshots, the same way v1's palettes were.

| Area | Surfaces | Fog / sky | Accent motif |
|---|---|---|---|
| **Hub** (The World) | twilight lavender `#8C86A3`, wreath sage `#7E9078`, stone `#C9C2B8`, shadow `#3E3A4D` | pale lilac `#D9D3E0` | warm lantern amber `#F0B266` |
| **Justice** (Swords, air) | chalk `#E4E1D8`, pale steel `#9FB0BC`, slate `#5C6873`, shadow `#2F3640` | cold white-blue `#E3E9EE` | tarnished brass `#B39A5E` (the scales) |
| **The Devil** (Pentacles, earth) | umber `#5A4636`, ochre `#A3824F`, oxide green `#5F7A64`, shadow `#231C18` | smoky amber haze `#B59A7A` | ember `#C0573A` (the pedestal glow) |
| **The Tower** (Wands, fire) | ash `#9A9490`, charcoal `#3B3836`, scorched wood `#6B5244`, shadow `#1E1B1C` | storm grey-violet `#8E8A9C` | fire orange `#E07A3A` |
| **The Moon** (Cups, water) | indigo `#3E4466`, marsh teal `#4F7470`, reed `#8D9A7A`, shadow `#1B1E2E` | moon-fog `#C9CEC8` | pale moonlight `#E9E4C4` |

Rules:
- **Accent colours must stay clear of the signal colours** (below) in hue and saturation. The Tower's fire orange and
  the Devil's ember get the existing `tests/palette.test.ts` contrast checks against telegraph magenta and kill red.
- Accents are used on **one motif** per area (the scales, the pedestal glow, fire, moonlight). Never on general props.

### Characters (Proposed)
- **The Eight of Swords:**
  - **Rust-red robe** `#923A33`: the card's red, desaturated and dark enough (≥ 2:1 contrast) that it never reads
    as kill-red `#FF3B30`. V2-1's palette test darkened it from the first pick, `#9E3B32`.
  - **Off-white blindfold** `#E8E0D0`, pushed up, with **cloth tails** that trail behind her as cheap secondary motion
    (a procedural verlet ribbon).
  - **Dark stick limbs** `#1E1A1C`.

  She is the warmest mid-value shape in any cool scene and the darkest shape in any pale one. That's v1's "one bright
  shape, one dark shape" rule, carried over.
- **Arcana** (bosses and hub NPCs) are **large**: 1.5–4× the player's height. Their silhouettes are built from their
  card's iconography (Justice's sword and scales, the Magician's raised wand, the Star's two jugs). Scale contrast
  is how they read as more than human.
- **Court cards** wear their suit symbol as a large, simple silhouette element (a sword crest, a pentacle shield, a
  wand torch, a cup helm), so the suit reads before the face.
- **Common enemies** are stocky like the player but darker and more hunched. Each archetype has a distinct silhouette
  at 30 m.

### Shading and post
- Toon-ramp Lambert, generated 4-step gradient, vertex colours. No textures, specular, PBR or normal maps.
- **Stripes become facets.** v1's wobbly organic stripes give way to flat-shaded facets and per-face value jitter,
  which reads as blocky rather than soft.
- **Pixel mode** (`tuning.pixel`, `src/render/pixel.ts`) is the Brume look and the only post step. It's on by
  default (P toggles it): `scale` 2, a light outline (`outline` 0.3, `edgeThreshold` 0.3, `edgeWidth` 1 block), from
  the user's tuning.
- **Outlines fade with distance** (`pixel.outlineFadeStart` → `outlineFadeEnd`, 30 → 140 m). Ink lines belong to the
  play space. Outlining fogged hills turned the distance into shards, against the "silhouettes only" value plane.
- **No painterly pass for now (Decided).** v1's Kuwahara/posterise pass didn't suit v2 and was removed. Other post
  techniques get explored later (`PLAN.md → Later`).
- A **rain/hatch overlay** (Grey Scout's diagonal streaks) is a cheap screen-space option for the Moon dimension.

### Reserved signal colours (unchanged from v1, must pop in **every** area palette)
| Signal | Hex | Use |
|---|---|---|
| **Enemy telegraph** | `#FF2E9A` hot magenta, pulsing to white | wind-ups, ground markers, charge lanes, falling-shadow markers |
| **Weak spot** | `#7CFFEA` cyan | weak points |
| **Crit / currency pickup** | `#FFE14D` gold | crit markers, pentacle pickups |
| **Kill / damage taken** | `#FF3B30` red | kill marker, HP bar |
| **SwordRifle charge** (Proposed hue) | `#9C7BFF` electric violet | charge cells on the weapon, the HUD charge pips. The player's own resource, so it must never be confused with an enemy telegraph; the hue sits ~75° from telegraph magenta. |
| **UI / interact** | `#FFFFFF` | UI, muzzle flash, interaction rings |

Never use signal colours on props, characters or accent motifs. `tests/palette.test.ts` checks every area palette
against them, and v2 palettes join that test as they're added.

### Silhouette rules (v2)
1. Every character is identifiable **by silhouette alone at 30 m**, against both a dark frame and pale fog.
2. Characters are **2–4 primitives for the body and stick limbs**. Gear (weapon, shield, suit symbol) makes the
   silhouette.
3. Props are **faceted primitives** (boxes, low-segment cylinders, low-poly lumps) with a darker base where they
   meet the ground.
4. Nothing smaller than ~4 px on screen at play distance unless it's an effect. Pixel mode makes this rule stricter.
5. **Telegraph poses are exaggerated**: wind-up, rear back, weapon raised high, magenta glow.

## Screenshot checklist (each v2 milestone)
- [ ] Three value planes are visible: a dark frame, a mid play space, pale distance.
- [ ] Fog runs toward the area's light sky colour, and the landmark reads as a silhouette.
- [ ] The landmark is visible from the spawn view and from at least one vista.
- [ ] One accent motif per area, and nowhere else.
- [ ] The player reads instantly: the warmest mid-value shape in a cool scene, the darkest shape in a pale one.
- [ ] Signal colours appear only on signals and stand out against every surface and the fog.
- [ ] Shapes are blocky and faceted; nothing reads as cute.
- [ ] The draw-call budget holds (see `LEVELS.md → Budgets`).
