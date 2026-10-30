import * as THREE from 'three'
import vertexShader from '../shaders/sky/vertex.glsl?raw'
import skyFragment from '../shaders/sky/fragment.glsl?raw'
import islandLib from '../shaders/lib/island.glsl?raw'
import { SKY, SUN_DISC, SEA, ISLAND, RIVER } from '../config/scene.js'
import { linearColor } from '../utils/blender.js'

/**
 * Lo que ven los rayos de cámara en el World de Blender, más un disco solar
 * y el agua bajo el horizonte: el mar infinito o el río, con las orillas de la isla y del terreno.
 * skyColors: { uHorizonColor, uZenithColor }, uniforms compartidos con las nubes y la lente
 */
export default class Sky {
  constructor(scene, debug, terrain, skyColors) {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: islandLib + skyFragment,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        ...skyColors,
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
        uRiverMode: { value: 1 },
        uRiverLevel: terrain.uniforms.uRiverLevel,
        uRiverStep: terrain.uniforms.uRiverStep,
        uRiverMask: terrain.uniforms.uPathMask,
        uWaterline: { value: terrain.waterlineOffset },
        uTerrainSize: { value: terrain.size },
        uRiverMeander: { value: new THREE.Vector2(...RIVER.meander) },
        uRiverWidth: { value: new THREE.Vector2(RIVER.poolWidth, RIVER.width) },
        uRiverNarrow: { value: new THREE.Vector2(...RIVER.narrow) },
        uRiverSpeed: { value: RIVER.flowSpeed },
        uSeaShallow: { value: new THREE.Color() },
        uSeaDeep: { value: new THREE.Color() },
        uSeaFoam: { value: linearColor(SEA.foam) },
        uSeaScale: { value: SEA.scale },
        uSeaSpeed: { value: SEA.speed },
        uSeaReflection: { value: SEA.reflection },
        uSeaSparkle: { value: SEA.sparkle },
        uSeaHaze: { value: new THREE.Vector2() },

        uIslandRadius: { value: ISLAND.radius },
        uIslandRoundness: { value: ISLAND.roundness },
        uIslandWobble: { value: ISLAND.wobble },
        uIslandSeed: { value: ISLAND.seed },
        uShoreColor: { value: new THREE.Color() },
        uShoreFoam: { value: ISLAND.shoreFoam }
      }
    })

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.material)
    this.mesh.frustumCulled = false
    // Se dibuja tras los opacos (en el plano lejano, xyww): el test de profundidad
    // evita calcular el mar en los píxeles que ya cubre la isla
    this.mesh.renderOrder = 1000
    scene.add(this.mesh)

    // Niebla del terreno: color del horizonte y distancias de la bruma del agua (Fog copia el color)
    scene.fog = new THREE.Fog()
    this.scene = scene
    this.params = { horizon: '', zenith: '' }
    this.setupDebug(debug)
  }

  /** Colores del cielo y del agua, bruma y si el agua es río o mar */
  setScenario({ nature, sky, water }) {
    const u = this.material.uniforms
    u.uRiverMode.value = nature ? 1 : 0
    u.uHorizonColor.value.copy(linearColor(sky.horizon))
    u.uZenithColor.value.copy(linearColor(sky.zenith))
    u.uSeaShallow.value.copy(linearColor(water.shallow))
    u.uSeaDeep.value.copy(linearColor(water.deep))
    u.uShoreColor.value.copy(linearColor(water.shore))
    u.uSeaHaze.value.set(...water.haze)

    const fog = this.scene.fog
    fog.color.copy(u.uHorizonColor.value)
    fog.near = water.haze[0]
    fog.far = water.haze[1]

    // lil-gui necesita hex en sRGB
    this.params.horizon = '#' + u.uHorizonColor.value.getHexString()
    this.params.zenith = '#' + u.uZenithColor.value.getHexString()
  }

  setupDebug(debug) {
    const folder = debug.folder('Cielo')
    if (!folder) return
    const u = this.material.uniforms
    folder.addColor(this.params, 'horizon').name('horizonte').onChange((hex) => {
      u.uHorizonColor.value.set(hex)
      this.scene.fog.color.set(hex)
    })
    folder.addColor(this.params, 'zenith').name('arriba').onChange((hex) => u.uZenithColor.value.set(hex))
    folder.add(u.uRiverSpeed, 'value', 0, 4, 0.05).name('corriente del río (m/s)')
    const fog = this.scene.fog
    const syncHaze = () => u.uSeaHaze.value.set(fog.near, fog.far)
    folder.add(fog, 'near', 0, 100, 1).name('niebla desde').onChange(syncHaze)
    folder.add(fog, 'far', 10, 200, 1).name('niebla hasta').onChange(syncHaze)
  }

  update(camera, elapsed) {
    this.mesh.position.copy(camera.position)
    this.material.uniforms.uCameraPos.value.copy(camera.position)
    this.material.uniforms.uTime.value = elapsed
  }
}
