import * as THREE from 'three'
import type { LaunchSolution } from './trebuchet'

const GRAVITY = 9.82
const PROJECTILE_RADIUS = 0.5

export class AimMarker {
  private marker: THREE.Mesh

  constructor(scene: THREE.Scene) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffd400,
      depthWrite: false,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    })
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.4, 48),
      material,
    )
    this.marker.rotation.x = -Math.PI / 2
    this.marker.position.y = 0.035
    this.marker.renderOrder = 2
    scene.add(this.marker)
  }

  update(launch: LaunchSolution, visible: boolean) {
    this.marker.visible = visible
    if (!visible) return

    const { position, velocity } = launch
    const height = position.y - PROJECTILE_RADIUS
    const flightTime = (
      velocity.y + Math.sqrt(velocity.y ** 2 + 2 * GRAVITY * height)
    ) / GRAVITY

    this.marker.position.x = position.x + velocity.x * flightTime
    this.marker.position.z = position.z + velocity.z * flightTime
  }
}
