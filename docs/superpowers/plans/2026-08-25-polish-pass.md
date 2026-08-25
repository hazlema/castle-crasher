# Castle Crasher Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add VFX (clouds, trails, dust, splinters, blast), screen shake, slow-mo, a typed toast/banner HUD, floating power-up labels, synthesized WebAudio SFX, drop-in background music, and two new power-ups to the existing trebuchet game.

**Architecture:** Three new modules — `sfx.ts` (WebAudio synthesis), `music.ts` (background track), `effects.ts` (all transient visuals + camera shake) — plus reworks of `hud.ts` (toast queue + banner) and `projectile.ts` (multi-body + collision callbacks). `main.ts` wires everything at state transitions. Spec: `docs/superpowers/specs/2026-08-25-polish-pass-design.md`.

**Tech Stack:** TypeScript, three.js 0.166, cannon-es 0.20, Vite 5. No test framework exists and deliverables are audio/visual: each task verifies with `npm run build` (runs `tsc --noEmit`) + a concrete manual check in `npm run dev`, in lieu of unit tests.

## Global Constraints

- Mood: fun and relaxing — slow drifts, warm colors, gentle tones; nothing frantic or harsh.
- No new dependencies; no binary assets (cloud/particle textures are canvas-generated; all SFX synthesized).
- Do not change: level layouts, shot counts, aim/charge mechanics, physics tuning, crate hit detection, the state machine's states.
- Music dir `src/music/` may be empty → no music, no errors, no console spam.
- Existing code style: no semicolons, single quotes, 2-space indent, ~80 col.
- Commit after every task.

---

### Task 1: WebAudio SFX module

**Files:**
- Create: `src/sfx.ts`
- Modify: `src/main.ts` (add sfx calls at state transitions)

**Interfaces:**
- Produces: `sfx.launch()`, `sfx.impact(intensity: number)`, `sfx.blast()`, `sfx.reward()`, `sfx.fanfare()`, `sfx.defeat()`, `sfx.charge(level: number)`, `sfx.chargeEnd()` — all safe to call before audio unlock (no-ops until first keydown creates the AudioContext).

- [ ] **Step 1: Write `src/sfx.ts`**

```ts
// All game audio is synthesized — no asset files. The AudioContext is
// created on the first keydown to satisfy browser autoplay policy.
const MASTER_VOLUME = 0.5

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null

addEventListener('keydown', () => {
  if (ctx) return
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = MASTER_VOLUME
  master.connect(ctx.destination)
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
})

interface ToneOpts {
  type?: OscillatorType
  freq: number
  freqEnd?: number
  gain?: number
  duration: number
  delay?: number
}

function tone({ type = 'sine', freq, freqEnd, gain = 0.3, duration,
  delay = 0 }: ToneOpts) {
  if (!ctx || !master) return
  const t0 = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd),
      t0 + duration)
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + duration)
}

interface NoiseOpts {
  filter: BiquadFilterType
  freq: number
  freqEnd?: number
  q?: number
  gain?: number
  duration: number
}

function noiseBurst({ filter, freq, freqEnd, q = 1, gain = 0.3,
  duration }: NoiseOpts) {
  if (!ctx || !master || !noise) return
  const t0 = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t0)
  if (freqEnd !== undefined) {
    f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd),
      t0 + duration)
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  src.connect(f).connect(g).connect(master)
  src.start(t0)
  src.stop(t0 + duration)
}

let chargeOsc: OscillatorNode | null = null
let chargeGain: GainNode | null = null

export const sfx = {
  launch() {
    tone({ type: 'sawtooth', freq: 90, freqEnd: 40, gain: 0.25,
      duration: 0.25 })
    noiseBurst({ filter: 'bandpass', freq: 400, freqEnd: 2000, q: 2,
      gain: 0.2, duration: 0.4 })
  },
  impact(intensity: number) {
    const v = Math.min(1, intensity)
    if (v < 0.05) return
    noiseBurst({ filter: 'bandpass', freq: 150 + Math.random() * 250,
      q: 1.5, gain: 0.45 * v, duration: 0.15 })
  },
  blast() {
    tone({ freq: 120, freqEnd: 30, gain: 0.5, duration: 0.5 })
    noiseBurst({ filter: 'lowpass', freq: 1000, freqEnd: 100, gain: 0.4,
      duration: 0.6 })
  },
  reward() {
    for (const [i, f] of [523, 659, 784].entries()) {
      tone({ type: 'triangle', freq: f, gain: 0.2, duration: 0.25,
        delay: i * 0.12 })
    }
  },
  fanfare() {
    for (const [i, f] of [392, 523, 659, 784].entries()) {
      tone({ type: 'triangle', freq: f, gain: 0.25,
        duration: i === 3 ? 0.7 : 0.22, delay: i * 0.16 })
    }
  },
  defeat() {
    tone({ type: 'triangle', freq: 330, gain: 0.2, duration: 0.35 })
    tone({ type: 'triangle', freq: 262, gain: 0.2, duration: 0.6,
      delay: 0.3 })
  },
  // Called every frame while charging; creates the osc lazily.
  charge(level: number) {
    if (!ctx || !master) return
    if (!chargeOsc) {
      chargeOsc = ctx.createOscillator()
      chargeOsc.type = 'sine'
      chargeGain = ctx.createGain()
      chargeGain.gain.value = 0.08
      chargeOsc.connect(chargeGain).connect(master)
      chargeOsc.start()
    }
    chargeOsc.frequency.value = 180 + level * 400
  },
  chargeEnd() {
    chargeOsc?.stop()
    chargeOsc?.disconnect()
    chargeGain?.disconnect()
    chargeOsc = null
    chargeGain = null
  },
}
```

- [ ] **Step 2: Wire into `src/main.ts`**

Add to imports:

```ts
import { sfx } from './sfx'
```

In the `'charging'` case, add `sfx.charge(charge)` right after the `charge = Math.min(...)` line, and inside the `wasReleased('Space')` block add `sfx.chargeEnd()` and `sfx.launch()` immediately before `crateField.beginShot()`:

```ts
    case 'charging':
      charge = Math.min(1, charge + dt / CHARGE_TIME)
      sfx.charge(charge)
      if (input.wasReleased('Space')) {
        sfx.chargeEnd()
        sfx.launch()
        crateField.beginShot()
```

In `applyPowerUps`, play a chime when anything was gained — add as the first line:

```ts
  if (powerUps.length > 0) sfx.reward()
```

In `showShotFeedback`, add sound to the outcomes: `sfx.fanfare()` right after each of the two lines that set `outcomeText` to a victory ('You conquered the castle!' and 'Level cleared!'), and `sfx.defeat()` after `outcomeText = 'Out of shots — retry!'`.

(`sfx.impact()` and `sfx.blast()` are wired in Tasks 5–6 where collision callbacks appear.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exits 0, no type errors.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open the page. Hold SPACE → soft rising tone; release → creak + whoosh; clear a level → fanfare; hit a gold crate → chime. No console errors before first keypress.

- [ ] **Step 5: Commit**

```bash
git add src/sfx.ts src/main.ts
git commit -m "feat: synthesized WebAudio sound effects"
```

---

### Task 2: Background music

**Files:**
- Create: `src/music.ts`
- Modify: `src/main.ts` (one import + one call)

**Interfaces:**
- Produces: `startMusic()` — registers a one-time first-keydown listener; picks a random file from `src/music/`; silent no-op when the directory is empty.

- [ ] **Step 1: Write `src/music.ts`**

```ts
// Background music: drop .mp3/.ogg/.wav/.m4a files into src/music/ and one
// is picked at random. Empty directory → no music. Same glob pattern as
// the backgrounds in scene.ts.
const files = Object.values(import.meta.glob(
  './music/*.{mp3,ogg,wav,m4a}',
  { eager: true, query: '?url', import: 'default' },
)) as string[]

const MUSIC_VOLUME = 0.35

export function startMusic() {
  if (files.length === 0) return
  addEventListener('keydown', () => {
    const audio = new Audio(files[Math.floor(Math.random() * files.length)])
    audio.loop = true
    audio.volume = MUSIC_VOLUME
    audio.play().catch(() => {}) // ignore autoplay rejection
  }, { once: true })
}
```

- [ ] **Step 2: Wire into `src/main.ts`**

Add import `import { startMusic } from './music'` and call `startMusic()` on the line after `loadLevel(0)`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exits 0. (Vite handles a glob with zero matches fine.)

- [ ] **Step 4: Manual check**

Run: `npm run dev` with `src/music/` empty → no errors, no music. Copy any mp3 into `src/music/`, reload, press a key → music plays looped at modest volume. Remove it again if it was just a test file.

- [ ] **Step 5: Commit**

```bash
git add src/music.ts src/main.ts
git commit -m "feat: random looping background music from src/music/"
```

---

### Task 3: Toast queue, center banner, resolve bar

**Files:**
- Modify: `index.html`, `src/style.css`, `src/hud.ts`, `src/main.ts`

**Interfaces:**
- Produces:
  - `hud.toast(text: string, opts?: { type?: 'info'|'success'|'reward'|'warn', duration?: number, countTo?: number })` — stacked top-right toasts with a draining timer bar; `countTo` animates the first `%d` in `text` from 0 upward.
  - `hud.clearToasts()`, `hud.banner(title: string, subtitle?: string)`, `hud.hideBanner()`, `hud.setResolve(fraction: number | null)` (draining bar; null hides).
  - Removed: `hud.showToast`, `hud.hideToast`, `hud.setTimer`.
  - `hud.floatLabel(text: string, x: number, y: number)` — gold label at screen px coords floating up and fading (consumed by Task 7).

- [ ] **Step 1: Update `index.html`**

Replace the lines `<div id="toast"></div>` and the `#timer` span with the new structure. Full new `#hud` block:

```html
  <div id="hud">
    <div id="stats">
      <span id="level"></span>
      <span id="shots"></span>
      <span id="crates"></span>
      <span id="powerups"></span>
    </div>
    <div id="resolve-wrap"><div id="resolve-bar"></div></div>
    <div id="power-wrap"><div id="power-bar"></div></div>
    <div id="toasts"></div>
    <div id="banner">
      <div id="banner-title"></div>
      <div id="banner-sub"></div>
    </div>
    <div id="help">←/→ aim &nbsp;·&nbsp; hold SPACE to move the yellow landing marker &nbsp;·&nbsp; release to fire &nbsp;·&nbsp; gold crates contain power-ups</div>
  </div>
```

- [ ] **Step 2: Update `src/style.css`**

Delete the `#toast` rule and the `toast-in` keyframes; append:

```css
#resolve-wrap { position: absolute; top: 52px; left: 16px; width: 220px;
  height: 6px; border-radius: 3px; background: rgba(0,0,0,.35);
  overflow: hidden; display: none; }
#resolve-bar { height: 100%; width: 100%; background: #ffd54a; }
#toasts { position: absolute; top: 24px; right: 24px;
  width: min(360px, calc(100% - 48px)); display: flex;
  flex-direction: column; gap: 10px; }
.toast { position: relative; padding: 12px 16px 14px;
  font: 16px/1.4 system-ui, sans-serif; color: #fff;
  background: rgba(12, 12, 12, .82);
  border: 1px solid rgba(255, 255, 255, .28); border-left-width: 4px;
  border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, .4);
  overflow: hidden; animation: toast-in .25s ease-out; }
.toast.out { animation: toast-out .3s ease-in forwards; }
.toast-info    { border-left-color: #e8e8e8; }
.toast-success { border-left-color: #43d85b; }
.toast-reward  { border-left-color: #ffd54a; }
.toast-warn    { border-left-color: #e53935; }
.toast .bar { position: absolute; left: 0; bottom: 0; height: 3px;
  background: rgba(255, 255, 255, .45); width: 100%;
  animation: toast-drain linear forwards; }
.toast .num { display: inline-block; }
.toast .num.pop { animation: num-pop .18s ease-out; }
@keyframes toast-in {
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: translateX(0); } }
@keyframes toast-out {
  to { opacity: 0; transform: translateX(24px); } }
@keyframes toast-drain { to { width: 0%; } }
@keyframes num-pop {
  50% { transform: scale(1.5); } }
#banner { position: absolute; top: 34%; width: 100%; text-align: center;
  display: none; }
#banner.show { display: block; animation: banner-in .45s
  cubic-bezier(.2, 1.6, .4, 1); }
#banner-title { font: bold 56px Georgia, serif; letter-spacing: 2px;
  text-shadow: 0 2px 8px rgba(0,0,0,.85); }
#banner-sub { font: 22px Georgia, serif; margin-top: 8px; opacity: .9; }
@keyframes banner-in {
  from { opacity: 0; transform: scale(.4); }
  to { opacity: 1; transform: scale(1); } }
.float-label { position: absolute; transform: translate(-50%, -50%);
  font: bold 22px Georgia, serif; color: #ffd54a;
  text-shadow: 0 2px 6px rgba(0,0,0,.9); white-space: nowrap;
  animation: float-up 1.5s ease-out forwards; }
@keyframes float-up {
  to { opacity: 0; transform: translate(-50%, -140px); } }
```

- [ ] **Step 3: Rewrite `src/hud.ts`**

```ts
const el = (id: string) => document.getElementById(id) as HTMLElement

export type ToastType = 'info' | 'success' | 'reward' | 'warn'

export interface ToastOpts {
  type?: ToastType
  duration?: number // seconds until auto-dismiss
  countTo?: number  // animates the first %d in text from 0 to this
}

const MAX_TOASTS = 4

function dismiss(t: HTMLElement) {
  if (t.classList.contains('out')) return
  t.classList.add('out')
  t.addEventListener('animationend', () => t.remove(), { once: true })
}

export const hud = {
  setLevel(n: number) {
    el('level').textContent = `Level ${n}`
  },
  setShots(n: number) {
    el('shots').textContent = `Shots: ${n}`
  },
  setCrates(standing: number, total: number) {
    el('crates').textContent = `Crates: ${standing}/${total}`
  },
  setPower(p: number) {
    el('power-bar').style.width = `${p * 100}%`
  },
  setPowerUps(text: string) {
    el('powerups').textContent = text
  },
  setResolve(fraction: number | null) {
    const wrap = el('resolve-wrap')
    wrap.style.display = fraction === null ? 'none' : 'block'
    if (fraction !== null) {
      el('resolve-bar').style.width = `${fraction * 100}%`
    }
  },
  toast(text: string, { type = 'info', duration = 4, countTo }:
    ToastOpts = {}) {
    const box = el('toasts')
    while (box.children.length >= MAX_TOASTS) {
      dismiss(box.children[0] as HTMLElement)
      box.children[0].remove()
    }
    const t = document.createElement('div')
    t.className = `toast toast-${type}`
    if (countTo !== undefined && text.includes('%d')) {
      const [before, after] = text.split('%d')
      const num = document.createElement('span')
      num.className = 'num'
      num.textContent = '0'
      t.append(before, num, after)
      let n = 0
      const tick = setInterval(() => {
        n += 1
        if (n >= countTo) clearInterval(tick)
        num.textContent = `${Math.min(n, countTo)}`
        num.classList.remove('pop')
        void num.offsetWidth // restart the pop animation
        num.classList.add('pop')
      }, 90)
    } else {
      t.textContent = text
    }
    const bar = document.createElement('div')
    bar.className = 'bar'
    bar.style.animationDuration = `${duration}s`
    t.append(bar)
    box.append(t)
    setTimeout(() => dismiss(t), duration * 1000)
  },
  clearToasts() {
    for (const t of [...el('toasts').children]) dismiss(t as HTMLElement)
  },
  banner(title: string, subtitle = '') {
    el('banner-title').textContent = title
    el('banner-sub').textContent = subtitle
    el('banner').className = 'show'
  },
  hideBanner() {
    el('banner').className = ''
  },
  floatLabel(text: string, x: number, y: number) {
    const label = document.createElement('div')
    label.className = 'float-label'
    label.textContent = text
    label.style.left = `${x}px`
    label.style.top = `${y}px`
    el('hud').append(label)
    label.addEventListener('animationend', () => label.remove(),
      { once: true })
  },
}
```

- [ ] **Step 4: Update `src/main.ts` call sites**

Add a module-level flag near the other state vars:

```ts
let tutorialShown = false
```

In `loadLevel`, replace `hud.hideToast()` and `hud.setTimer(null)` with:

```ts
  hud.clearToasts()
  hud.hideBanner()
  hud.setResolve(null)
```

In `finishShotResolution`, replace `hud.hideToast()` with `hud.clearToasts()`.

In the `'resolving'` case, replace `hud.setTimer(Math.max(0, MAX_RESOLVE - resolveTimer))` with:

```ts
      hud.setResolve(Math.max(0, 1 - resolveTimer / MAX_RESOLVE))
```

Replace the body of `showShotFeedback` after the `applyPowerUps(result.powerUps)` / `crateField.showHitFeedback()` lines (everything from `const crateText` down to `hud.showToast(lines.join('\n'))`) with:

```ts
  hud.setResolve(null)
  hud.toast(`Crates hit: %d`, { type: result.hitCount > 0 ? 'success'
    : 'info', countTo: result.hitCount })
  if (!tutorialShown) {
    tutorialShown = true
    hud.toast('Red = knocked down  •  Green = still standing',
      { type: 'info', duration: 6 })
  }
  if (result.powerUps.length > 0) {
    hud.toast(`Power-up: ${result.powerUps
      .map((p) => POWER_UP_LABELS[p]).join(' + ')}`, { type: 'reward' })
  }

  const standing = crateField.countStanding()
  if (standing === 0) {
    if (levelIndex + 1 >= LEVELS.length) {
      hud.banner('CASTLE CONQUERED!', 'press ENTER to play again')
      onContinue = () => loadLevel(0)
    } else {
      hud.banner('LEVEL CLEARED!', 'press ENTER for the next level')
      onContinue = () => loadLevel(levelIndex + 1)
    }
    state = 'transition'
  } else if (shotsLeft === 0) {
    hud.banner('OUT OF SHOTS', 'press ENTER to retry')
    onContinue = () => loadLevel(levelIndex)
    state = 'transition'
  } else {
    feedbackTimer = 0
    state = 'feedback'
  }
```

The `sfx.fanfare()` / `sfx.defeat()` calls from Task 1 move accordingly: `sfx.fanfare()` right after each `hud.banner('CASTLE CONQUERED!'...)` and `hud.banner('LEVEL CLEARED!'...)` line, `sfx.defeat()` after the `hud.banner('OUT OF SHOTS'...)` line. In the `'transition'` case, add `hud.hideBanner()` before `onContinue?.()`.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: exits 0 — confirms no leftover references to `showToast`/`hideToast`/`setTimer`.

- [ ] **Step 6: Manual check**

Run: `npm run dev`. Fire a shot: hit-count toast slides in, number ticks up with pops, timer bar drains, toast slides out. Color-key toast appears only on the first shot. Resolve countdown is a slim yellow bar under the stats, gone during feedback. Clear a level → big bouncing "LEVEL CLEARED!" banner; ENTER hides it and advances.

- [ ] **Step 7: Commit**

```bash
git add index.html src/style.css src/hud.ts src/main.ts
git commit -m "feat: toast queue, center banner, resolve bar HUD"
```

---

### Task 4: Effects module — clouds + camera shake

**Files:**
- Create: `src/effects.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `class Effects { constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera); update(dt: number): void; shake(strength: number): void }` — `update` must run every frame before `renderer.render`. Task 5 extends this class with `puff/landingDust/splinters`, Task 6 with `blastFx`.
- Consumes: nothing new.

- [ ] **Step 1: Write `src/effects.ts`**

```ts
import * as THREE from 'three'

const CLOUD_COUNT = 7
const CLOUD_WRAP_X = 130

// Soft radial-gradient blob drawn once and shared by all sprites.
function makeSoftTexture(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  const grad = g.createRadialGradient(
    size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.55, 'rgba(255,255,255,.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface Cloud {
  group: THREE.Group
  speed: number
}

export class Effects {
  private softTex = makeSoftTexture()
  private clouds: Cloud[] = []
  private trauma = 0
  private cameraBase: THREE.Vector3

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    this.cameraBase = camera.position.clone()
    for (let i = 0; i < CLOUD_COUNT; i++) this.spawnCloud(i)
  }

  // A cloud is 3-5 overlapping soft sprites in a loose row.
  private spawnCloud(i: number) {
    const group = new THREE.Group()
    const puffs = 3 + Math.floor(Math.random() * 3)
    for (let p = 0; p < puffs; p++) {
      const mat = new THREE.SpriteMaterial({
        map: this.softTex,
        color: 0xfff6e8,
        transparent: true,
        opacity: 0.5 + Math.random() * 0.2,
        depthWrite: false,
      })
      const sprite = new THREE.Sprite(mat)
      const s = 9 + Math.random() * 8
      sprite.scale.set(s, s * 0.55, 1)
      sprite.position.set(
        (p - puffs / 2) * 5 + Math.random() * 2,
        Math.random() * 2.5,
        Math.random() * 2,
      )
      group.add(sprite)
    }
    // Spread initial x across the whole band so the sky starts populated
    group.position.set(
      -CLOUD_WRAP_X + (i + Math.random()) * (2 * CLOUD_WRAP_X / CLOUD_COUNT),
      36 + Math.random() * 24,
      -110 + Math.random() * 85,
    )
    this.scene.add(group)
    this.clouds.push({ group, speed: 0.4 + Math.random() * 0.7 })
  }

  shake(strength: number) {
    this.trauma = Math.min(1.5, this.trauma + strength)
  }

  update(dt: number) {
    for (const cloud of this.clouds) {
      cloud.group.position.x += cloud.speed * dt
      if (cloud.group.position.x > CLOUD_WRAP_X) {
        cloud.group.position.x = -CLOUD_WRAP_X
      }
    }

    this.trauma = Math.max(0, this.trauma - dt * 2.2)
    const amplitude = this.trauma * this.trauma * 0.45
    this.camera.position.set(
      this.cameraBase.x + (Math.random() - 0.5) * amplitude,
      this.cameraBase.y + (Math.random() - 0.5) * amplitude,
      this.cameraBase.z + (Math.random() - 0.5) * amplitude,
    )
  }
}
```

- [ ] **Step 2: Wire into `src/main.ts`**

Add import `import { Effects } from './effects'`. After the `const crateField = ...` line add:

```ts
const effects = new Effects(scene, camera)
```

In the animation loop, add `effects.update(dt)` on the line after `projectiles.update(dt)`. Temporary shake trigger for verification: none needed — Task 5 adds real triggers; to eyeball it now you may call `effects.shake(0.6)` from the fire branch and remove it before committing, or just verify clouds only.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Manual check**

Run: `npm run dev`. Soft cream-colored clouds drift slowly left-to-right at several depths, wrapping around. Frame rate unaffected. Camera sits exactly where it used to (no drift when trauma is 0 — note the base position is fixed, which is correct since nothing else moves the camera).

- [ ] **Step 5: Commit**

```bash
git add src/effects.ts src/main.ts
git commit -m "feat: drifting clouds and camera shake in new effects module"
```

---

### Task 5: Particles — flight trail, landing dust, splinters + collision wiring

**Files:**
- Modify: `src/effects.ts`, `src/physics.ts`, `src/projectile.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `Effects` from Task 4.
- Produces:
  - `Effects.puff(pos: THREE.Vector3, opts?: {color?: number, size?: number, vel?: THREE.Vector3, life?: number})`, `Effects.landingDust(pos: THREE.Vector3)`, `Effects.splinters(pos: THREE.Vector3, count?: number)`, `Effects.trail(pos: THREE.Vector3, dt: number, speed: number)`.
  - `PhysicsCtx.ground: CANNON.Body` (the static ground body, for collision filtering).
  - `ProjectileManager.onImpact: ((pos: THREE.Vector3, speed: number, isGround: boolean) => void) | null` — fires on every projectile collision (all shots, not just blast).

- [ ] **Step 1: Expose the ground body in `src/physics.ts`**

Add `ground: CANNON.Body` to the `PhysicsCtx` interface, and `ground,` to the returned object (the `ground` body local already exists in `createPhysics`).

- [ ] **Step 2: Add particle system to `src/effects.ts`**

Add to the imports nothing new. Add inside the file:

```ts
interface Particle {
  sprite: THREE.Sprite
  vel: THREE.Vector3
  age: number
  life: number
  grow: number
  baseOpacity: number
}

interface Shard {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  spin: THREE.Vector3
  age: number
  life: number
}
```

Add fields to `Effects`:

```ts
  private particles: Particle[] = []
  private shards: Shard[] = []
  private shardMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a6a42, transparent: true })
  private shardGeometry = new THREE.BoxGeometry(0.22, 0.1, 0.34)
  private trailTimer = 0
```

Add methods to `Effects`:

```ts
  puff(pos: THREE.Vector3, { color = 0xcbb794, size = 1,
    vel = new THREE.Vector3(), life = 0.8 }: { color?: number,
    size?: number, vel?: THREE.Vector3, life?: number } = {}) {
    const mat = new THREE.SpriteMaterial({
      map: this.softTex, color, transparent: true, opacity: 0.55,
      depthWrite: false,
    })
    const sprite = new THREE.Sprite(mat)
    sprite.scale.setScalar(size)
    sprite.position.copy(pos)
    this.scene.add(sprite)
    this.particles.push({ sprite, vel: vel.clone(), age: 0, life,
      grow: size * 1.6, baseOpacity: 0.55 })
  }

  // Call every frame with the projectile position; emits ~every 40ms.
  trail(pos: THREE.Vector3, dt: number, speed: number) {
    if (speed < 5) return
    this.trailTimer += dt
    if (this.trailTimer < 0.04) return
    this.trailTimer = 0
    this.puff(pos, { color: 0xdedede, size: 0.7, life: 0.8 })
  }

  landingDust(pos: THREE.Vector3) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      this.puff(new THREE.Vector3(pos.x, 0.3, pos.z), {
        size: 1.1,
        life: 1.4,
        vel: new THREE.Vector3(Math.cos(a) * 3, 1.2, Math.sin(a) * 3),
      })
    }
  }

  splinters(pos: THREE.Vector3, count = 6) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.shardGeometry,
        this.shardMaterial.clone())
      mesh.position.copy(pos)
      this.scene.add(mesh)
      this.shards.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 6,
          2 + Math.random() * 4, (Math.random() - 0.5) * 6),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8,
          Math.random() * 8),
        age: 0,
        life: 1,
      })
    }
  }
```

Extend `update(dt)` — append inside the method:

```ts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.age += dt
      const t = p.age / p.life
      if (t >= 1) {
        this.scene.remove(p.sprite)
        p.sprite.material.dispose()
        this.particles.splice(i, 1)
        continue
      }
      p.vel.multiplyScalar(1 - dt * 1.5) // drag
      p.sprite.position.addScaledVector(p.vel, dt)
      p.sprite.scale.setScalar(
        p.sprite.scale.x + p.grow * dt)
      p.sprite.material.opacity = p.baseOpacity * (1 - t)
    }

    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i]
      s.age += dt
      if (s.age >= s.life) {
        this.scene.remove(s.mesh)
        ;(s.mesh.material as THREE.Material).dispose()
        this.shards.splice(i, 1)
        continue
      }
      s.vel.y -= 9.82 * dt
      s.mesh.position.addScaledVector(s.vel, dt)
      s.mesh.rotation.x += s.spin.x * dt
      s.mesh.rotation.y += s.spin.y * dt
      s.mesh.rotation.z += s.spin.z * dt
      ;(s.mesh.material as THREE.MeshStandardMaterial).opacity =
        1 - s.age / s.life
    }
```

- [ ] **Step 3: Add collision callback in `src/projectile.ts`**

Add a public field to `ProjectileManager`:

```ts
  onImpact: ((pos: THREE.Vector3, speed: number, isGround: boolean) => void)
    | null = null
```

In `launch()`, after `this.physics.track(this.mesh, this.body)`, add a listener on every projectile (keep the existing blast listener as-is):

```ts
    this.body.addEventListener('collide',
      (e: { body: CANNON.Body, contact: { getImpactVelocityAlongNormal(): number } }) => {
        if (!this.body) return
        this.onImpact?.(
          new THREE.Vector3(this.body.position.x, this.body.position.y,
            this.body.position.z),
          Math.abs(e.contact.getImpactVelocityAlongNormal()),
          e.body === this.physics.ground,
        )
      })
```

- [ ] **Step 4: Wire in `src/main.ts`**

After `const effects = new Effects(scene, camera)` add:

```ts
let groundHitThisShot = false
projectiles.onImpact = (pos, speed, isGround) => {
  sfx.impact(speed / 12)
  effects.shake(Math.min(0.5, speed / 30))
  if (isGround && !groundHitThisShot) {
    groundHitThisShot = true
    effects.landingDust(pos)
  }
  if (!isGround && speed > 4) effects.splinters(pos)
}
```

Reset the flag when a shot starts — in the `'charging'` case's `wasReleased` block, next to `crateField.beginShot()`:

```ts
        groundHitThisShot = false
```

Add the flight trail — in the animation loop, after `projectiles.update(dt)`:

```ts
  const ballPos = projectiles.position
  if (ballPos) effects.trail(ballPos, dt, projectiles.speed)
```

This needs a position getter on `ProjectileManager` — add next to the `speed` getter in `src/projectile.ts`:

```ts
  get position(): THREE.Vector3 | null {
    return this.mesh ? this.mesh.position : null
  }
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 6: Manual check**

Run: `npm run dev`. Fire: grey puff trail follows the ball; on ground contact a tan dust ring bursts with a small camera kick and a thud sound; smashing into crates throws wood shards and crunches, with shake scaling by impact. Dust ring appears only at the first ground contact per shot.

- [ ] **Step 7: Commit**

```bash
git add src/effects.ts src/physics.ts src/projectile.ts src/main.ts
git commit -m "feat: flight trail, landing dust, crate splinters"
```

---

### Task 6: Blast VFX upgrade + slow-mo final crate

**Files:**
- Modify: `src/effects.ts`, `src/projectile.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `Effects.puff`, `Effects.shake` (Tasks 4–5).
- Produces: `Effects.blastFx(pos: THREE.Vector3)`; `ProjectileManager.onBlast: ((pos: THREE.Vector3) => void) | null`.

- [ ] **Step 1: Add `blastFx` to `src/effects.ts`**

The shockwave ring needs per-frame animation; reuse the pattern from the old wireframe effect. Add a field and method:

```ts
  private rings: { mesh: THREE.Mesh, age: number }[] = []
```

```ts
  blastFx(pos: THREE.Vector3) {
    this.shake(1.1)
    // white flash, dies fast
    this.puff(pos, { color: 0xffffff, size: 5, life: 0.15 })
    // fireball + smoke
    this.puff(pos, { color: 0xffb12b, size: 3, life: 0.4 })
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      this.puff(pos, {
        color: 0x777777, size: 1.6, life: 1.2,
        vel: new THREE.Vector3(Math.cos(a) * 4, 2 + Math.random() * 2,
          Math.sin(a) * 4),
      })
    }
    // ground shockwave ring
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true,
        opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
    )
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(pos.x, 0.05, pos.z)
    this.scene.add(mesh)
    this.rings.push({ mesh, age: 0 })
  }
```

Append to `update(dt)`:

```ts
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]
      r.age += dt
      const t = r.age / 0.5
      if (t >= 1) {
        this.scene.remove(r.mesh)
        r.mesh.geometry.dispose()
        ;(r.mesh.material as THREE.Material).dispose()
        this.rings.splice(i, 1)
        continue
      }
      r.mesh.scale.setScalar(1 + t * 8)
      ;(r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t)
    }
```

- [ ] **Step 2: Replace blast visuals in `src/projectile.ts`**

Add field `onBlast: ((pos: THREE.Vector3) => void) | null = null` next to `onImpact`. In `explode()`, delete everything from `const material = new THREE.MeshBasicMaterial({` to the `this.blastEffects.push(...)` line, replacing with:

```ts
    this.onBlast?.(new THREE.Vector3(origin.x, origin.y, origin.z))
```

Then remove the now-dead code: the `BlastEffect` interface, the `blastEffects` field, and the whole blast-effect loop inside `update(dt)` (the method keeps existing but its body becomes empty — delete `update` entirely and remove its call from `main.ts`'s loop: the `projectiles.update(dt)` line goes away, keep `effects.update(dt)` and the trail lines which used `projectiles.position`).

- [ ] **Step 3: Wire in `src/main.ts`**

Next to the `projectiles.onImpact = ...` block:

```ts
projectiles.onBlast = (pos) => {
  sfx.blast()
  effects.blastFx(pos)
}
```

Remove the `projectiles.update(dt)` line from the loop (per Step 2).

- [ ] **Step 4: Add slow-mo to `src/main.ts`**

Near the other state vars:

```ts
let timeScale = 1
let slowmoTimer = 0
let prevStanding = 0
```

In `loadLevel`, add `prevStanding = crateField.countStanding()` after `crateField.spawn(...)` and `timeScale = 1; slowmoTimer = 0` alongside.

In the `'resolving'` case, before the settle check add:

```ts
      const standingNow = crateField.countStanding()
      if (standingNow === 0 && prevStanding > 0) {
        slowmoTimer = 1.2
        timeScale = 0.3
      }
      prevStanding = standingNow
```

In the loop, replace the fixed-step tail. Old:

```ts
  trebuchet.update(dt)
  physics.step(dt)
  effects.update(dt)
```

New (slow-mo eases back at 2×/s; resolve/feedback timers stay real-time — they already use raw `dt` above):

```ts
  if (slowmoTimer > 0) {
    slowmoTimer -= dt
  } else {
    timeScale = Math.min(1, timeScale + dt * 2)
  }
  const simDt = dt * timeScale
  trebuchet.update(simDt)
  physics.step(simDt)
  effects.update(simDt)
```

Also update the trail call to pass `simDt` instead of `dt`.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: exits 0 — confirms the removed `ProjectileManager.update` has no remaining callers.

- [ ] **Step 6: Manual check**

Run: `npm run dev`. Earn a blast power-up (gold crate) and use it: flash + orange fireball + grey smoke ring + expanding ground ring + boom + big shake; no wireframe sphere. Knock down the last crate of a level: physics dips to 0.3× for ~1.2s then smoothly speeds back up; the resolve bar keeps draining at normal speed.

- [ ] **Step 7: Commit**

```bash
git add src/effects.ts src/projectile.ts src/main.ts
git commit -m "feat: layered blast VFX and final-crate slow motion"
```

---

### Task 7: New power-ups (multi, bouncy) + floating pickup labels

**Files:**
- Modify: `src/powerups.ts`, `src/projectile.ts`, `src/crates.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `hud.floatLabel(text, x, y)` (Task 3), `hud.toast` (Task 3).
- Produces:
  - `ShotModifiers` gains `multi?: boolean`, `bouncy?: boolean`.
  - `ProjectileManager` handles N simultaneous projectiles; `launch` unchanged in signature.
  - `ShotResult` gains `consumed: { type: PowerUpType, position: THREE.Vector3 }[]`.

- [ ] **Step 1: Update `src/powerups.ts`**

```ts
export type PowerUpType =
  | 'extra-shot'
  | 'blast-shot'
  | 'heavy-shot'
  | 'multi-shot'
  | 'bouncy-shot'

export interface ShotModifiers {
  blast?: boolean
  heavy?: boolean
  multi?: boolean
  bouncy?: boolean
}

export const POWER_UPS: PowerUpType[] = [
  'extra-shot',
  'blast-shot',
  'heavy-shot',
  'multi-shot',
  'bouncy-shot',
]

export const POWER_UP_LABELS: Record<PowerUpType, string> = {
  'extra-shot': '+1 shot',
  'blast-shot': 'Blast projectile next shot',
  'heavy-shot': 'Heavy projectile next shot',
  'multi-shot': 'Triple projectile next shot',
  'bouncy-shot': 'Bouncy projectile next shot',
}

// Short screen-label text for floating pickup labels
export const POWER_UP_SHORT: Record<PowerUpType, string> = {
  'extra-shot': '+1 SHOT!',
  'blast-shot': 'BLAST!',
  'heavy-shot': 'HEAVY!',
  'multi-shot': 'MULTI!',
  'bouncy-shot': 'BOUNCY!',
}
```

- [ ] **Step 2: Generalize `src/projectile.ts` to N projectiles**

Replace `private mesh` / `private body` with arrays and update every member. Full new class body (imports, `RADIUS`, `BLAST_RADIUS`, `BLAST_FORCE` unchanged; `BlastEffect` was already removed in Task 6):

```ts
export class ProjectileManager {
  private meshes: THREE.Mesh[] = []
  private bodies: CANNON.Body[] = []
  private bouncyMaterial: CANNON.Material
  onImpact: ((pos: THREE.Vector3, speed: number, isGround: boolean) => void)
    | null = null
  onBlast: ((pos: THREE.Vector3) => void) | null = null

  constructor(
    private scene: THREE.Scene,
    private physics: PhysicsCtx,
  ) {
    this.bouncyMaterial = new CANNON.Material('bouncy')
    this.physics.world.addContactMaterial(new CANNON.ContactMaterial(
      this.bouncyMaterial,
      this.physics.world.defaultMaterial,
      { restitution: 0.7, friction: 0.3 },
    ))
  }

  launch(pos: THREE.Vector3, vel: THREE.Vector3,
    modifiers: ShotModifiers = {}) {
    this.clear()
    const count = modifiers.multi ? 3 : 1
    const radius = modifiers.multi ? 0.35 : RADIUS
    const mass = modifiers.multi ? 2.5 : modifiers.heavy ? 13 : 5
    const color = modifiers.blast ? 0xff8a24
      : modifiers.bouncy ? 0x3ad6d0
      : modifiers.heavy ? 0x30343b : 0x8a8a8a

    for (let i = 0; i < count; i++) {
      const spread = count === 1 ? 0
        : (i - 1) * (4 * Math.PI / 180) // -4°, 0, +4° around Y
      const v = vel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0),
        spread)
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 24, 16),
        new THREE.MeshStandardMaterial({
          color,
          emissive: modifiers.blast ? 0x7a2100 : 0x000000,
          roughness: 0.9,
        }),
      )
      mesh.castShadow = true
      this.scene.add(mesh)
      const body = new CANNON.Body({
        mass,
        shape: new CANNON.Sphere(radius),
        position: new CANNON.Vec3(pos.x, pos.y, pos.z),
        velocity: new CANNON.Vec3(v.x, v.y, v.z),
      })
      if (modifiers.bouncy) body.material = this.bouncyMaterial
      body.allowSleep = true
      body.sleepSpeedLimit = 0.3
      this.physics.track(mesh, body)
      this.meshes.push(mesh)
      this.bodies.push(body)

      let exploded = false
      body.addEventListener('collide',
        (e: { body: CANNON.Body,
          contact: { getImpactVelocityAlongNormal(): number } }) => {
          if (!this.bodies.includes(body)) return
          this.onImpact?.(
            new THREE.Vector3(body.position.x, body.position.y,
              body.position.z),
            Math.abs(e.contact.getImpactVelocityAlongNormal()),
            e.body === this.physics.ground,
          )
          if (modifiers.blast && !exploded) {
            exploded = true
            this.explode(body.position, body)
          }
        })
    }
  }

  private explode(origin: CANNON.Vec3, self: CANNON.Body) {
    for (const target of this.physics.world.bodies) {
      if (target === self || target.mass === 0) continue
      const offset = target.position.vsub(origin)
      const distance = offset.length()
      if (distance <= 0.01 || distance >= BLAST_RADIUS) continue
      const strength = BLAST_FORCE * (1 - distance / BLAST_RADIUS)
      offset.normalize()
      offset.scale(strength, offset)
      offset.y += strength * 0.35
      target.wakeUp()
      target.applyImpulse(offset, target.position)
    }
    this.onBlast?.(new THREE.Vector3(origin.x, origin.y, origin.z))
  }

  clear() {
    for (const body of this.bodies) this.physics.untrack(body)
    for (const mesh of this.meshes) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.meshes = []
    this.bodies = []
  }

  get speed() {
    return Math.max(0, ...this.bodies.map((b) => b.velocity.length()))
  }

  get position(): THREE.Vector3 | null {
    return this.meshes.length > 0 ? this.meshes[0].position : null
  }
}
```

Note: `get speed` returns 0 for no bodies (`Math.max(0, ...[])`), preserving Task-5 behavior. The trail follows only the first ball of a multi-shot — acceptable.

- [ ] **Step 3: Return consumed-crate positions from `src/crates.ts`**

Add `import * as THREE from 'three'` is already present. Update `ShotResult`:

```ts
export interface ShotResult {
  hitCount: number
  powerUps: PowerUpType[]
  consumed: { type: PowerUpType, position: THREE.Vector3 }[]
}
```

In `finishShot()`, build the richer list:

```ts
  finishShot(): ShotResult {
    const newlyHit = this.crates.filter(
      (c) => c.standingAtShotStart && !this.isStanding(c),
    )
    const consumed: ShotResult['consumed'] = []
    for (const c of newlyHit) {
      if (c.special && !c.consumed) {
        c.consumed = true
        consumed.push({
          type: c.special,
          position: new THREE.Vector3(c.body.position.x,
            c.body.position.y, c.body.position.z),
        })
      }
    }
    return {
      hitCount: newlyHit.length,
      powerUps: consumed.map((c) => c.type),
      consumed,
    }
  }
```

- [ ] **Step 4: Floating labels in `src/main.ts`**

Import `POWER_UP_SHORT` from `./powerups`. In `showShotFeedback`, after `crateField.showHitFeedback()`, project each consumed crate to screen space:

```ts
  for (const { type, position } of result.consumed) {
    const p = position.clone().project(camera)
    hud.floatLabel(
      POWER_UP_SHORT[type],
      (p.x * 0.5 + 0.5) * innerWidth,
      (-p.y * 0.5 + 0.5) * innerHeight,
    )
  }
```

In `applyPowerUps`, handle the new types (alongside the existing three):

```ts
    if (powerUp === 'multi-shot') nextShot.multi = true
    if (powerUp === 'bouncy-shot') nextShot.bouncy = true
```

In `updatePowerUpHud`, add:

```ts
  if (nextShot.multi) active.push('Multi')
  if (nextShot.bouncy) active.push('Bouncy')
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 6: Manual check**

Run: `npm run dev`. Break gold crates until you see each new type: MULTI fires 3 small balls in a fan (all leave trails' first-ball trail, all knock crates, blast+multi = 3 explosions); BOUNCY is cyan and visibly rebounds through the field. Gold "+1 SHOT!"-style labels float up from where the gold crate fell. HUD "Next:" line shows Multi/Bouncy.

- [ ] **Step 7: Commit**

```bash
git add src/powerups.ts src/projectile.ts src/crates.ts src/main.ts
git commit -m "feat: multi-shot and bouncy-shot power-ups, floating pickup labels"
```

---

## Final verification

- [ ] `npm run build` passes.
- [ ] Play all 5 levels start to finish: every state transition shows/clears the right toasts and banners, no console errors, frame rate steady.
- [ ] With `src/music/` empty: silence, no errors. With a file present: looping music after first keypress.
