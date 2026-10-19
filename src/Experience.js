import * as THREE from 'three'
import Sizes from './core/Sizes.js'
import Renderer from './core/Renderer.js'
import Quality from './core/Quality.js'
import CameraRig from './core/CameraRig.js'
import World from './world/World.js'
import Hud from './ui/Hud.js'
import Credits from './ui/Credits.js'
import DebugPanel from './ui/DebugPanel.js'
import { loadAssets } from './utils/loadAssets.js'

export default class Experience {
  constructor(canvas) {
    this.canvas = canvas
    this.scene = new THREE.Scene()
    this.timer = new THREE.Timer()

    this.sizes = new Sizes(() => this.resize())
    this.renderer = new Renderer(canvas)
    this.camera = new CameraRig(canvas, this.sizes)
    this.renderer.initPostprocessing(this.scene, this.camera.instance)
    this.quality = new Quality({
      maxPixelRatio: this.sizes.pixelRatio,
      onChange: (settings) => this.applyQuality(settings)
    })
    this.debug = DebugPanel.fromUrl(this.renderer, this.quality)

    this.credits = new Credits()
    this.hud = new Hud({
      onToggleAnimation: (playing) => this.world?.robot.setPlaying(playing),
      onResetCamera: () => this.camera.reset()
    })

    this.resize()
    this.init()
  }

  async init() {
    try {
      const assets = await loadAssets((ratio) => this.hud.setProgress(ratio))
      this.world = new World(this.scene, assets)
      this.applyQuality(this.quality.settings)

      if (this.world.blenderCamera) {
        this.camera.fromBlenderCamera(this.world.blenderCamera, this.world.robot.getFocusPoint())
      }

      // Compila todos los shaders mientras sigue la pantalla de carga: sin tirones al empezar
      await this.renderer.compile(this.scene, this.camera.instance)

      this.hud.ready()
      this.renderer.instance.setAnimationLoop((time) => this.tick(time))
    } catch (error) {
      console.error(error)
      this.hud.error('No se pudo cargar la escena. Revisa que exista src/assets/models/escena.glb.')
    }
  }

  resize() {
    this.quality.setMaxPixelRatio(this.sizes.pixelRatio)
    this.camera.resize()
    this.renderer.resize(this.sizes.width, this.sizes.height, this.quality.settings.pixelRatio)
  }

  applyQuality({ pixelRatio, samples, shadowMapSize }) {
    this.renderer.setSamples(samples)
    this.renderer.resize(this.sizes.width, this.sizes.height, pixelRatio)
    this.world?.lights.setShadowMapSize(shadowMapSize)
  }

  tick(time) {
    this.timer.update(time)
    const delta = this.timer.getDelta()
    const elapsed = this.timer.getElapsed()

    this.quality.update(delta)
    this.camera.update()
    this.world.update(delta, elapsed, this.camera.instance)

    this.debug?.begin()
    this.renderer.render()
    this.debug?.end(delta)
  }
}
