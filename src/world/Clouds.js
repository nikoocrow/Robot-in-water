import * as THREE from 'three'
import vertexShader from '../shaders/clouds/vertex.glsl?raw'
import fragmentShader from '../shaders/clouds/fragment.glsl?raw'
import { CLOUDS, SKY, SUN_DISC } from '../config/scene.js'
import { linearColor } from '../utils/blender.js'

/** Generador determinista (mulberry32) para que las nubes salgan siempre iguales */
function seeded(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Nubes de algodón alrededor de la escena: cada nube es un racimo de esferas
 * (más grandes en el centro).
 */
export default class Clouds {
  constructor(scene, sunDirection) {
    const random = seeded(CLOUDS.seed)
    const range = ([min, max]) => min + random() * (max - min)

    const puffs = []
    for (let c = 0; c < CLOUDS.count; c++) {
      const angle = (c / CLOUDS.count) * Math.PI * 2 + range([-0.25, 0.25])
      const distance = range(CLOUDS.distance)
      const center = new THREE.Vector3(Math.cos(angle) * distance, range(CLOUDS.height), Math.sin(angle) * distance)
      const width = range(CLOUDS.size)
      const facing = angle + Math.PI / 2   // el lado largo mira hacia el centro

      const toWorld = (x, y, z) => new THREE.Vector3(x, y, z)
        .applyAxisAngle(THREE.Object3D.DEFAULT_UP, -facing)
        .add(center)

      // Cuerpo: muchas esferas medianas apiladas en una masa abombada
      const count = Math.round(range(CLOUDS.puffs))
      for (let i = 0; i < count; i++) {
        const u = range([-1, 1])
        const edge = Math.abs(u)
        const radius = width * 0.12 * (1 - edge * 0.5) * range([0.6, 1.25])
        const lift = Math.sqrt(1 - edge * edge) * width * 0.3 * Math.pow(random(), 0.7)
        puffs.push({
          position: toWorld(u * width * 0.5, lift, range([-1, 1]) * width * 0.15),
          radius,
          shade: THREE.MathUtils.clamp(lift / (width * 0.3) + 0.25, 0, 1)
        })
      }
    }

    // 20x12 basta a esta distancia: ~440 triángulos por esfera en vez de ~960
    const geometry = new THREE.SphereGeometry(1, 20, 12)
    const shade = new Float32Array(puffs.length)

    // Translúcidas y sin escribir profundidad: las esferas se funden entre sí como humo
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: sunDirection.clone().normalize() },
        uSunDiscDir: { value: new THREE.Vector3(...SUN_DISC.direction).normalize() },
        uSunColor: { value: linearColor(SUN_DISC.color) },
        uLit: { value: linearColor(CLOUDS.lit) },
        uShadow: { value: linearColor(CLOUDS.shadow) },
        uRim: { value: linearColor(CLOUDS.rim) },
        uHaze: { value: linearColor(SKY.horizon) },
        uHazeAmount: { value: CLOUDS.haze },
        uWrap: { value: CLOUDS.wrap },
        uSoftEdge: { value: CLOUDS.softEdge }
      }
    })

    this.mesh = new THREE.InstancedMesh(geometry, this.material, puffs.length)
    const matrix = new THREE.Matrix4()
    puffs.forEach((puff, i) => {
      matrix.makeScale(puff.radius, puff.radius, puff.radius).setPosition(puff.position)
      this.mesh.setMatrixAt(i, matrix)
      shade[i] = puff.shade
    })
    geometry.setAttribute('aShade', new THREE.InstancedBufferAttribute(shade, 1))

    this.mesh.frustumCulled = false
    scene.add(this.mesh)
  }

  update(elapsed) {
    this.mesh.rotation.y = elapsed * CLOUDS.drift
  }
}
