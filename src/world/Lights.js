import * as THREE from 'three'
import { vectorFromBlender } from '../utils/blender.js'
import { QUALITY, ENVIRONMENT } from '../config/scene.js'

/**
 * El sol de Blender. Los shaders de Blender calculan la luz por su cuenta
 * (uniform uSunDir); esta DirectionalLight genera el shadow map e ilumina,
 * junto a la HemisphereLight, los materiales de three (pasto, suelo, árboles).
 */
export default class Lights {
  constructor(scene, sunData, debug) {
    const travel = vectorFromBlender(sunData.direction).normalize()
    this.toSun = travel.clone().negate()

    this.sun = new THREE.DirectionalLight(ENVIRONMENT.sunColor, ENVIRONMENT.sunIntensity)
    this.sun.target.position.set(0, 0, 0)

    this.sun.castShadow = true
    this.setShadowMapSize(QUALITY.levels[0].shadowMapSize)
    this.sun.shadow.camera.near = 1

    // Sombras con color, no negras
    this.hemi = new THREE.HemisphereLight(ENVIRONMENT.hemiSky, ENVIRONMENT.hemiGround, ENVIRONMENT.hemiIntensity)

    scene.add(this.sun, this.sun.target, this.hemi)
    this.setupDebug(debug)
  }

  /** Área que cubre la sombra (depende del escenario): { extent, distance, bias, normalBias } */
  setShadowArea({ extent, distance, bias, normalBias }) {
    this.sun.position.copy(this.toSun).multiplyScalar(distance)
    this.sun.shadow.bias = bias
    this.sun.shadow.normalBias = normalBias
    const cam = this.sun.shadow.camera
    cam.left = cam.bottom = -extent
    cam.right = cam.top = extent
    cam.far = distance * 2 + 10
    cam.updateProjectionMatrix()
  }

  /** Cambia la resolución del shadow map (se recrea en el siguiente render) */
  setShadowMapSize(size) {
    const shadow = this.sun.shadow
    if (shadow.mapSize.x === size) return
    shadow.mapSize.set(size, size)
    shadow.map?.dispose()
    shadow.map = null
  }

  setupDebug(debug) {
    const folder = debug.folder('Luces')
    if (!folder) return
    const params = { sun: ENVIRONMENT.sunColor, sky: ENVIRONMENT.hemiSky, ground: ENVIRONMENT.hemiGround }
    folder.addColor(params, 'sun').name('sol').onChange((hex) => this.sun.color.set(hex))
    folder.add(this.sun, 'intensity', 0, 6, 0.05).name('intensidad sol')
    folder.addColor(params, 'sky').name('hemisferio cielo').onChange((hex) => this.hemi.color.set(hex))
    folder.addColor(params, 'ground').name('hemisferio suelo').onChange((hex) => this.hemi.groundColor.set(hex))
    folder.add(this.hemi, 'intensity', 0, 4, 0.05).name('intensidad hemisferio')
  }
}
