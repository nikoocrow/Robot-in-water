import * as THREE from 'three'
import BlenderMaterials from '../materials/BlenderMaterials.js'
import { WORLD_LIGHT } from '../config/scene.js'
import Sky from './Sky.js'
import Clouds from './Clouds.js'
import Lights from './Lights.js'
import RockScatter from './RockScatter.js'
import Droplets from './Droplets.js'
import Robot from './Robot.js'
import { replaceRobotLabel } from './RobotLabel.js'
import Terrain from './nature/Terrain.js'
import Grass from './nature/Grass.js'
import Trees from './nature/Trees.js'
import Confetti from './nature/Confetti.js'

export default class World {
  constructor(scene, { gltf, data }, debug) {
    const model = gltf.scene
    scene.add(model)

    // Colores del cielo: los comparten el cielo, las nubes y la lente; cambian con el escenario
    this.skyColors = {
      uHorizonColor: { value: new THREE.Color() },
      uZenithColor: { value: new THREE.Color() }
    }

    this.lights = new Lights(scene, data.sun, debug)
    this.materials = new BlenderMaterials({
      skyColors: this.skyColors,
      sunDirection: this.lights.toSun,
      sunStrength: data.sun.strength ?? 5,
      worldColor: WORLD_LIGHT,
      fps: data.fps ?? 24
    })
    this.materials.apply(model, data.texspace ?? {}, data.splash)
    replaceRobotLabel(model)
    // La animación arranca en el frame 1 de Blender
    this.timeOffset = 1 / (data.fps ?? 24)

    this.terrain = new Terrain(scene, debug)
    this.grass = new Grass(scene, debug, this.terrain)
    this.trees = new Trees(scene, debug, this.terrain)
    this.confetti = new Confetti(scene, debug)

    this.sky = new Sky(scene, debug, this.terrain, this.skyColors)
    this.clouds = new Clouds(scene, this.lights.toSun, this.skyColors)
    this.rocks = new RockScatter(scene, model, data.rockInstances)
    this.droplets = new Droplets(scene, this.materials.splash(), data.droplets)
    this.robot = new Robot(model, gltf.animations, data.fps ?? 24)

    this.blenderCamera = gltf.cameras[0] ?? null
  }

  /** Río (con terreno, pasto, árboles y confeti) o mar alrededor de la isla: SCENARIOS[x] */
  setScenario(scenario) {
    this.nature = scenario.nature
    for (const object of [this.terrain.mesh, this.grass.group, this.trees.group, this.confetti.points]) {
      object.visible = scenario.nature
    }
    this.sky.setScenario(scenario)
    this.lights.setShadowArea(scenario.shadow)
  }

  /**
   * El pasto se aparta del punto del terreno bajo el puntero. El rayo se lanza como
   * mucho una vez por frame (en update): un trackpad manda varios eventos por frame
   */
  setupInteraction(canvas) {
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.pointerMoved = false
    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect()
      this.pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      this.pointerMoved = true
    })
    canvas.addEventListener('pointerleave', () => {
      this.pointerMoved = false
      this.grass.setInteraction(null)
    })
  }

  update(delta, elapsed, camera) {
    if (this.pointerMoved && this.nature) {
      this.pointerMoved = false
      this.raycaster.setFromCamera(this.pointer, camera)
      this.grass.setInteraction(this.terrain.raycast(this.raycaster.ray))
    }
    this.materials.update(elapsed + this.timeOffset)
    this.sky.update(camera, elapsed)
    this.clouds.update(elapsed)
    this.droplets.update(delta)
    this.robot.update(delta)
    this.grass.update(elapsed, camera)
    this.trees.update(elapsed)
    this.confetti.update(elapsed)
  }
}
