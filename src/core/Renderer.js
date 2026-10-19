import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { BLOOM } from '../config/scene.js'

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
    // La escena de Blender usa la vista "Standard": sRGB sin tone mapping
    this.instance.outputColorSpace = THREE.SRGBColorSpace
    this.instance.toneMapping = THREE.NoToneMapping
    this.instance.shadowMap.enabled = true
    this.instance.shadowMap.type = THREE.PCFShadowMap
  }

  /** Render en HDR (half float + MSAA) -> bloom -> conversión a sRGB */
  initPostprocessing(scene, camera) {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(this.instance, target)
    this.composer.addPass(new RenderPass(scene, camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
  }

  /** Muestras MSAA del render target de la escena */
  setSamples(samples) {
    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (target.samples === samples) continue
      target.samples = samples
      target.dispose() // three lo recrea con las nuevas muestras en el siguiente uso
    }
  }

  resize(width, height, pixelRatio) {
    this.instance.setPixelRatio(pixelRatio)
    this.instance.setSize(width, height)
    this.composer?.setPixelRatio(pixelRatio)
    this.composer?.setSize(width, height)
  }

  /** Compila los shaders de la escena (en paralelo si el driver lo permite) */
  async compile(scene, camera) {
    await this.instance.compileAsync(scene, camera)
  }

  render() {
    this.composer.render()
  }
}
