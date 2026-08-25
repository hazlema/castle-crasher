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
