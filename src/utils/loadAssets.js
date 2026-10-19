import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
// Con ?url Vite le pone hash al nombre: se puede cachear como inmutable.
// index.html lo precarga con la misma URL, así que la descarga empieza antes que el JS.
import modelUrl from '../assets/models/escena.glb?url'
import data from '../assets/data/escena.json'

export async function loadAssets(onProgress) {
  const gltf = await new GLTFLoader().loadAsync(modelUrl, (e) => {
    if (e.lengthComputable) onProgress?.(e.loaded / e.total)
  })

  onProgress?.(1)
  return { gltf, data }
}
