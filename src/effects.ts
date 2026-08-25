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

export class Effects {
  private softTex = makeSoftTexture()
  private clouds: Cloud[] = []
  private trauma = 0
  private cameraBase: THREE.Vector3
  private particles: Particle[] = []
  private shards: Shard[] = []
  private shardMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a6a42, transparent: true })
  private shardGeometry = new THREE.BoxGeometry(0.22, 0.1, 0.34)
  private trailTimer = 0
  private rings: { mesh: THREE.Mesh, age: number }[] = []

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
  }
}
