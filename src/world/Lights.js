import * as THREE from 'three'
import { vectorFromBlender } from '../utils/blender.js'

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
    this.sun.shadow.mapSize.set(4096, 4096)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.015
    const cam = this.sun.shadow.camera
    cam.left = -9
    cam.right = 9
    cam.top = 9
    cam.bottom = -9
    cam.near = 1
    cam.far = 30

    scene.add(this.sun, this.sun.target)
  }
}
