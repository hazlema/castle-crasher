import * as THREE from 'three'
import { makeMaterial } from './assets'

const backgroundModules = import.meta.glob(
  './backgrounds/*.{jpg,jpeg,png,webp,mp4,webm}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

// Background art keeps its horizon in the lower third of the image;
// pin that line to the 3D ground's on-screen horizon so towers and
// spires never sink behind the grass. Art below the line is meant to
// be hidden by the ground plane.
const IMAGE_HORIZON = 0.28

function fitBackground(
  texture: THREE.Texture,
  camera: THREE.PerspectiveCamera,
) {
  const image = texture.image as HTMLImageElement | HTMLVideoElement
  const imageAspect = image instanceof HTMLVideoElement
    ? image.videoWidth / image.videoHeight
    : image.width / image.height

  camera.updateMatrixWorld()
  const ndc = new THREE.Vector3(0, 0.001, -5000).project(camera)
  const horizonV = THREE.MathUtils.clamp((ndc.y + 1) / 2, 0.3, 0.7)

  // Aspect-true vertical scale, capped so the sky never samples past
  // the top edge of the image on narrow viewports.
  texture.repeat.y = Math.min(
    imageAspect / camera.aspect,
    (1 - IMAGE_HORIZON) / (1 - horizonV),
  )
  texture.repeat.x = Math.min(
    1, texture.repeat.y * camera.aspect / imageAspect)
  texture.offset.x = (1 - texture.repeat.x) / 2
  texture.offset.y = IMAGE_HORIZON - texture.repeat.y * horizonV
  texture.needsUpdate = true
}

export interface SceneCtx {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  // Load a random background different from the current one
  swapBackground(): void
}

export function createScene(): SceneCtx {
  const scene = new THREE.Scene()
  // This remains visible while the randomly selected background loads.
  scene.background = new THREE.Color(0xc9ae85)
  scene.fog = new THREE.Fog(0xc9ae85, 70, 200)

  const camera = new THREE.PerspectiveCamera(
    60, innerWidth / innerHeight, 0.1, 400,
  )
  // Offset three-quarter view so the crate stacks aren't hidden behind the trebuchet
  camera.position.set(8, 8, 15)
  camera.lookAt(0, 3, -30)

  let currentUrl = ''

  const applyBackground = (texture: THREE.Texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    fitBackground(texture, camera)
    const old = scene.background
    scene.background = texture
    if (old instanceof THREE.Texture) {
      const media = old.image
      if (media instanceof HTMLVideoElement) {
        media.pause()
        media.removeAttribute('src')
        media.load() // release the decoder
      }
      old.dispose()
    }
  }

  const swapBackground = () => {
    const backgrounds = Object.values(backgroundModules)
    if (backgrounds.length === 0) return
    let pool = backgrounds.filter((u) => u !== currentUrl)
    if (pool.length === 0) pool = backgrounds
    const url = pool[Math.floor(Math.random() * pool.length)]
    currentUrl = url
    if (/\.(mp4|webm)(\?|$)/.test(url)) {
      const video = document.createElement('video')
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.src = url
      video.addEventListener('loadeddata', () => {
        if (url !== currentUrl) return // a newer swap won the race
        void video.play()
        applyBackground(new THREE.VideoTexture(video))
      }, { once: true })
    } else {
      new THREE.TextureLoader().load(url, (texture) => {
        if (url !== currentUrl) return // a newer swap won the race
        applyBackground(texture)
      })
    }
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(innerWidth, innerHeight)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  document.body.appendChild(renderer.domElement)

  const hemi = new THREE.HemisphereLight(0xfff2dd, 0x556644, 0.9)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(0xffd9a0, 1.6)
  sun.position.set(25, 35, 10)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -60
  sun.shadow.camera.right = 60
  sun.shadow.camera.top = 60
  sun.shadow.camera.bottom = -60
  sun.shadow.camera.far = 120
  scene.add(sun)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    makeMaterial('/textures/ground.jpg', 0x6d8f4e, 40),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(innerWidth, innerHeight)
    if (scene.background instanceof THREE.Texture) {
      fitBackground(scene.background, camera)
    }
  })

  return { scene, camera, renderer, swapBackground }
}
