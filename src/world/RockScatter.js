import * as THREE from 'three'
import { matrixFromBlender, nodeName } from '../utils/blender.js'
import { ROCK_SOURCES } from '../config/scene.js'

/**
 * Recrea el sistema de partículas "hair" (y el scatter sobre la curva)
 * que reparte las rocas Rock.008 / .009 / .010 por el suelo.
 * Cada tipo de roca es un único InstancedMesh -> 3 draw calls para ~1000 rocas.
 * Las rocas modelo se ocultan, igual que en el render de Blender.
 */
export default class RockScatter {
  constructor(scene, model, rockInstances) {
    this.meshes = []
    const matrix = new THREE.Matrix4()

    for (const sourceName of new Set([...ROCK_SOURCES, ...Object.keys(rockInstances)])) {
      const source = model.getObjectByName(nodeName(sourceName))
      if (source) source.visible = false
    }

    for (const [sourceName, matrices] of Object.entries(rockInstances)) {
      const source = model.getObjectByName(nodeName(sourceName))
      if (!source?.isMesh) {
        console.warn(`[RockScatter] No se encontró la malla ${sourceName}`)
        continue
      }

      const instanced = new THREE.InstancedMesh(
        source.geometry,
        source.material, // mismo shader "Rock"; three compila la variante instanciada
        matrices.length
      )
      instanced.name = `${sourceName}_scatter`
      instanced.castShadow = true
      instanced.receiveShadow = true

      matrices.forEach((array, i) => {
        matrix.copy(matrixFromBlender(array))
        instanced.setMatrixAt(i, matrix)
      })
      instanced.instanceMatrix.needsUpdate = true
      instanced.computeBoundingSphere()

      scene.add(instanced)
      this.meshes.push(instanced)
    }
  }
}
