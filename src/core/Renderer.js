import * as THREE from 'three'

export default class Renderer {
  constructor(canvas) {
    // El canvas solo recibe el pase final del composer (que ya tiene MSAA y profundidad),
    // así que no necesita antialias ni buffer de profundidad propios
    this.instance = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance'
    })
    this.instance.outputColorSpace = THREE.SRGBColorSpace
    this.instance.shadowMap.enabled = true
    this.instance.shadowMap.type = THREE.PCFShadowMap
  }

  resize(width, height, pixelRatio) {
    this.instance.setPixelRatio(pixelRatio)
    this.instance.setSize(width, height)
  }

  /** Compila los shaders de la escena (en paralelo si el driver lo permite) */
  async compile(scene, camera) {
    await this.instance.compileAsync(scene, camera)
  }
}
