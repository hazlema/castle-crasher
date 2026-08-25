import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { PhysicsCtx } from './physics'
import type { ShotModifiers } from './powerups'

const RADIUS = 0.5
const BLAST_RADIUS = 6
const BLAST_FORCE = 22

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

    // Side-by-side spawn offsets keep multi-shot balls from overlapping —
    // interpenetrating bodies get blown apart by the solver on step one.
    const side = new THREE.Vector3(vel.x, 0, vel.z)
      .normalize().cross(new THREE.Vector3(0, 1, 0))

    for (let i = 0; i < count; i++) {
      const spread = count === 1 ? 0
        : (i - 1) * (2.5 * Math.PI / 180) // -2.5°, 0, +2.5° around Y
      const v = vel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0),
        spread)
      const p = count === 1 ? pos.clone()
        : pos.clone().addScaledVector(side, (i - 1) * radius * 2.2)
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
        position: new CANNON.Vec3(p.x, p.y, p.z),
        velocity: new CANNON.Vec3(v.x, v.y, v.z),
      })
      // Projectiles never collide with each other (group 2 excluded
      // from their mask) so multi-shot balls fly a clean fan.
      body.collisionFilterGroup = 2
      body.collisionFilterMask = ~2
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
