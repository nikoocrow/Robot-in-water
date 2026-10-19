import * as THREE from 'three'
import Sizes from './core/Sizes.js'
import Renderer from './core/Renderer.js'
import CameraRig from './core/CameraRig.js'
import World from './world/World.js'
import Hud from './ui/Hud.js'
import Credits from './ui/Credits.js'
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

      if (this.world.blenderCamera) {
        this.camera.fromBlenderCamera(this.world.blenderCamera, this.world.robot.getFocusPoint())
      }

      this.hud.ready()
      this.renderer.instance.setAnimationLoop((time) => this.tick(time))
    } catch (error) {
      console.error(error)
      this.hud.error('No se pudo cargar la escena. Revisa que existan public/models/escena.glb y public/data/escena.json.')
    }
  }

  resize() {
    this.camera.resize()
    this.renderer.resize(this.sizes.width, this.sizes.height, this.sizes.pixelRatio)
  }

  tick(time) {
    this.timer.update(time)
    const delta = this.timer.getDelta()
    const elapsed = this.timer.getElapsed()

    this.camera.update()
    this.world.update(delta, elapsed, this.camera.instance)
    this.renderer.render()
  }
}
