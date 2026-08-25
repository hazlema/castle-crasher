import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { PhysicsCtx } from './physics'
import { makeMaterial } from './assets'
import { POWER_UPS, type PowerUpType } from './powerups'

export const SIZE = 1.6
const UP = new CANNON.Vec3(0, 1, 0)
const tmp = new CANNON.Vec3()

interface Crate {
  mesh: THREE.Mesh
  body: CANNON.Body
  homeY: number
  special: PowerUpType | null
  consumed: boolean
  standingAtShotStart: boolean
}

export interface ShotResult {
  hitCount: number
  powerUps: PowerUpType[]
  consumed: { type: PowerUpType, position: THREE.Vector3 }[]
}

export class CrateField {
  private crates: Crate[] = []
  private material: THREE.MeshStandardMaterial
  private specialMaterial: THREE.MeshStandardMaterial
  private hitMaterial = new THREE.MeshStandardMaterial({
    color: 0xe53935,
    emissive: 0x4d0808,
  })
  private standingMaterial = new THREE.MeshStandardMaterial({
    color: 0x43d85b,
    emissive: 0x073d10,
  })

  constructor(
    private scene: THREE.Scene,
    private physics: PhysicsCtx,
  ) {
    this.material = makeMaterial('/textures/crate.jpg', 0xa07840)
    this.specialMaterial = makeMaterial(
      '/textures/crate.jpg', 0xffc928, 1, 0xffc928)
    this.specialMaterial.emissive.set(0x5a3900)
    this.specialMaterial.emissiveIntensity = 0.7
  }

  spawn(positions: [number, number, number][], specialCount: number) {
    this.clear()
    const specialIndices = new Set(
      positions.map((_, i) => i)
        .sort(() => Math.random() - 0.5)
        .slice(0, specialCount),
    )

    for (const [index, [x, y, z]] of positions.entries()) {
      const special = specialIndices.has(index)
        ? POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)]
        : null
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(SIZE, SIZE, SIZE),
        special ? this.specialMaterial : this.material,
      )
      mesh.castShadow = mesh.receiveShadow = true
      this.scene.add(mesh)
      const body = new CANNON.Body({
        mass: 2,
        shape: new CANNON.Box(new CANNON.Vec3(SIZE / 2, SIZE / 2, SIZE / 2)),
        position: new CANNON.Vec3(x, y, z),
      })
      body.allowSleep = true
      body.sleepSpeedLimit = 0.2
      this.physics.track(mesh, body)
      this.crates.push({
        mesh,
        body,
        homeY: y,
        special,
        consumed: false,
        standingAtShotStart: true,
      })
    }
  }

  clear() {
    for (const c of this.crates) {
      this.physics.untrack(c.body)
      this.scene.remove(c.mesh)
      c.mesh.geometry.dispose()
    }
    this.crates = []
  }

  // Standing = still upright (tilt < 45°) and not fallen off its home height.
  private isStanding(c: Crate): boolean {
    c.body.quaternion.vmult(UP, tmp)
    const upright = tmp.dot(UP) > 0.707
    const atHome = c.body.position.y > c.homeY - 0.5
    return upright && atHome
  }

  countStanding(): number {
    return this.crates.filter((c) => this.isStanding(c)).length
  }

  beginShot() {
    for (const c of this.crates) {
      c.standingAtShotStart = this.isStanding(c)
    }
  }

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

  showHitFeedback() {
    for (const c of this.crates) {
      c.mesh.material = this.isStanding(c)
        ? this.standingMaterial
        : this.hitMaterial
    }
  }

  clearHitFeedback() {
    for (const c of this.crates) {
      c.mesh.material = c.special && !c.consumed
        ? this.specialMaterial
        : this.material
    }
  }

  stopMotion() {
    for (const c of this.crates) {
      c.body.velocity.setZero()
      c.body.angularVelocity.setZero()
      c.body.force.setZero()
      c.body.torque.setZero()
      c.body.sleep()
    }
  }

  get total() {
    return this.crates.length
  }

  allSettled(): boolean {
    return this.crates.every(
      (c) => c.body.sleepState === CANNON.Body.SLEEPING ||
             c.body.velocity.length() < 0.15)
  }
}
