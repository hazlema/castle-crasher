import * as THREE from 'three'
import { makeMaterial } from './assets'

const REST_ANGLE = -1.1
const RELEASE_ANGLE = 0.7
const END_ANGLE = 1.3
const SWING_SPEED = 6 // rad/s
const MAX_YAW = 0.4
const MIN_SPEED = 12
const MAX_SPEED = 26
const ELEVATION = Math.PI / 4
const RELEASE_TIP_LOCAL = new THREE.Vector3(
  0,
  4.4 + 6.2 * Math.sin(RELEASE_ANGLE),
  -6.2 * Math.cos(RELEASE_ANGLE),
)

export interface LaunchSolution {
  position: THREE.Vector3
  velocity: THREE.Vector3
}

export class Trebuchet {
  group = new THREE.Group()
  private armPivot = new THREE.Group()
  private tip = new THREE.Object3D()
  private swinging = false
  private releasedThisSwing = false
  private power = 0
  private onRelease:
    | ((pos: THREE.Vector3, vel: THREE.Vector3) => void)
    | null = null

  constructor() {
    const wood = makeMaterial('/textures/wood.jpg', 0x7a5a3a)

    const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 6), wood)
    base.position.y = 0.3
    this.group.add(base)

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.4, 0.7), wood)
      leg.position.set(side * 1.6, 2.4, 0)
      this.group.add(leg)
    }

    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 3.8, 12),
      new THREE.MeshStandardMaterial({ color: 0x444444 }),
    )
    axle.rotation.z = Math.PI / 2
    axle.position.y = 4.4
    this.group.add(axle)

    // Arm swings around X. Long end (-Z) is the throwing side; tip lifts
    // as rotation.x increases. Short end (+Z) carries the counterweight.
    this.armPivot.position.y = 4.4
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 8), wood)
    arm.position.z = -2.2 // long end reaches z=-6.2, short end +1.8
    this.armPivot.add(arm)

    const weight = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x555555 }),
    )
    weight.position.set(0, -0.9, 1.8)
    this.armPivot.add(weight)

    this.tip.position.z = -6.2
    this.armPivot.add(this.tip)

    this.armPivot.rotation.x = REST_ANGLE
    this.group.add(this.armPivot)

    this.group.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
    })
  }

  aim(delta: number) {
    if (this.swinging) return
    this.group.rotation.y = THREE.MathUtils.clamp(
      this.group.rotation.y + delta, -MAX_YAW, MAX_YAW)
  }

  get yaw() {
    return this.group.rotation.y
  }

  get busy() {
    return this.swinging
  }

  // This is the single source of truth for both the aim preview and the shot.
  // Keeping the calculation here prevents frame-rate-dependent release errors.
  getLaunchSolution(power: number): LaunchSolution {
    this.group.updateWorldMatrix(true, false)
    const position = this.group.localToWorld(RELEASE_TIP_LOCAL.clone())
    const speed = MIN_SPEED + THREE.MathUtils.clamp(power, 0, 1) *
      (MAX_SPEED - MIN_SPEED)
    const velocity = new THREE.Vector3(
      0,
      Math.sin(ELEVATION),
      -Math.cos(ELEVATION),
    ).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()))
      .multiplyScalar(speed)

    return { position, velocity }
  }

  fire(
    power: number,
    onRelease: (pos: THREE.Vector3, vel: THREE.Vector3) => void,
  ) {
    if (this.swinging) return
    this.swinging = true
    this.releasedThisSwing = false
    this.power = power
    this.onRelease = onRelease
  }

  update(dt: number) {
    if (!this.swinging) return
    this.armPivot.rotation.x += SWING_SPEED * dt

    if (!this.releasedThisSwing &&
        this.armPivot.rotation.x >= RELEASE_ANGLE) {
      this.releasedThisSwing = true
      const launch = this.getLaunchSolution(this.power)
      this.onRelease?.(launch.position, launch.velocity)
    }

    if (this.armPivot.rotation.x >= END_ANGLE) {
      this.armPivot.rotation.x = END_ANGLE
      this.swinging = false
    }
  }

  reset() {
    this.armPivot.rotation.x = REST_ANGLE
    this.swinging = false
  }
}
