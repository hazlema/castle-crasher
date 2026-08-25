import * as THREE from 'three'
import { createScene } from './scene'
import { createPhysics } from './physics'
import { Trebuchet } from './trebuchet'
import { ProjectileManager } from './projectile'
import { CrateField } from './crates'
import { LEVELS } from './levels'
import { hud } from './hud'
import { input } from './input'
import { AimMarker } from './aim-marker'
import { sfx } from './sfx'
import { startMusic } from './music'
import { Effects } from './effects'
import {
  POWER_UP_LABELS,
  POWER_UP_SHORT,
  type PowerUpType,
  type ShotModifiers,
} from './powerups'

const CHARGE_TIME = 1.5
const MIN_RESOLVE = 1.5 // let the shot fly before checking settle
const MAX_RESOLVE = 6   // includes flight time; prevents endless rolling/spinning
const FEEDBACK_TIME = 3

type State =
  | 'aiming'
  | 'charging'
  | 'firing'
  | 'resolving'
  | 'feedback'
  | 'transition'

const { scene, camera, renderer, swapBackground } = createScene()
const physics = createPhysics()
const trebuchet = new Trebuchet()
scene.add(trebuchet.group)
const aimMarker = new AimMarker(scene)
const projectiles = new ProjectileManager(scene, physics)
const crateField = new CrateField(scene, physics)
const effects = new Effects(scene, camera)

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
projectiles.onBlast = (pos) => {
  sfx.blast()
  effects.blastFx(pos)
}

let state: State = 'aiming'
let levelIndex = 0
let shotsLeft = 0
let charge = 0
let resolveTimer = 0
let feedbackTimer = 0
let onContinue: (() => void) | null = null
let nextShot: ShotModifiers = {}
let tutorialShown = false
let timeScale = 1
let slowmoTimer = 0
let prevStanding = 0

function updatePowerUpHud() {
  const active: string[] = []
  if (nextShot.blast) active.push('Blast')
  if (nextShot.heavy) active.push('Heavy')
  if (nextShot.multi) active.push('Multi')
  if (nextShot.bouncy) active.push('Bouncy')
  hud.setPowerUps(active.length > 0 ? `Next: ${active.join(' + ')}` : '')
}

let loadedLevel = -1

function loadLevel(i: number) {
  // Fresh scenery on every level change; retries keep their backdrop
  if (i !== loadedLevel) swapBackground()
  loadedLevel = i
  levelIndex = i
  const level = LEVELS[i]
  shotsLeft = level.shots
  projectiles.clear()
  trebuchet.reset()
  crateField.spawn(level.crates, level.specialCrates)
  prevStanding = crateField.countStanding()
  timeScale = 1
  slowmoTimer = 0
  hud.setLevel(i + 1)
  hud.setShots(shotsLeft)
  hud.clearToasts()
  hud.hideBanner()
  hud.setResolve(null)
  state = 'aiming'
}

function applyPowerUps(powerUps: PowerUpType[]) {
  if (powerUps.length > 0) sfx.reward()
  for (const powerUp of powerUps) {
    if (powerUp === 'extra-shot') shotsLeft += 1
    if (powerUp === 'blast-shot') nextShot.blast = true
    if (powerUp === 'heavy-shot') nextShot.heavy = true
    if (powerUp === 'multi-shot') nextShot.multi = true
    if (powerUp === 'bouncy-shot') nextShot.bouncy = true
  }
  hud.setShots(shotsLeft)
  updatePowerUpHud()
}

function finishShotResolution() {
  crateField.clearHitFeedback()
  projectiles.clear()
  trebuchet.reset()
  hud.clearToasts()
  state = 'aiming'
}

function showShotFeedback() {
  projectiles.clear()
  trebuchet.reset()
  const result = crateField.finishShot()
  applyPowerUps(result.powerUps)
  crateField.showHitFeedback()

  for (const { type, position } of result.consumed) {
    const p = position.clone().project(camera)
    hud.floatLabel(
      POWER_UP_SHORT[type],
      (p.x * 0.5 + 0.5) * innerWidth,
      (-p.y * 0.5 + 0.5) * innerHeight,
    )
  }

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
      sfx.fanfare()
      onContinue = () => loadLevel(0)
    } else {
      hud.banner('LEVEL CLEARED!', 'press ENTER for the next level')
      sfx.fanfare()
      onContinue = () => loadLevel(levelIndex + 1)
    }
    state = 'transition'
  } else if (shotsLeft === 0) {
    hud.banner('OUT OF SHOTS', 'press ENTER to retry')
    sfx.defeat()
    onContinue = () => loadLevel(levelIndex)
    state = 'transition'
  } else {
    feedbackTimer = 0
    state = 'feedback'
  }
}

loadLevel(0)
startMusic()

const clock = new THREE.Clock()
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05)

  switch (state) {
    case 'aiming':
      if (input.isDown('ArrowLeft')) trebuchet.aim(1.2 * dt)
      if (input.isDown('ArrowRight')) trebuchet.aim(-1.2 * dt)
      if (input.isDown('Space')) {
        state = 'charging'
        charge = 0
      }
      break

    case 'charging':
      charge = Math.min(1, charge + dt / CHARGE_TIME)
      sfx.charge(charge)
      if (input.wasReleased('Space')) {
        sfx.chargeEnd()
        sfx.launch()
        crateField.beginShot()
        groundHitThisShot = false
        shotsLeft -= 1
        hud.setShots(shotsLeft)
        const modifiers = { ...nextShot }
        nextShot = {}
        updatePowerUpHud()
        trebuchet.fire(
          charge,
          (pos, vel) => projectiles.launch(pos, vel, modifiers),
        )
        charge = 0
        state = 'firing'
      }
      break

    case 'firing':
      if (!trebuchet.busy) {
        resolveTimer = 0
        state = 'resolving'
      }
      break

    case 'resolving': {
      resolveTimer += dt
      hud.setResolve(Math.max(0, 1 - resolveTimer / MAX_RESOLVE))
      const standingNow = crateField.countStanding()
      if (standingNow < prevStanding) effects.shake(0.15)
      if (standingNow === 0 && prevStanding > 0) {
        slowmoTimer = 1.2
        timeScale = 0.3
      }
      prevStanding = standingNow
      if (
        resolveTimer > MAX_RESOLVE ||
        (resolveTimer > MIN_RESOLVE &&
          projectiles.speed < 0.3 &&
          crateField.allSettled())
      ) {
        if (resolveTimer > MAX_RESOLVE) crateField.stopMotion()
        showShotFeedback()
      }
      break
    }

    case 'feedback':
      feedbackTimer += dt
      if (feedbackTimer >= FEEDBACK_TIME) finishShotResolution()
      break

    case 'transition':
      if (input.wasPressed('Enter')) {
        hud.hideBanner()
        onContinue?.()
        onContinue = null
      }
      break
  }

  hud.setPower(charge)
  hud.setCrates(crateField.countStanding(), crateField.total)
  aimMarker.update(
    trebuchet.getLaunchSolution(charge),
    state === 'aiming' || state === 'charging',
  )

  if (slowmoTimer > 0) {
    slowmoTimer -= dt
  } else {
    timeScale = Math.min(1, timeScale + dt * 2)
  }
  const simDt = dt * timeScale
  trebuchet.update(simDt)
  physics.step(simDt)
  const ballPos = projectiles.position
  if (ballPos) effects.trail(ballPos, simDt, projectiles.speed)
  effects.update(simDt)
  renderer.render(scene, camera)
  input.endFrame()
})
