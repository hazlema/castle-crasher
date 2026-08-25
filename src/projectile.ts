import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { PhysicsCtx } from './physics'
import type { ShotModifiers } from './powerups'

const RADIUS = 0.5
const BLAST_RADIUS = 6
const BLAST_FORCE = 22

interface BlastEffect {
  mesh: THREE.Mesh
  age: number
}

export class ProjectileManager {
  private mesh: THREE.Mesh | null = null
  private body: CANNON.Body | null = null
  private blastEffects: BlastEffect[] = []
  onImpact: ((pos: THREE.Vector3, speed: number, isGround: boolean) => void)
    | null = null

  constructor(
    private scene: THREE.Scene,
    private physics: PhysicsCtx,
  ) {}

  launch(pos: THREE.Vector3, vel: THREE.Vector3, modifiers: ShotModifiers = {}) {
    this.clear()
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS, 24, 16),
      new THREE.MeshStandardMaterial({
        color: modifiers.blast ? 0xff8a24 : modifiers.heavy ? 0x30343b : 0x8a8a8a,
        emissive: modifiers.blast ? 0x7a2100 : 0x000000,
        roughness: 0.9,
      }),
    )
    this.mesh.castShadow = true
    this.scene.add(this.mesh)
    this.body = new CANNON.Body({
      mass: modifiers.heavy ? 13 : 5,
      shape: new CANNON.Sphere(RADIUS),
      position: new CANNON.Vec3(pos.x, pos.y, pos.z),
      velocity: new CANNON.Vec3(vel.x, vel.y, vel.z),
    })
    this.body.allowSleep = true
    this.body.sleepSpeedLimit = 0.3
    this.physics.track(this.mesh, this.body)

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

    if (modifiers.blast) {
      let exploded = false
      this.body.addEventListener('collide', () => {
        if (exploded || !this.body) return
        exploded = true
        this.explode(this.body.position)
      })
    }
  }

  private explode(origin: CANNON.Vec3) {
    for (const target of this.physics.world.bodies) {
      if (target === this.body || target.mass === 0) continue
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

    const material = new THREE.MeshBasicMaterial({
      color: 0xffb12b,
      transparent: true,
      opacity: 0.75,
      wireframe: true,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material)
    mesh.position.set(origin.x, origin.y, origin.z)
    this.scene.add(mesh)
    this.blastEffects.push({ mesh, age: 0 })
  }

  update(dt: number) {
    for (let i = this.blastEffects.length - 1; i >= 0; i--) {
      const effect = this.blastEffects[i]
      effect.age += dt
      const progress = Math.min(1, effect.age / 0.4)
      effect.mesh.scale.setScalar(0.3 + progress * BLAST_RADIUS)
      ;(effect.mesh.material as THREE.MeshBasicMaterial).opacity =
        0.75 * (1 - progress)
      if (progress >= 1) {
        this.scene.remove(effect.mesh)
        effect.mesh.geometry.dispose()
        ;(effect.mesh.material as THREE.Material).dispose()
        this.blastEffects.splice(i, 1)
      }
    }
  }

  clear() {
    if (this.body) this.physics.untrack(this.body)
    if (this.mesh) {
      this.scene.remove(this.mesh)
      this.mesh.geometry.dispose()
      ;(this.mesh.material as THREE.Material).dispose()
    }
    this.mesh = null
    this.body = null
  }

  get speed() {
    return this.body ? this.body.velocity.length() : 0
  }

  get position(): THREE.Vector3 | null {
    return this.mesh ? this.mesh.position : null
  }
}
