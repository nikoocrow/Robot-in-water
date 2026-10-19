import * as THREE from 'three'
import { vectorFromBlender } from '../utils/blender.js'
import { QUALITY, SHADOW } from '../config/scene.js'

/**
 * El sol de Blender. Los shaders calculan la luz por su cuenta
 * (uniform uSunDir); esta DirectionalLight existe para generar el shadow map.
 */
export default class Lights {
  constructor(scene, sunData) {
    const travel = vectorFromBlender(sunData.direction).normalize()
    this.toSun = travel.clone().negate()

    this.sun = new THREE.DirectionalLight(0xffffff, 1)
    this.sun.position.copy(this.toSun).multiplyScalar(12)
    this.sun.target.position.set(0, 0, 0)

    this.sun.castShadow = true
    this.setShadowMapSize(QUALITY.levels[0].shadowMapSize)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.015
    const cam = this.sun.shadow.camera
    cam.left = -SHADOW.extent
    cam.right = SHADOW.extent
    cam.top = SHADOW.extent
    cam.bottom = -SHADOW.extent
    cam.near = 1
    cam.far = 30

    scene.add(this.sun, this.sun.target)
  }

  /** Cambia la resolución del shadow map (se recrea en el siguiente render) */
  setShadowMapSize(size) {
    const shadow = this.sun.shadow
    if (shadow.mapSize.x === size) return
    shadow.mapSize.set(size, size)
    shadow.map?.dispose()
    shadow.map = null
  }
}
