import * as THREE from 'three'
import vertexShader from '../shaders/sky/vertex.glsl?raw'
import skyFragment from '../shaders/sky/fragment.glsl?raw'
import islandLib from '../shaders/lib/island.glsl?raw'
import { SKY, SUN_DISC, SEA, ISLAND } from '../config/scene.js'
import { linearColor } from '../utils/blender.js'

/**
 * Lo que ven los rayos de cámara en el World de Blender, más un disco solar
 * y un mar infinito bajo el horizonte con la orilla de la isla
 */
export default class Sky {
  constructor(scene) {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: islandLib + skyFragment,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uHorizonColor: { value: linearColor(SKY.horizon) },
        uZenithColor: { value: linearColor(SKY.zenith) },
        uStart: { value: SKY.start },
        uEnd: { value: SKY.end },
        uOffset: { value: SKY.offset },
        uSunDiscDir: { value: new THREE.Vector3(...SUN_DISC.direction).normalize() },
        uSunColor: { value: linearColor(SUN_DISC.color) },
        uSunSize: { value: SUN_DISC.size },
        uSunIntensity: { value: SUN_DISC.intensity },
        uSunGlow: { value: SUN_DISC.glow },

        uCameraPos: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uSeaLevel: { value: SEA.level },
        uSeaShallow: { value: linearColor(SEA.shallow) },
        uSeaDeep: { value: linearColor(SEA.deep) },
        uSeaFoam: { value: linearColor(SEA.foam) },
        uSeaScale: { value: SEA.scale },
        uSeaSpeed: { value: SEA.speed },
        uSeaReflection: { value: SEA.reflection },
        uSeaSparkle: { value: SEA.sparkle },
        uSeaHaze: { value: new THREE.Vector2(...SEA.haze) },

        uIslandRadius: { value: ISLAND.radius },
        uIslandRoundness: { value: ISLAND.roundness },
        uIslandWobble: { value: ISLAND.wobble },
        uIslandSeed: { value: ISLAND.seed },
        uLowLevel: { value: ISLAND.lowLevel },
        uShoreColor: { value: linearColor(ISLAND.shore) },
        uShoreFoam: { value: ISLAND.shoreFoam }
      }
    })

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.material)
    this.mesh.frustumCulled = false
    // Se dibuja tras los opacos (en el plano lejano, xyww): el test de profundidad
    // evita calcular el mar en los píxeles que ya cubre la isla
    this.mesh.renderOrder = 1000
    scene.add(this.mesh)
  }

  update(camera, elapsed) {
    this.mesh.position.copy(camera.position)
    this.material.uniforms.uCameraPos.value.copy(camera.position)
    this.material.uniforms.uTime.value = elapsed
  }
}
