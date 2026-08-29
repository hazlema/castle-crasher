# Kingdom Crumble — Design

**Date:** 2026-08-29
**Status:** Approved design, pre-implementation
**Predecessor:** the three.js/cannon-es web game in this repo (frozen as v1 — "good enough," no further feature work)

## Concept

**Kingdom Crumble** — a 2D indie artillery/destruction game in the Angry
Birds lineage: launch stones from a trebuchet, topple crate structures,
charm the player. Target the orphaned Angry Birds audience with better
music, richer personality, and physics rewards no one else offers.

Name notes: "Castle Crasher" was rejected (collides with The Behemoth's
*Castle Crashers*). Nearest neighbor to the chosen name is *Thy Kingdom
Crumble* (small 2019 Steam platformer) — different genre and low
profile, judged acceptable; run a trademark search before any real
store launch.

**Pillars: super fun, pretty (animation eye-candy / design), challenging.**

## Engine & Platforms

- **Godot 4**, 2D. Chosen over Odin/raylib because the owner's time
  should go to art, music, and level design — not engine plumbing.
  Godot supplies Skeleton2D cutout animation, audio buses, particles,
  UI, tweens, and web export.
- Physics: Godot built-in 2D physics first; if crate stacking feels
  mushy, switch to the Rapier physics plugin (known community fix).
- Exports: **HTML5 (Netlify, keeps the current distribution + mobile
  reach)** and native desktop.

## The Hook Stack (what makes it "not a normal game")

### 1. Music is difficulty
The main menu offers three vibes instead of easy/medium/hard:

| Menu choice | Music pool | Difficulty preset |
|---|---|---|
| Chill | `music/chill/` | generous shots, simple structures, nothing moves |
| Heart-Pumper | `music/heartpumper/` | tighter shots, taller structures |
| Hardcore | `music/hardcore/` | minimal shots, complex structures |

Depth level: **vibe + preset** (music selects playlist and difficulty
knobs; gameplay itself is not beat-synced — explicitly decided against
music-reactive and rhythm-hybrid variants).

### 2. Lean bonus
When a shot leaves a crate *leaning* against another (tilted roughly
15°–75° off vertical and in contact with another crate after physics
settles), a powerup pops out. Each formed lean pays **once** — track
paid-out crate pairs. Rewards near-misses and emergent physics instead
of punishing them.

### 3. Roaming bonus critter
One wandering critter per level (skunk, chicken — one species per level,
more later). Optional target, never required to clear the level. Hitting
it grants a bonus powerup plus a signature eye-candy burst (feathers /
stink cloud). Simple path-walk AI with a 2-frame waddle.

### 4. Living world
Painted panorama backgrounds (reuse the v1 21:9 art pipeline) sliced
into parallax layers, animated procedurally: drifting clouds as sprites,
flickering windows via shader or two-still crossfade (frame-exact — the
control the v1 video backgrounds never had), ambient birds. No video
files, no sprite-sheet megaframes.

## Presentation

- Flat-stylized 2D art language (the "indie" mockup direction).
- Main character: cartoon soldier kid (already comped, exploded into
  parts) rigged with **Skeleton2D** — fire cycle, idle bounce,
  celebrate. Owner wants the rigging learning experience.
- Juice budget: screen shake, crate splinters, dust puffs, feather
  bursts, slow-mo on the final crate of a level.

## Camera System (one Camera2D, three modes)

1. **Aim view** — anchored framing the trebuchet and near field.
2. **Follow-cam** — auto-engages at launch, chases the projectile with
   zoom; returns to aim view after impact resolves.
3. **Free scout** — drag / arrow-pan / touch-drag anywhere between
   shots to survey off-screen targets; snaps back to aim view when the
   player touches aim controls. Levels are designed wider than one
   screen, so this is required, not optional.

## Core Loop

Aim (angle + power) → fire → follow-cam flight → destruction resolves →
lean check → powerup awards → next shot. Clear the required structures
to advance. Powerups persist to the next shot (v1's `nextShot` modifier
pattern carries over conceptually).

## Scope Guardrail

**First playable:** one level, one music tier (chill), one critter, the
kid + trebuchet rigged and firing, flat-color placeholder art, all three
camera modes. Prove fun/pretty/challenging on one screen before
building content breadth.

**Explicitly v2 (wanted, not now):** wind, multiple ammo types, the
rich HUD from the 2.5D mockup (round counter, opponent panels), PvP,
additional critter species, level editor.

## Asset Pipeline Notes

- Stills: owner generates on OpenAI directly (conserves OpenArt
  credits); OpenArt (cheap models ~8 credits) for quick mockups.
- Panoramas: 21:9; parallax slicing replaces the v1 horizon-pinning
  system, so the 45%-horizon rule no longer constrains composition.
- Character sheets: generate assembled + exploded-parts views on
  transparent backgrounds for Skeleton2D cutting.
