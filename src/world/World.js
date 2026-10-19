import BlenderMaterials from '../materials/BlenderMaterials.js'
import { WORLD_LIGHT } from '../config/scene.js'
import Sky from './Sky.js'
import Clouds from './Clouds.js'
import Lights from './Lights.js'
import RockScatter from './RockScatter.js'
import Droplets from './Droplets.js'
import Robot from './Robot.js'
import { replaceRobotLabel } from './RobotLabel.js'

export default class World {
  constructor(scene, { gltf, data }) {
    const model = gltf.scene
    scene.add(model)

    this.lights = new Lights(scene, data.sun)
    this.materials = new BlenderMaterials({
      sunDirection: this.lights.toSun,
      sunStrength: data.sun.strength ?? 5,
      worldColor: WORLD_LIGHT,
      fps: data.fps ?? 24
    })
    this.materials.apply(model, data.texspace ?? {}, data.splash)
    replaceRobotLabel(model)
    // La animación arranca en el frame 1 de Blender
    this.timeOffset = 1 / (data.fps ?? 24)

    this.sky = new Sky(scene)
    this.clouds = new Clouds(scene, this.lights.toSun)
    this.rocks = new RockScatter(scene, model, data.rockInstances)
    this.droplets = new Droplets(scene, this.materials.splash(), data.droplets)
    this.robot = new Robot(model, gltf.animations, data.fps ?? 24)

    this.blenderCamera = gltf.cameras[0] ?? null
  }

  update(delta, elapsed, camera) {
    this.materials.update(elapsed + this.timeOffset)
    this.sky.update(camera, elapsed)
    this.clouds.update(elapsed)
    this.droplets.update(delta)
    this.robot.update(delta)
  }
}
