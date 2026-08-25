import * as THREE from 'three'

// Textures are optional: if the file is missing, the flat fallback color stays.
export function makeMaterial(
  url: string,
  fallback: number,
  repeat = 1,
  tint = 0xffffff,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: fallback })
  new THREE.TextureLoader().load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(repeat, repeat)
      mat.map = tex
      mat.color.set(tint)
      mat.needsUpdate = true
    },
    undefined,
    () => {}, // missing texture: keep fallback color
  )
  return mat
}
