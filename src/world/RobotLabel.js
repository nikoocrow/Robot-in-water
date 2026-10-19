import * as THREE from 'three'
import { Font } from 'three/addons/loaders/FontLoader.js'
// Subconjunto de three/examples/fonts/helvetiker_bold.typeface.json:
// " 0123456789-.#" y A-Z. Otros caracteres no se dibujarían.
import fontData from '../assets/fonts/helvetiker_bold_label.json'
import { ROBOT_LABEL } from '../config/scene.js'
import { nodeName } from '../utils/blender.js'

/**
 * El texto del pecho llega del .blend como cajas (la fuente no tenía los glifos).
 * Se oculta y se sustituye por el texto real, plano como el original, con su
 * material, en el mismo hueso y escalado para ocupar el mismo hueco.
 */
export function replaceRobotLabel(model) {
  const original = model.getObjectByName(nodeName(ROBOT_LABEL.node))
  if (!original?.isMesh) return null

  // El texto de Blender está en el plano XZ local, mira hacia +Y y "arriba" es -Z
  original.geometry.computeBoundingBox()
  const box = original.geometry.boundingBox
  const width = box.max.x - box.min.x
  const height = box.max.z - box.min.z
  const center = box.getCenter(new THREE.Vector3())

  const font = new Font(fontData)
  const geometry = new THREE.ShapeGeometry(font.generateShapes(ROBOT_LABEL.text, 1), 4)
  geometry.computeBoundingBox()
  const size = geometry.boundingBox.getSize(new THREE.Vector3())
  const scale = Math.min(width / size.x, height / size.y) * ROBOT_LABEL.fill
  geometry.center()
  geometry.scale(scale, scale, 1)

  // Base del texto nuevo (XY, normal +Z) expresada en los ejes locales del original
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 1, 0)
  )

  const label = new THREE.Mesh(geometry, original.material)
  label.name = 'RobotLabel'
  label.position.copy(center).addScaledVector(new THREE.Vector3(0, 1, 0), 0.0005)
  label.quaternion.setFromRotationMatrix(basis)
  label.receiveShadow = true

  // Hijo del original: hereda su transformación y la del hueso
  original.add(label)
  original.material = new THREE.MeshBasicMaterial({ visible: false })
  return label
}
