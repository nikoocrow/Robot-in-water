import * as THREE from 'three'
import vertexShader from '../shaders/surface/vertex.glsl?raw'
import hashLib from '../shaders/lib/hash.glsl?raw'
import noiseLib from '../shaders/lib/noise.glsl?raw'
import voronoiLib from '../shaders/lib/voronoi.glsl?raw'
import nodesLib from '../shaders/lib/nodes.glsl?raw'
import lightingLib from '../shaders/lib/lighting.glsl?raw'
import islandLib from '../shaders/lib/island.glsl?raw'
import robotFragment from '../shaders/materials/robot.frag.glsl?raw'
import terrainFragment from '../shaders/materials/terrain.frag.glsl?raw'
import splashFragment from '../shaders/materials/splash.frag.glsl?raw'
import principledFragment from '../shaders/materials/principled.frag.glsl?raw'
import emissionFragment from '../shaders/materials/emission.frag.glsl?raw'
import lensFragment from '../shaders/materials/lens.frag.glsl?raw'
import waterFragment from '../shaders/materials/water.frag.glsl?raw'
import {
  ROBOT_MATERIALS,
  TERRAIN_MATERIALS,
  PRINCIPLED_MATERIALS,
  EMISSION_MATERIALS,
  LENS,
  SKY,
  ISLAND,
  WATER
} from '../config/scene.js'
import { linearColor, nodeName } from '../utils/blender.js'

// El vertex shader también necesita el Noise de Blender (Curve Splash)
const VERTEX_SHADER = `${hashLib}\n${noiseLib}\n` + vertexShader

const FRAGMENT_PRELUDE = /* glsl */ `
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

uniform vec3 uSunDir;
uniform float uSunStrength;
uniform vec3 uWorldColor;
uniform float uTime;
uniform float uFps;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vObjB;
varying vec2 vUv;
varying float vPaintEdge;
varying float vEdgeWidth;
varying vec3 vPointNormalW;
varying vec3 vDataSurface;
varying vec3 vEdgeNoise;
varying vec3 vSelfScale;
varying vec2 vMask;

${hashLib}
${noiseLib}
${voronoiLib}
${nodesLib}
${lightingLib}
${islandLib}
`

const RAMP_INTERP = { linear: 0, ease: 1, constant: 2 }

/** Rellena una rampa a 4 paradas (el shader usa arrays de tamaño fijo) */
function rampUniforms({ pos, colors }) {
  const p = [...pos]
  const c = colors.map(linearColor)
  while (p.length < 4) {
    p.push(p[p.length - 1])
    c.push(c[c.length - 1].clone())
  }
  return { uRampPos: { value: p }, uRampCol: { value: c }, uRampCount: { value: pos.length } }
}

export default class BlenderMaterials {
  /**
   * @param {object} lighting  { sunDirection: Vector3 (hacia el sol), sunStrength, worldColor }
   */
  constructor(lighting) {
    // Uniforms compartidos por referencia entre todos los materiales
    this.shared = {
      uSunDir: { value: lighting.sunDirection.clone() },
      uSunStrength: { value: lighting.sunStrength },
      uWorldColor: { value: linearColor(lighting.worldColor) },
      uTime: { value: 0 },
      uFps: { value: lighting.fps ?? 24 },
      uIslandRadius: { value: ISLAND.radius },
      uIslandRoundness: { value: ISLAND.roundness },
      uIslandWobble: { value: ISLAND.wobble },
      uIslandSeed: { value: ISLAND.seed },
      uIslandEdge: { value: ISLAND.edge }
    }
    this.cache = new Map()
  }

  create(fragment, { defines = {}, uniforms = {}, ...options } = {}) {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_PRELUDE + fragment,
      lights: true,
      defines,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, uniforms]),
      ...options
    })
    Object.assign(material.uniforms, this.shared)
    return material
  }

  robot(name, defines, texspace) {
    const cfg = ROBOT_MATERIALS[name]
    const uniforms = {
      ...rampUniforms(cfg.ramp),
      uMetallic: { value: cfg.metallic },
      uRoughness: { value: cfg.roughness },
      uTexLoc: { value: new THREE.Vector3(...texspace.location) },
      uTexSize: { value: new THREE.Vector3(...texspace.size) },
      uEdgeLit: { value: linearColor(cfg.edgeLit) },
      uEdgeDark: { value: linearColor(cfg.edgeDark) }
    }
    if (cfg.rim) {
      defines.USE_RIM = ''
      uniforms.uRimIor = { value: cfg.rim.ior }
      uniforms.uRimLit = { value: linearColor(cfg.rim.lit) }
      uniforms.uRimDark = { value: linearColor(cfg.rim.dark) }
    }
    return this.create(robotFragment, { defines, uniforms })
  }

  terrain(name, defines) {
    const cfg = TERRAIN_MATERIALS[name]
    if (cfg.rock) defines.TERRAIN_ROCK = ''
    else defines.ISLAND_MASK = ''
    return this.create(terrainFragment, {
      defines,
      alphaToCoverage: !cfg.rock,
      uniforms: {
        ...rampUniforms(cfg.ramp),
        uRampInterp: { value: RAMP_INTERP[cfg.ramp.interp] },
        uShadowFrom: { value: cfg.shadow[0] },
        uShadowTo: { value: cfg.shadow[1] },
        uRimLit: { value: linearColor(cfg.rimLit) },
        uRimIor: { value: cfg.rimIor }
      }
    })
  }

  principled(name) {
    const cfg = PRINCIPLED_MATERIALS[name]
    return this.create(principledFragment, {
      uniforms: {
        uBaseColor: { value: linearColor(cfg.base) },
        uMetallic: { value: cfg.metallic },
        uRoughness: { value: cfg.roughness }
      }
    })
  }

  emission(name) {
    return this.create(emissionFragment, {
      uniforms: { uEmission: { value: linearColor(EMISSION_MATERIALS[name]) } }
    })
  }

  /** Lente del catalejo; necesita la rotación mundo de su malla en cada frame */
  lens(mesh) {
    const material = this.create(lensFragment, {
      uniforms: {
        uLensRot: { value: new THREE.Matrix3() },
        uLensRadius: { value: LENS.radius },
        uBulge: { value: LENS.bulge },
        uDepth: { value: LENS.depth },
        uDeep: { value: linearColor(LENS.deep) },
        uIris: { value: linearColor(LENS.iris) },
        uGlow: { value: linearColor(LENS.glow) },
        uGlowStrength: { value: LENS.glowStrength },
        uHorizon: { value: linearColor(SKY.horizon) },
        uZenith: { value: linearColor(SKY.zenith) }
      }
    })

    const x = new THREE.Vector3()
    const y = new THREE.Vector3()
    const z = new THREE.Vector3()
    const basis = new THREE.Matrix4()
    mesh.onBeforeRender = () => {
      mesh.matrixWorld.extractBasis(x, y, z)
      basis.makeBasis(x.normalize(), y.normalize(), z.normalize())
      material.uniforms.uLensRot.value.setFromMatrix4(basis)
    }
    return material
  }

  splash() {
    if (!this.cache.has('Splash')) {
      this.cache.set('Splash', this.create(splashFragment, { defines: { ISLAND_MASK: '' }, alphaToCoverage: true }))
    }
    return this.cache.get('Splash')
  }

  /** Curvas con Geometry Nodes "Curve Splash", animadas con Scene Time */
  animatedSplash(cfg, floatCurve) {
    return this.create(splashFragment, {
      defines: { SPLASH_ANIMATED: '', ISLAND_MASK: '' },
      alphaToCoverage: true,
      uniforms: {
        uSplashSpeed: { value: new THREE.Vector3(...cfg.speed) },
        uSplashScale: { value: cfg.scale },
        uSplashCurve: { value: floatCurve }
      }
    })
  }

  update(elapsedSeconds) {
    this.shared.uTime.value = elapsedSeconds
  }

  water() {
    return this.create(waterFragment, {
      defines: { ISLAND_MASK: '' },
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uShallowColor: { value: linearColor(WATER.shallow) },
        uDeepColor: { value: linearColor(WATER.deep) },
        uDiffuseAmount: { value: WATER.diffuseAmount },
        uFoamStrength: { value: WATER.foamStrength }
      }
    })
  }

  /** Recorre el glTF y sustituye cada material por su traducción a GLSL */
  apply(model, texspaceData, splashData) {
    const texspace = new Map(Object.entries(texspaceData).map(([k, v]) => [nodeName(k), v]))
    const splashCurves = new Map(Object.entries(splashData?.curves ?? {}).map(([k, v]) => [nodeName(k), v]))
    const defaultTexspace = { location: [0, 0, 0], size: [1, 1, 1] }
    const missing = new Set()

    model.traverse((mesh) => {
      if (!mesh.isMesh) return
      const name = mesh.material?.name
      const attributes = mesh.geometry.attributes
      const defines = {}
      if (attributes._paint_edge) defines.HAS_PAINT_EDGE = ''
      if (attributes._data_surface) defines.HAS_DATA_SURFACE = ''
      if (attributes._self_scale) defines.HAS_SELF_SCALE = ''

      let material = null
      if (ROBOT_MATERIALS[name]) {
        const ts = texspace.get(mesh.name) ?? texspace.get(mesh.parent?.name) ?? defaultTexspace
        material = this.robot(name, defines, ts)
      } else if (TERRAIN_MATERIALS[name]) {
        const key = `${name}:${Object.keys(defines).join(',')}`
        if (!this.cache.has(key)) this.cache.set(key, this.terrain(name, defines))
        material = this.cache.get(key)
      } else if (PRINCIPLED_MATERIALS[name]) {
        if (!this.cache.has(name)) this.cache.set(name, this.principled(name))
        material = this.cache.get(name)
      } else if (name === LENS.material) {
        material = this.lens(mesh)
      } else if (EMISSION_MATERIALS[name]) {
        if (!this.cache.has(name)) this.cache.set(name, this.emission(name))
        material = this.cache.get(name)
      } else if (name === 'Splash' && attributes._splash_base) {
        const cfg = splashCurves.get(mesh.name) ?? splashCurves.get(mesh.parent?.name)
        material = cfg ? this.animatedSplash(cfg, splashData.floatCurve) : this.splash()
        mesh.frustumCulled = false // la geometría se desplaza en el shader
        mesh.material = material
        mesh.castShadow = false    // el shadow map no vería el desplazamiento
        mesh.receiveShadow = true
        return
      } else if (name === 'Splash') {
        material = this.splash()
      } else if (name === 'Water') {
        material = this.water()
        mesh.castShadow = false
        mesh.receiveShadow = true
        mesh.renderOrder = 2
        mesh.material = material
        return
      } else {
        missing.add(name)
        return
      }

      mesh.material = material
      mesh.castShadow = name !== 'Ground'
      mesh.receiveShadow = true
    })

    if (missing.size) console.warn('[BlenderMaterials] Sin traducción:', [...missing])
  }
}
