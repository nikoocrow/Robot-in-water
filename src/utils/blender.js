import * as THREE from 'three'

/**
 * Blender usa Z arriba; Three.js usa Y arriba.
 * (x, y, z) en Blender  ->  (x, z, -y) en Three.js
 */
const AXIS = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1
)
const AXIS_INV = AXIS.clone().transpose()

export function vectorFromBlender([x, y, z]) {
  return new THREE.Vector3(x, z, -y)
}

/** Convierte una matrix_world de Blender (column-major) al sistema de Three.js */
export function matrixFromBlender(array) {
  const m = new THREE.Matrix4().fromArray(array)
  return new THREE.Matrix4().multiplyMatrices(AXIS, m).multiply(AXIS_INV)
}

/** GLTFLoader limpia los nombres ("Rock.008" -> "Rock008") */
export function nodeName(blenderName) {
  return THREE.PropertyBinding.sanitizeNodeName(blenderName)
}

export function linearColor([r, g, b]) {
  return new THREE.Color().setRGB(r, g, b)
}
