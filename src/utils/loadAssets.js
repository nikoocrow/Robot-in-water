import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { ASSETS } from '../config/scene.js'

export async function loadAssets(onProgress) {
  const gltfLoader = new GLTFLoader()
  const fileLoader = new THREE.FileLoader()
  fileLoader.setResponseType('json')

  const [gltf, data] = await Promise.all([
    gltfLoader.loadAsync(ASSETS.model, (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }),
    fileLoader.loadAsync(ASSETS.data)
  ])

  onProgress?.(1)
  return { gltf, data }
}
