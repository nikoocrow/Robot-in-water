import * as THREE from 'three'
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js'
import simplexLib from '../../shaders/lib/simplex2d.glsl?raw'
import { TERRAIN, RIVER, SEA } from '../../config/scene.js'
import { seeded } from '../../utils/random.js'

const { smoothstep, lerp } = THREE.MathUtils

// Caminos de tierra (polilíneas en XZ) y claros. Salen de las orillas del río
const PATHS = [
  { points: [[-8.4, -1.5], [-11, -3.2], [-13.5, -3], [-16, -4.4], [-18.5, -6.8]], width: 0.75 },
  { points: [[8.6, 3.2], [11, 4.6], [13.5, 3.8], [16, 2.2], [19, 3], [23, 1.2]], width: 0.7 }
]
const CLEARINGS = [
  { center: [-20.5, -8.5], radius: 2.8 },
  { center: [13.5, 3.8], radius: 1.6 }
]

function segmentDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax
  const dz = bz - az
  const t = THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1)
  return Math.hypot(px - ax - dx * t, pz - az - dz * t)
}

/**
 * Terreno con un río que atraviesa la isla de Blender.
 * El lecho queda por debajo del agua y el material lo descarta: por ahí se ve
 * el agua que dibuja el shader del cielo (Sky.js), con la orilla y la espuma.
 */
export default class Terrain {
  constructor(scene, debug) {
    this.noise = new SimplexNoise({ random: seeded(TERRAIN.seed) })
    this.size = TERRAIN.size

    for (const path of PATHS) {
      const xs = path.points.map((p) => p[0])
      const zs = path.points.map((p) => p[1])
      const pad = path.width + 1.5
      path.box = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...zs) - pad, Math.max(...zs) + pad]
    }

    this.uniforms = {
      uPathMask: { value: this.bakePathMask() },
      uSize: { value: this.size },
      uGrassArea: { value: TERRAIN.grassArea },
      uRiverLevel: { value: new THREE.Vector2(SEA.level, RIVER.lowLevel) },
      uRiverStep: { value: new THREE.Vector2(...RIVER.step) },
      uGrassColor: { value: new THREE.Color(TERRAIN.grassColor) },
      uFarGrassColor: { value: new THREE.Color(TERRAIN.farGrassColor) },
      uDirtColor: { value: new THREE.Color(TERRAIN.dirtColor) },
      uDirtLightColor: { value: new THREE.Color(TERRAIN.dirtLightColor) }
    }

    // Dos materiales: el suelo seco, opaco puro, y la franja de la orilla, que recorta
    // lo que queda bajo el agua (discard impide a la GPU descartar lo oculto antes de pintarlo)
    this.mesh = new THREE.Mesh(this.buildGeometry(), [this.buildMaterial(false), this.buildMaterial(true)])
    this.mesh.receiveShadow = true
    scene.add(this.mesh)

    this.setupDebug(debug)
  }

  // ---------------------------------------------------------------- río

  /** Distancia del borde del cauce a la línea del agua (donde el talud cruza el nivel) */
  get waterlineOffset() {
    // El talud baja (ribera - lecho) en `bank` metros con un smoothstep: se resuelve una vez
    const [bankHeight] = RIVER.floodplain
    const target = 1 - bankHeight / (bankHeight + RIVER.depth)
    let lo = 0
    let hi = 1
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (smoothstep(mid, 0, 1) < target) lo = mid
      else hi = mid
    }
    return lo * RIVER.bank
  }

  /** Nivel del agua: salta del de atrás al de delante, como el agua de la isla */
  waterLevel(z) {
    return lerp(SEA.level, RIVER.lowLevel, smoothstep(z, RIVER.step[0], RIVER.step[1]))
  }

  /** Centro del cauce en x y su pendiente dx/dz. Recto junto a la isla, serpentea lejos */
  riverCenter(z) {
    const [a, b] = RIVER.meander
    const fade = smoothstep(Math.abs(z), 6, 20)
    const wave = Math.sin(z * 0.075 + 0.6) * a + Math.sin(z * 0.16 + 2.0) * b
    const slope = Math.cos(z * 0.075 + 0.6) * a * 0.075 + Math.cos(z * 0.16 + 2.0) * b * 0.16
    return { x: wave * fade, slope: slope * fade }
  }

  /** Distancia (aprox. perpendicular) al borde del cauce: negativa dentro */
  riverDistance(x, z) {
    const { x: cx, slope } = this.riverCenter(z)
    const width = lerp(RIVER.poolWidth, RIVER.width, smoothstep(Math.abs(z), RIVER.narrow[0], RIVER.narrow[1]))
      + this.noise.noise(z * 0.05, 7.3) * 0.6
    const across = Math.abs(x - cx) / Math.sqrt(1 + slope * slope)
    return across - width + this.noise.noise(x * 0.15, z * 0.15) * 0.35
  }

  // ---------------------------------------------------------------- campo

  getHeight(x, z) {
    const n = this.noise
    let height = 1.0
      + (n.noise(x * 0.035, z * 0.035) * 0.5 + 0.5) * 2.6
      + n.noise(x * 0.105, z * 0.105) * 0.39

    const river = this.riverDistance(x, z)

    // Ribera baja junto al río; el relieve vuelve poco a poco al alejarse
    const [bankHeight, plainWidth] = RIVER.floodplain
    height = lerp(this.waterLevel(z) + bankHeight, height, smoothstep(river, RIVER.bank, plainWidth))

    // Colinas en el borde para que no se vea el final del mundo, abiertas donde pasa el río
    const rim = TERRAIN.rim
    const valley = 1 - smoothstep(Math.max(river, 0), 0, 14)
    height += smoothstep(Math.hypot(x, z), rim.from, rim.to) ** 1.5 * rim.height * (1 - valley * 0.9)

    // Cauce: el lecho queda por debajo del agua
    const channel = 1 - smoothstep(river, 0, RIVER.bank)
    return lerp(height, this.waterLevel(z) - RIVER.depth, channel)
  }

  getNormal(x, z, target = new THREE.Vector3()) {
    const e = 0.1
    return target.set(
      this.getHeight(x - e, z) - this.getHeight(x + e, z),
      2 * e,
      this.getHeight(x, z - e) - this.getHeight(x, z + e)
    ).normalize()
  }

  /** 0 = pasto, 1 = tierra (orillas, caminos y claros) */
  getPathMask(x, z) {
    const wobble = this.noise.noise(x * 0.3, z * 0.3) * 0.4

    const river = this.riverDistance(x, z) - RIVER.bank + wobble
    let mask = 1 - smoothstep(river, RIVER.sand[0], RIVER.sand[1])

    for (const path of PATHS) {
      const [x0, x1, z0, z1] = path.box
      if (x < x0 || x > x1 || z < z0 || z > z1) continue
      let d = Infinity
      for (let i = 0; i < path.points.length - 1; i++) {
        const [ax, az] = path.points[i]
        const [bx, bz] = path.points[i + 1]
        d = Math.min(d, segmentDistance(x, z, ax, az, bx, bz))
      }
      mask = Math.max(mask, 1 - smoothstep(d + wobble, path.width * 0.7, path.width * 1.5))
    }

    for (const { center, radius } of CLEARINGS) {
      const d = Math.hypot(x - center[0], z - center[1])
      mask = Math.max(mask, 1 - smoothstep(d + wobble * 1.5, radius - 0.8, radius + 0.6))
    }
    return mask
  }

  // ---------------------------------------------------------------- malla

  /**
   * Máscara en un DataTexture indexado por coordenadas de mundo: uv = xz / size + 0.5.
   * R = getPathMask; G = distancia al borde del cauce hacia dentro (-1..10 m), para la orilla del agua
   */
  bakePathMask() {
    const res = TERRAIN.maskResolution
    const data = new Uint8Array(res * res * 4)
    for (let j = 0; j < res; j++) {
      const z = ((j + 0.5) / res - 0.5) * this.size
      for (let i = 0; i < res; i++) {
        const x = ((i + 0.5) / res - 0.5) * this.size
        const k = (j * res + i) * 4
        data[k] = Math.round(this.getPathMask(x, z) * 255)
        data[k + 1] = Math.round(THREE.MathUtils.clamp((1 - this.riverDistance(x, z)) / 11, 0, 1) * 255)
        data[k + 3] = 255
      }
    }
    const texture = new THREE.DataTexture(data, res, res, THREE.RGBAFormat)
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearFilter
    texture.needsUpdate = true
    return texture
  }

  buildGeometry() {
    const segments = TERRAIN.segments
    const geometry = new THREE.PlaneGeometry(this.size, this.size, segments, segments)
    geometry.rotateX(-Math.PI / 2)

    const position = geometry.attributes.position
    // Altura de cada vértice respecto al agua
    const aboveWater = new Float32Array(position.count)
    for (let i = 0; i < position.count; i++) {
      const z = position.getZ(i)
      const y = this.getHeight(position.getX(i), z)
      position.setY(i, y)
      aboveWater[i] = y - this.waterLevel(z)
    }
    geometry.computeVertexNormals()

    // Los triángulos enteros bajo el agua no se ven: fuera. Los que cruzan el nivel van
    // al grupo con recorte; el resto, al opaco
    const index = geometry.index.array
    const dry = []
    const bank = []
    for (let i = 0; i < index.length; i += 3) {
      const a = aboveWater[index[i]]
      const b = aboveWater[index[i + 1]]
      const c = aboveWater[index[i + 2]]
      if (Math.max(a, b, c) <= 0) continue
      ;(Math.min(a, b, c) < 0 ? bank : dry).push(index[i], index[i + 1], index[i + 2])
    }
    geometry.setIndex([...dry, ...bank])
    geometry.addGroup(0, dry.length, 0)
    geometry.addGroup(dry.length, bank.length, 1)
    geometry.computeBoundingSphere()
    return geometry
  }

  /** clip: descarta lo que queda bajo el agua (solo en la franja de la orilla) */
  buildMaterial(clip) {
    const material = new THREE.MeshLambertMaterial()
    if (clip) material.defines = { WATER_CLIP: '' }
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms)

      shader.vertexShader = 'varying vec3 vGroundPos;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      )

      shader.fragmentShader = /* glsl */ `
        uniform sampler2D uPathMask;
        uniform float uSize;
        uniform float uGrassArea;
        uniform vec2 uRiverLevel;
        uniform vec2 uRiverStep;
        uniform vec3 uGrassColor;
        uniform vec3 uFarGrassColor;
        uniform vec3 uDirtColor;
        uniform vec3 uDirtLightColor;
        varying vec3 vGroundPos;
        ${simplexLib}
      ` + shader.fragmentShader.replace(
        '#include <color_fragment>',
        /* glsl */ `
        // Bajo el agua no se dibuja: ahí se ve el río del shader del cielo
        float waterLevel = mix(uRiverLevel.x, uRiverLevel.y, smoothstep(uRiverStep.x, uRiverStep.y, vGroundPos.z));
        #ifdef WATER_CLIP
          if (vGroundPos.y < waterLevel) discard;
        #endif

        float mask = texture2D(uPathMask, vGroundPos.xz / uSize + 0.5).r;
        float broad = snoise(vGroundPos.xz * 0.35) * 0.5 + 0.5;
        float fine = snoise(vGroundPos.xz * 1.7);

        // Fuera del área con pasto el suelo toma el tono medio de las hojas
        float far = smoothstep(uGrassArea * 0.5 - 6.0, uGrassArea * 0.5, max(abs(vGroundPos.x), abs(vGroundPos.z)));
        vec3 grass = mix(uGrassColor, uFarGrassColor, far) * (0.9 + broad * 0.2);
        vec3 dirt = mix(uDirtColor, uDirtLightColor, broad);
        vec3 ground = mix(grass, dirt, smoothstep(0.35, 0.65, mask + fine * 0.08));

        // Tierra mojada junto al agua
        float wet = 1.0 - smoothstep(0.0, 0.2, vGroundPos.y - waterLevel);
        diffuseColor.rgb = ground * mix(1.0, 0.6, wet);
        `
      )
    }
    material.customProgramCacheKey = () => (clip ? 'terrain-clip' : 'terrain')
    return material
  }

  /** Primer punto del rayo que toca el terreno o el agua (marcha + bisección) */
  raycast(ray, maxDistance = 120) {
    const point = new THREE.Vector3()
    const below = (t) => {
      ray.at(t, point)
      return point.y < Math.max(this.getHeight(point.x, point.z), this.waterLevel(point.z))
    }
    if (below(0)) return null

    let previous = 0
    for (let t = 0.25; t <= maxDistance; t += 0.25 + t * 0.02) {
      if (!below(t)) {
        previous = t
        continue
      }
      let lo = previous
      let hi = t
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2
        if (below(mid)) hi = mid
        else lo = mid
      }
      return ray.at(hi, point)
    }
    return null
  }

  setupDebug(debug) {
    const folder = debug.folder('Terreno')
    if (!folder) return
    const params = {
      grass: TERRAIN.grassColor,
      farGrass: TERRAIN.farGrassColor,
      dirt: TERRAIN.dirtColor,
      dirtLight: TERRAIN.dirtLightColor
    }
    const color = (key, uniform, name) =>
      folder.addColor(params, key).name(name).onChange((hex) => this.uniforms[uniform].value.set(hex))
    color('grass', 'uGrassColor', 'pasto')
    color('farGrass', 'uFarGrassColor', 'pasto lejano')
    color('dirt', 'uDirtColor', 'tierra')
    color('dirtLight', 'uDirtLightColor', 'tierra clara')
  }
}
