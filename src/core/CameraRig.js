import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CAMERA } from '../config/scene.js'

/**
 * Arranca en la misma toma que la cámara de Blender y permite orbitar,
 * sin bajar nunca a ras del agua.
 */
export default class CameraRig {
  constructor(canvas, sizes) {
    this.sizes = sizes
    this.baseFov = 40
    this.instance = new THREE.PerspectiveCamera(this.baseFov, sizes.width / sizes.height, 0.05, 200)

    this.controls = new OrbitControls(this.instance, canvas)
    this.controls.enableDamping = true
    this.controls.minDistance = 1
    this.controls.maxDistance = 25

    this.home = { position: new THREE.Vector3(4, 1.5, 6), target: new THREE.Vector3(0, 1, 0) }
  }

  /** Copia la cámara exportada del .blend y apunta al centro del robot */
  fromBlenderCamera(blenderCamera, focusPoint) {
    blenderCamera.updateWorldMatrix(true, false)
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    blenderCamera.matrixWorld.decompose(position, quaternion, new THREE.Vector3())

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion)
    const target = position.clone().addScaledVector(forward, position.distanceTo(focusPoint))

    this.baseFov = blenderCamera.fov
    this.home = { position, target }
    this.reset()
    this.resize()
  }

  reset() {
    this.instance.position.copy(this.home.position)
    this.controls.target.copy(this.home.target)
    this.update()
  }

  resize() {
    const aspect = this.sizes.width / this.sizes.height
    this.instance.aspect = aspect
    // En vertical, conserva el encuadre horizontal de la toma cuadrada original
    this.instance.fov = aspect < 1
      ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) / aspect))
      : this.baseFov
    this.instance.updateProjectionMatrix()
  }

  update() {
    this.controls.update()
    // OrbitControls recalcula la órbita desde la posición, así que basta con corregirla
    if (this.instance.position.y < CAMERA.minHeight) {
      this.instance.position.y = CAMERA.minHeight
      this.instance.lookAt(this.controls.target)
    }
  }
}
