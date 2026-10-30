import * as THREE from 'three'
import Sizes from './core/Sizes.js'
import Renderer from './core/Renderer.js'
import Quality from './core/Quality.js'
import CameraRig from './core/CameraRig.js'
import PostProcessing from './core/PostProcessing.js'
import Debug from './core/Debug.js'
import World from './world/World.js'
import Hud from './ui/Hud.js'
import Credits from './ui/Credits.js'
import DebugPanel from './ui/DebugPanel.js'
import { loadAssets } from './utils/loadAssets.js'
import { SCENARIOS, SCENARIO_PARAM } from './config/scene.js'

const DEFAULT_SCENARIO = 'river'

/** ?escena=mar|rio en la URL */
function scenarioFromUrl() {
  const value = new URLSearchParams(window.location.search).get(SCENARIO_PARAM.name)
  return SCENARIO_PARAM.values[value] ?? DEFAULT_SCENARIO
}

export default class Experience {
  constructor(canvas) {
    this.canvas = canvas
    this.scene = new THREE.Scene()
    this.timer = new THREE.Timer()

    // #debug: controles lil-gui · ?debug: panel de rendimiento
    this.debug = new Debug()
    this.sizes = new Sizes(() => this.resize())
    this.renderer = new Renderer(canvas)
    this.camera = new CameraRig(canvas, this.sizes)
    this.post = new PostProcessing(this.renderer.instance, this.scene, this.camera.instance, this.debug)
    this.quality = new Quality({
      maxPixelRatio: this.sizes.pixelRatio,
      onChange: (settings) => this.applyQuality(settings)
    })
    this.perf = DebugPanel.fromUrl(this.renderer, this.quality)

    this.credits = new Credits()
    this.hud = new Hud({
      onToggleAnimation: (playing) => this.world?.robot.setPlaying(playing),
      onResetCamera: () => this.camera.reset(),
      onToggleScenario: () => this.setScenario(this.scenario === 'river' ? 'sea' : 'river')
    })

    this.resize()
    this.init()
  }

  async init() {
    try {
      const assets = await loadAssets((ratio) => this.hud.setProgress(ratio))
      this.world = new World(this.scene, assets, this.debug)
      this.world.setupInteraction(this.canvas, this.camera.instance)
      this.applyQuality(this.quality.settings)

      if (this.world.blenderCamera) {
        this.camera.fromBlenderCamera(this.world.blenderCamera, this.world.robot.getFocusPoint())
      }

      // Compila todos los shaders mientras sigue la pantalla de carga: sin tirones al empezar
      // (antes de elegir escenario, para compilar también lo que estará oculto)
      await this.renderer.compile(this.scene, this.camera.instance)
      this.setScenario(scenarioFromUrl())

      this.hud.ready()
      this.renderer.instance.setAnimationLoop((time) => this.tick(time))
    } catch (error) {
      console.error(error)
      this.hud.error('No se pudo cargar la escena. Revisa que exista src/assets/models/escena.glb.')
    }
  }

  /** 'river' (por defecto) o 'sea': cambia en caliente, sin recargar */
  setScenario(name) {
    const scenario = SCENARIOS[name]
    this.scenario = name
    this.world.setScenario(scenario)
    this.post.setScenario(scenario.post)
    this.camera.controls.maxDistance = scenario.camera.maxDistance
    this.camera.groundHeight = scenario.nature
      ? (x, z) => this.world.terrain.getHeight(x, z)
      : () => -Infinity
    this.hud.setScenario(name)
    this.debug.refresh()

    // La URL refleja el escenario para poder compartirlo
    const url = new URL(window.location.href)
    const param = Object.keys(SCENARIO_PARAM.values).find((key) => SCENARIO_PARAM.values[key] === name)
    if (name === DEFAULT_SCENARIO) url.searchParams.delete(SCENARIO_PARAM.name)
    else url.searchParams.set(SCENARIO_PARAM.name, param)
    window.history.replaceState(null, '', url)
  }

  resize() {
    this.quality.setMaxPixelRatio(this.sizes.pixelRatio)
    this.camera.resize()
    this.setPixelRatio(this.quality.settings.pixelRatio)
  }

  setPixelRatio(pixelRatio) {
    this.renderer.resize(this.sizes.width, this.sizes.height, pixelRatio)
    this.post.resize()
    this.world?.confetti.setPixelRatio(pixelRatio)
  }

  applyQuality({ pixelRatio, samples, shadowMapSize }) {
    this.post.setSamples(samples)
    this.setPixelRatio(pixelRatio)
    this.world?.lights.setShadowMapSize(shadowMapSize)
  }

  tick(time) {
    this.timer.update(time)
    const delta = this.timer.getDelta()
    const elapsed = this.timer.getElapsed()

    this.quality.update(delta)
    this.camera.update()
    this.world.update(delta, elapsed, this.camera.instance)

    this.debug.begin()
    this.perf?.begin()
    this.post.render(elapsed)
    this.perf?.end(delta)
    this.debug.end()
  }
}
