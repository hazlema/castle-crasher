import * as THREE from 'three'
import { makeMaterial } from './assets'

const backgroundModules = import.meta.glob(
  './backgrounds/*.{jpg,jpeg,png,webp}',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

function loadRandomBackground(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) {
  const backgrounds = Object.values(backgroundModules)
  if (backgrounds.length === 0) return
  const url = backgrounds[Math.floor(Math.random() * backgrounds.length)]

  new THREE.TextureLoader().load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    scene.background = texture

    const fitToViewport = () => {
      const image = texture.image as { width: number; height: number }
      const imageAspect = image.width / image.height
      const viewportAspect = camera.aspect

      texture.repeat.set(1, 1)
      texture.offset.set(0, 0)
      if (imageAspect > viewportAspect) {
        texture.repeat.x = viewportAspect / imageAspect
        texture.offset.x = (1 - texture.repeat.x) / 2
      } else {
        texture.repeat.y = imageAspect / viewportAspect
        texture.offset.y = (1 - texture.repeat.y) / 2
      }
      texture.needsUpdate = true
    }

    fitToViewport()
    addEventListener('resize', fitToViewport)
  })
}

export interface SceneCtx {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
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
  loadRandomBackground(scene, camera)

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
  })

  return { scene, camera, renderer }
}
