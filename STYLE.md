# STYLE.md: the look of *A bugs death*

Reference: the eight 1920×1080 store screenshots of **White Lavender** (Sokpop Collective, Steam app 1975670),
studied at milestone 0. We take the *spirit* of that look and copy nothing: no shapes, characters or layouts.
Colours below were sampled with a median-cut quantiser and then rounded off by eye.

## What makes the reference look work

1. **Posterised light, not detailed surfaces.** Surfaces carry almost no texture. Light falls in 2–4 flat bands,
   and soft painterly edges (a Kuwahara/oil-paint style filter) blur the boundaries between bands. Shapes read
   entirely through value and silhouette.
2. **Warm pool of light, dark surround.** Each scene is a bright, warm, cream-to-peach clearing ringed by near-black,
   warm-brown darkness. Fog runs *toward dark*, not toward white, so the play space feels like a stage under a lamp.
3. **Stripes everywhere.** Organic things (grass stalks, cave walls, snail shells, mushrooms, the floor) carry
   wobbly parallel bands of two close values. That gives a hand-made, woodcut rhythm without any texture.
4. **Huge, simple props.** Grass blades are tree trunks with a dark root collar. Pebbles are boulders, and a petal
   is a platform. Props are 1–3 primitives with exaggerated taper.
5. **Tiny, high-contrast characters.** The hero is a little bug with **black stick limbs**, a **round head**, two
   antennae, and an **orange/coral-striped torso**. Against the cream floor the black limbs make a crisp, readable
   silhouette at any distance. Enemies are chunky, rounded and striped, coloured in desaturated purples and ochres.
6. **White as the UI and highlight colour.** Lock-on arrows, the interaction ring and rim highlights are pure white,
   and so are the glow sources (mushrooms, lamps). White is reserved, so it pops.
7. **Big contact shadows.** Soft, oversized shadow blobs sit under every prop and character, grounding them on the flat floor.

## Palette (hex)

### Garden Bed (warm clearing, from the grass-forest screenshots)
| Role | Hex | Notes |
|---|---|---|
| Ground, lit | `#F9D199` | warm cream-apricot |
| Ground, light band | `#FEEEC5` | highlight stripe |
| Ground, shade band | `#DBB898` | |
| Ground, shadow | `#B79978` | shadows are warm, never grey |
| Grass stalk | `#B2CB80` | mint-olive, with a `#8FAE63` stripe |
| Grass root collar | `#79595A` | dusty mauve-brown |
| Dark surround / fog | `#3F2C22` | warm umber, fading toward `#120D0C` |
| Pebble | `#79736A` / `#A7A88B` | |
| Fallen leaf | `#E59A52` / `#C46B3A` | orange, striped veins |

### Kitchen Floor (cool interior; our own palette, using the reference's cool scenes as the guide)
| Role | Hex | Notes |
|---|---|---|
| Tile, lit | `#E6DCCB` | warm white tile, kept off pure white (white is reserved) |
| Tile grout | `#6A7F9D` | slate blue |
| Tile shade | `#A9A2A0` | |
| Metal (fork, bottle cap) | `#ACB2A7` / `#868482` | |
| Bottle-cap red | `#C2463F` | |
| Crumb | `#FCD985` / `#B59777` | |
| Dark surround / fog | `#302F38` | cool violet-grey, fading toward `#0A0F17` |

### Characters
| Role | Hex |
|---|---|
| Player limbs, antennae | `#1E1414` (near-black, warm) |
| Player torso stripes | `#FF6A3D` / `#F2994A` (coral / orange) |
| Player head | `#B89A8E` (dusty rose-grey) |
| Enemy shell, generic | `#6E5A7E` / `#8C7A9E` (muted purple) |
| Enemy belly | `#D9B35C` (ochre) |

### Reserved signal colours (must pop in **both** biomes; never use them for props)
| Signal | Hex | Why |
|---|---|---|
| **Enemy telegraph** (wind-up glow, ground markers, charge lane) | `#FF2E9A` hot magenta, pulsing to `#FFFFFF` | Neither biome has saturated magenta. It contrasts with cream (Garden) and slate (Kitchen) alike, and stays clear of the player's orange and the pollen's yellow. |
| **Weak spot** | `#7CFFEA` glowing cyan | Cool and emissive, so it reads against warm floors and purple shells. |
| **Crit / pollen** | `#FFE14D` | Gold, used for crit hit-markers and pollen. |
| **Kill / damage taken** | `#FF3B30` | Red, used for the kill marker and the HP bar. |
| **UI / interact** | `#FFFFFF` | Pure white is kept for UI, muzzle flash and lights. |

The telegraph colour is defined once (`src/render/palette.ts → SIGNAL`), and both biome palettes are checked against it
(luminance and hue distance) in a unit test once biomes exist (milestone 5).

## Lighting

- **One warm directional "sun/lamp"** (`#FFE7C2`, intensity ~2.2), at a low-ish angle (~50° elevation) so shadows are
  long and readable. It is the **only shadow caster**, using PCF soft shadows on a tight frustum that follows the player.
- **Hemisphere fill**: sky `#FFF1D6` / ground `#7A5A4A` in the Garden; sky `#D7E3F4` / ground `#3B3A48` in the Kitchen.
- **Fog**: exponential-squared, tinted to that biome's *dark surround* colour, dense enough that the far clearing
  edge falls into darkness (the "lamp-lit stage" effect).
- **Emissive accents**: weak spots, telegraphs and muzzle flash are unlit (`MeshBasicMaterial`) so fog barely touches them.

## Shading

- **Toon-ramp Lambert**: `MeshToonMaterial` with a generated **4-step gradient map** (no texture files) and
  **vertex colours**. This produces the posterised banding.
- **Stripes are geometry, not textures**: banded vertex colours on cylinders and spheres, alternating two close
  values every N rings with a little seeded wobble.
- **No specular, no PBR, no normal maps.**
- Contact shadows come from the real shadow map. A cheap blob decal under characters may be added later if
  the shadow map is too sharp on low settings.
- Post-processing is optional and deferred to M6: a posterise + soft edge pass if the budget allows. The
  optional low-res nearest-neighbour upscale toggle is **off by default**.

## Silhouette rules

1. **Characters**: round body masses (spheres/capsules) + **thin, dark, segmented limbs**. The joint count must be
   readable: two segments per leg, small joint knobs.
2. Every character has **one bright shape** (player: orange torso; brute: cyan weak spot) and **one dark shape** (limbs).
3. Enemies must be identifiable **by silhouette alone** 30 units away: the Skitterer is low and wide, the Spitter
   tall with a bulbous abdomen, the Brute huge with a domed front.
4. Props are **1–3 primitives**, strongly tapered, with a darker base collar where they meet the ground.
5. Nothing smaller than ~4 px on screen at play distance unless it's an effect.
6. Telegraph poses are exaggerated: rear back, legs splay, and the body glows magenta.

## Scale conceit (player beetle ≈ 1.0 world unit tall)

| Object | World size |
|---|---|
| Grass blade ("tree") | 12–40 tall, 0.8–2 wide |
| Pebble ("boulder") | 1.5–6 |
| Fallen leaf ("platform") | 8–14 long |
| Matchstick ("bridge") | 22 long, 1.2 wide |
| Bottle cap ("arena") | 28 diameter, 3 tall rim |
| Sugar cube ("shrine") | 3 |
| Fork ("ruin") | 90 long |

## Milestone check-list

- [ ] Clearing reads as a warm pool of light with dark falloff
- [ ] Banded toon lighting, no smooth gradients or specular
- [ ] Stripes on organic props
- [ ] Player silhouette: black limbs, orange torso, round head and antennae, readable at range
- [ ] Signal colours used for signals only, and visible in both biomes
- [ ] One shadow-casting light, fog tinted to the biome
