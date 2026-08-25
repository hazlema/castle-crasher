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
import {
  POWER_UP_LABELS,
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

const { scene, camera, renderer } = createScene()
const physics = createPhysics()
const trebuchet = new Trebuchet()
scene.add(trebuchet.group)
const aimMarker = new AimMarker(scene)
const projectiles = new ProjectileManager(scene, physics)
const crateField = new CrateField(scene, physics)

let state: State = 'aiming'
let levelIndex = 0
let shotsLeft = 0
let charge = 0
let resolveTimer = 0
let feedbackTimer = 0
let onContinue: (() => void) | null = null
let nextShot: ShotModifiers = {}

function updatePowerUpHud() {
  const active: string[] = []
  if (nextShot.blast) active.push('Blast')
  if (nextShot.heavy) active.push('Heavy')
  hud.setPowerUps(active.length > 0 ? `Next: ${active.join(' + ')}` : '')
}

function loadLevel(i: number) {
  levelIndex = i
  const level = LEVELS[i]
  shotsLeft = level.shots
  projectiles.clear()
  trebuchet.reset()
  crateField.spawn(level.crates, level.specialCrates)
  hud.setLevel(i + 1)
  hud.setShots(shotsLeft)
  hud.hideToast()
  hud.setTimer(null)
  state = 'aiming'
}

function applyPowerUps(powerUps: PowerUpType[]) {
  if (powerUps.length > 0) sfx.reward()
  for (const powerUp of powerUps) {
    if (powerUp === 'extra-shot') shotsLeft += 1
    if (powerUp === 'blast-shot') nextShot.blast = true
    if (powerUp === 'heavy-shot') nextShot.heavy = true
  }
  hud.setShots(shotsLeft)
  updatePowerUpHud()
}

function finishShotResolution() {
  crateField.clearHitFeedback()
  projectiles.clear()
  trebuchet.reset()
  hud.hideToast()
  state = 'aiming'
}

function showShotFeedback() {
  projectiles.clear()
  trebuchet.reset()
  const result = crateField.finishShot()
  applyPowerUps(result.powerUps)
  crateField.showHitFeedback()

  const crateText = `Crates hit: ${result.hitCount}`
  const colorKey = 'Red = knocked down  •  Green = still standing'
  const rewardText = result.powerUps.length > 0
    ? `Power-up: ${result.powerUps.map((p) => POWER_UP_LABELS[p]).join(' + ')}`
    : 'No power-up this shot'

  const standing = crateField.countStanding()
  let outcomeText = ''
  let next: (() => void) | null = null
  if (standing === 0) {
    if (levelIndex + 1 >= LEVELS.length) {
      outcomeText = 'You conquered the castle!'
      sfx.fanfare()
      next = () => loadLevel(0)
    } else {
      outcomeText = 'Level cleared!'
      sfx.fanfare()
      next = () => loadLevel(levelIndex + 1)
    }
  } else if (shotsLeft === 0) {
    outcomeText = 'Out of shots — retry!'
    sfx.defeat()
    next = () => loadLevel(levelIndex)
  }

  const lines = [crateText, colorKey, rewardText]
  if (next) {
    lines.push('', `${outcomeText}  — press ENTER`)
    onContinue = next
    state = 'transition'
  } else {
    feedbackTimer = 0
    state = 'feedback'
  }
  hud.setTimer(null)
  hud.showToast(lines.join('\n'))
}

loadLevel(0)

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

    case 'resolving':
      resolveTimer += dt
      hud.setTimer(Math.max(0, MAX_RESOLVE - resolveTimer))
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

    case 'feedback':
      feedbackTimer += dt
      if (feedbackTimer >= FEEDBACK_TIME) finishShotResolution()
      break

    case 'transition':
      if (input.wasPressed('Enter')) {
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

  trebuchet.update(dt)
  physics.step(dt)
  projectiles.update(dt)
  renderer.render(scene, camera)
  input.endFrame()
})
