import * as CANNON from 'cannon-es'
import * as THREE from 'three'

export interface PhysicsCtx {
  world: CANNON.World
  track(mesh: THREE.Object3D, body: CANNON.Body): void
  untrack(body: CANNON.Body): void
  step(dt: number): void
}

export function createPhysics(): PhysicsCtx {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
  world.allowSleep = true

  const ground = new CANNON.Body({ type: CANNON.Body.STATIC })
  ground.addShape(new CANNON.Plane())
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  world.addBody(ground)

  const pairs: { mesh: THREE.Object3D; body: CANNON.Body }[] = []

  return {
    world,
    track(mesh, body) {
      world.addBody(body)
      pairs.push({ mesh, body })
    },
    untrack(body) {
      const i = pairs.findIndex((p) => p.body === body)
      if (i >= 0) pairs.splice(i, 1)
      world.removeBody(body)
    },
    step(dt) {
      world.step(1 / 60, dt, 3)
      for (const p of pairs) {
        p.mesh.position.set(
          p.body.position.x, p.body.position.y, p.body.position.z)
        p.mesh.quaternion.set(
          p.body.quaternion.x, p.body.quaternion.y,
          p.body.quaternion.z, p.body.quaternion.w)
      }
    },
  }
}
