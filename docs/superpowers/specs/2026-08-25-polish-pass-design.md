# Castle Crasher — Polish Pass Design

**Date:** 2026-08-25
**Mood target:** fun and relaxing. Visuals soft and unhurried (slow clouds, warm dust,
gentle chimes), not arcade-frantic.

## Scope

Clouds, projectile trail + landing dust, crate splinters, screen shake, slow-mo final
crate, blast VFX upgrade, toast/banner system rework, floating power-up labels,
synthesized WebAudio SFX, background music from a drop-in directory, and two new
power-ups (multi-shot, bouncy-shot).

**Not changing:** level layouts, shot counts, aiming/charging mechanics, physics tuning,
crate hit detection, state machine structure (only additions inside states).

## 1. New module: `src/effects.ts` (VFX)

One `Effects` class owning all transient visuals, updated once per frame from the main
loop (`effects.update(dt)`), with the scene and camera passed at construction.

- **Clouds** — 6–8 flat soft-edged sprite planes using a canvas-generated
  radial-gradient texture (no image assets), at y ≈ 35–60, spread across x/z depths for
  parallax. Each drifts +x at its own slow speed and wraps around when out of view.
  Always active. Slightly transparent so they blend with the photo background.
- **Flight trail** — small fading smoke puffs spawned every ~40 ms at the projectile's
  position while it moves fast (speed > ~5). Each puff grows and fades out over ~0.8 s.
- **Landing dust** — on the projectile's first contact with the ground body (cannon
  `collide` event filtered to ground), a ring of 8–12 dust sprites bursting outward plus
  a flattened decal ring that fades over ~2 s.
- **Crate splinters** — on hard crate collisions (impact speed threshold), spawn a few
  small brown box shards. Pure visual — simple ballistic math (gravity + velocity), no
  physics bodies. Fall and fade in ~1 s.
- **Blast VFX upgrade** — replaces the wireframe sphere in `projectile.ts`: white flash
  sprite (~2 frames), expanding ground shockwave ring, 6–10 smoke puffs, large screen
  shake. The existing impulse logic is untouched; `ProjectileManager` delegates visuals
  to `Effects`.

## 2. Screen shake + slow-mo

- **Shake:** `effects.shake(strength)` adds a decaying random offset to the camera each
  frame; the base camera position is never mutated (offset applied and removed around
  render, or tracked as base + offset). Triggers: projectile landing (small, scaled by
  impact speed), blast (large), crate knocked down (tiny).
- **Slow-mo:** when the last standing crate tips during `resolving`, set
  `timeScale = 0.3` for 1.2 s of real time, then ease back to 1. Applied as
  `physics.step(dt * timeScale)` and to trebuchet/effects/projectile updates. The HUD
  resolve countdown keeps real time. Detection: `countStanding() === 0` first observed
  during `resolving` while previous frame had > 0.

## 3. Toast + banner rework (`hud.ts`, `style.css`, `index.html`)

Replace the single `#toast` div with a stacked toast container and a center banner.

- **`hud.toast(text, {type, duration})`** — types: `info` (white edge), `success`
  (green), `reward` (gold, ✨ icon), `warn` (red). Toasts stack top-right, slide in,
  auto-dismiss with a slide-out animation. Max ~4 visible; older ones dismiss early.
- **Toast timer bar** — thin draining bar along each toast's bottom edge showing
  time-to-dismiss.
- **Resolve countdown** — the "Shot ends in 4.2s" text becomes a slim draining bar
  under the stats row (no numeric text).
- **Center banner** — `hud.banner(title, subtitle)` — big serif stamp, scale-bounce in,
  used for "LEVEL CLEARED!", "OUT OF SHOTS", "CASTLE CONQUERED!". The "press ENTER"
  hint lives in the subtitle. Hidden on continue.
- **Shot summary** — "Crates hit: N" toast where N visually counts up (0→N with a small
  pop per tick).
- **Color-key tutorial line** ("Red = knocked down…") shows once as an `info` toast on
  level 1's first shot only, not every shot.

## 4. Floating power-up labels

When `finishShot()` reports consumed gold crates, project each crate's 3D position to
screen space and spawn a DOM label ("+1 SHOT!", "BLAST!", "HEAVY!", "MULTI!",
"BOUNCY!") that floats up and fades over ~1.5 s. Gold styling for all types. Requires
`finishShot()` to also return positions of consumed special crates.

## 5. Sound: new module `src/sfx.ts` (WebAudio, all synthesized)

Singleton; `AudioContext` created/resumed on first user input (autoplay policy). One
master `GainNode` with a volume constant in code. No audio assets, no volume UI.

- `launch` — low creak (sawtooth pitch-drop) + whoosh (filtered noise sweep)
- `impact(intensity)` — wood crash (noise burst through bandpass, randomized pitch),
  volume scaled by impact speed
- `blast` — boom (sine pitch-drop + noise, lowpass sweep)
- `reward` — short ascending arpeggio chime
- `fanfare` — 4-note victory phrase; `defeat` — 2-note descending phrase
- `charge(level)` — soft rising tone while holding space; pitch tracks charge level;
  stops on release

Tone character: gentle/warm (relaxing), not harsh.

## 6. Background music (`src/music.ts`)

- `import.meta.glob('./music/*.{mp3,ogg,wav,m4a}', { eager: true, query: '?url' })` —
  same pattern as backgrounds in `scene.ts`.
- Pick one file at random on load, play looped via an `<audio>` element at modest
  volume (~0.35), starting on first user interaction.
- Empty `src/music/` directory → no music, no errors. Directory is created (with
  `.gitkeep`) so the user can drop files in.

## 7. New power-ups (`powerups.ts`, `projectile.ts`)

- **`multi-shot`** — next shot launches 3 smaller balls (radius 0.35, mass 2.5 each) in
  a horizontal spread of ±4°. `ProjectileManager` generalizes from a single body to a
  list; `speed` getter becomes the max over live bodies; `clear()` clears all.
- **`bouncy-shot`** — next shot's projectile gets high restitution (cannon contact
  material, bounciness ~0.7) so it careens through the field. Cyan ball tint.
- "Precision" was considered and dropped — the aim marker already shows the exact
  landing point.
- Modifiers stack freely (e.g. blast + multi = 3 exploding balls).
- `ShotModifiers` gains `multi?: boolean` and `bouncy?: boolean`; labels added to
  `POWER_UP_LABELS`; both added to the `POWER_UPS` roll table.

## Integration points

- `main.ts` creates `Effects` and wires: shake/slow-mo triggers, sfx calls at state
  transitions, toast/banner calls in `showShotFeedback()`.
- `projectile.ts` exposes collision events (ground hit, crate hit with impact speed) via
  callbacks so `Effects` and `sfx` stay decoupled from physics internals.
- `crates.ts`: `finishShot()` additionally returns consumed-crate world positions;
  crate-topple detection for the tiny shake + splinters hooks off collision events.
