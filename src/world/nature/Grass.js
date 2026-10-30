import * as THREE from 'three'
import simplexLib from '../../shaders/lib/simplex2d.glsl?raw'
import { GRASS, TERRAIN } from '../../config/scene.js'
import { seeded } from '../../utils/random.js'

const { smoothstep } = THREE.MathUtils

/**
 * Campo de pasto con GPU instancing: una hoja de pocos vértices repetida
 * ~200 000 veces. Viento, interacción y forma se calculan en el vertex shader
 * de un MeshLambertMaterial, así hereda luces, sombras y niebla de three.
 */
export default class Grass {
  constructor(scene, debug, terrain) {
    this.terrain = terrain
    this.params = {
      count: GRASS.count,
      segments: GRASS.segments,
      baseColor: GRASS.baseColor,
      tipColor: GRASS.tipColor,
      patchColor: GRASS.patchColor
    }

    const { wind, interaction } = GRASS
    this.uniforms = {
      uTime: { value: 0 },
      uHeight: { value: GRASS.height },
      uWidth: { value: GRASS.width },
      uNormalBlend: { value: GRASS.normalBlend },
      uWindStrength: { value: wind.strength },
      uWindSpeed: { value: wind.speed },
      uWindFrequency: { value: wind.frequency },
      uWindDir: { value: new THREE.Vector2(...wind.direction).normalize() },
      uInteractPos: { value: new THREE.Vector3(0, -100, 0) },
      uInteractRadius: { value: interaction.radius },
      uInteractStrength: { value: interaction.strength },
      uBaseColor: { value: new THREE.Color(GRASS.baseColor) },
      uTipColor: { value: new THREE.Color(GRASS.tipColor) },
      uPatchColor: { value: new THREE.Color(GRASS.patchColor) },
      uPatchStrength: { value: GRASS.patchStrength }
    }

    // Objetivo de la interacción (raycast del ratón); uInteractPos lo sigue suavizado
    this.interactTarget = this.uniforms.uInteractPos.value.clone()
    this.previousTime = 0

    this.material = this.buildMaterial()
    this.group = new THREE.Group()
    this.buildChunks()
    scene.add(this.group)

    this.setupDebug(debug)
  }

  /** Una hoja: dos vértices por nivel que se estrechan hacia la punta */
  bladeGeometry(segments) {
    const positions = []
    const indices = []
    for (let i = 0; i < segments; i++) {
      const t = i / segments
      const half = 0.5 * (1 - Math.pow(t, 1.3))
      positions.push(-half, t, 0, half, t, 0)
      if (i < segments - 1) {
        const a = i * 2
        indices.push(a, a + 1, a + 3, a, a + 3, a + 2)
      }
    }
    const tip = segments * 2
    positions.push(0, 1, 0)
    indices.push(tip - 2, tip - 1, tip)
    return { positions, indices }
  }

  /**
   * Reparte las hojas en trozos de GRASS.chunk metros, cada uno con su esfera envolvente:
   * three no dibuja los que quedan fuera de cámara y los lejanos se aclaran (update)
   */
  buildChunks() {
    const { positions, indices } = this.bladeGeometry(this.params.segments)
    const blade = {
      position: new THREE.Float32BufferAttribute(positions, 3),
      // Se reemplaza en el shader; three la necesita para declarar la normal
      normal: new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3),
      index: new THREE.Uint16BufferAttribute(indices, 1)
    }

    const random = seeded(GRASS.seed)
    const max = this.params.count
    const normal = new THREE.Vector3()
    const half = TERRAIN.grassArea / 2
    const side = Math.ceil(TERRAIN.grassArea / GRASS.chunk)
    const buckets = Array.from({ length: side * side }, () => [])
    const noise = this.terrain.noise
    let count = 0

    const add = (x, z, scale) => {
      count++
      // Más bajas cerca del final del área, para que el borde no se note
      const edge = 1 - smoothstep(Math.max(Math.abs(x), Math.abs(z)), half - 6, half) * 0.7
      this.terrain.getNormal(x, z, normal)
      const ix = THREE.MathUtils.clamp(Math.floor((x + half) / GRASS.chunk), 0, side - 1)
      const iz = THREE.MathUtils.clamp(Math.floor((z + half) / GRASS.chunk), 0, side - 1)
      buckets[iz * side + ix].push([
        x, this.terrain.getHeight(x, z), z,
        random() * Math.PI * 2, scale * edge * (0.75 + random() * 0.5), 0.7 + random() * 0.6, random(),
        normal.x, normal.y, normal.z,
        // Manchas de color: ruido fijo por hoja, calculado aquí y no en cada vértice
        noise.noise(x * 0.07, z * 0.07) * 0.5 + 0.5
      ])
    }

    // Matas sueltas dentro de la tierra (≈1,2 % de las hojas)
    const tuftBlades = Math.round(max * 0.012)
    const tufts = []
    while (tufts.length < 40) {
      const x = (random() - 0.5) * TERRAIN.grassArea
      const z = (random() - 0.5) * TERRAIN.grassArea
      const mask = this.terrain.getPathMask(x, z)
      const dry = this.terrain.getHeight(x, z) > this.terrain.waterLevel(z) + 0.15
      // En el talud de la orilla colgarían como cortinas
      const flat = this.terrain.getNormal(x, z, normal).y > 0.95
      if (mask > 0.6 && dry && flat) tufts.push([x, z])
    }

    for (let i = 0; i < max - tuftBlades; i++) {
      const x = (random() - 0.5) * TERRAIN.grassArea
      const z = (random() - 0.5) * TERRAIN.grassArea
      const mask = this.terrain.getPathMask(x, z)
      if (mask > 0.55) continue
      add(x, z, 1 - smoothstep(mask, 0.05, 0.55) * 0.75)
    }
    for (let i = 0; i < tuftBlades && count < max; i++) {
      const [cx, cz] = tufts[i % tufts.length]
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * 0.55
      add(cx + Math.cos(angle) * radius, cz + Math.sin(angle) * radius, 0.55 + random() * 0.35)
    }
    this.count = count

    this.chunks = []
    for (const blades of buckets) {
      if (!blades.length) continue
      // Orden aleatorio: al dibujar solo las primeras N hojas el trozo se aclara por igual
      for (let i = blades.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[blades[i], blades[j]] = [blades[j], blades[i]]
      }

      const n = blades.length
      const offsets = new Float32Array(n * 3)
      const params = new Float32Array(n * 4)
      const normals = new Float32Array(n * 3)
      const patches = new Float32Array(n)
      const box = new THREE.Box3()
      blades.forEach((b, k) => {
        offsets.set(b.slice(0, 3), k * 3)
        params.set(b.slice(3, 7), k * 4)
        normals.set(b.slice(7, 10), k * 3)
        patches[k] = b[10]
        box.expandByPoint(normal.set(b[0], b[1], b[2]))
      })

      const geometry = new THREE.InstancedBufferGeometry()
      geometry.setAttribute('position', blade.position)
      geometry.setAttribute('normal', blade.normal)
      geometry.setIndex(blade.index)
      geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3))
      geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4))
      geometry.setAttribute('aTerrainNormal', new THREE.InstancedBufferAttribute(normals, 3))
      geometry.setAttribute('aPatch', new THREE.InstancedBufferAttribute(patches, 1))
      geometry.instanceCount = n
      // Margen para la altura de las hojas y lo que se doblan con el viento o el puntero
      geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere())
      geometry.boundingSphere.radius += 3

      const mesh = new THREE.Mesh(geometry, this.material)
      mesh.receiveShadow = true
      this.group.add(mesh)
      this.chunks.push({ mesh, total: n })
    }
  }

  buildMaterial() {
    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms)

      shader.vertexShader = /* glsl */ `
        attribute vec3 aOffset;
        attribute vec4 aParams;
        attribute vec3 aTerrainNormal;
        attribute float aPatch;
        uniform float uTime;
        uniform float uHeight;
        uniform float uWidth;
        uniform float uNormalBlend;
        uniform float uWindStrength;
        uniform float uWindSpeed;
        uniform float uWindFrequency;
        uniform vec2 uWindDir;
        uniform vec3 uInteractPos;
        uniform float uInteractRadius;
        uniform float uInteractStrength;
        varying float vH;
        varying float vRand;
        varying float vPatch;
        ${simplexLib}
      ` + shader.vertexShader
        .replace('#include <beginnormal_vertex>', /* glsl */ `
          float h = position.y;
          float angle = aParams.x;
          float height = uHeight * aParams.y;
          float width = uWidth * aParams.z;
          float rand = aParams.w;

          // Viento: ráfagas de ruido que avanzan en la dirección del viento
          float gust = snoise(aOffset.xz * uWindFrequency - uTime * uWindSpeed * uWindDir) * 0.5 + 0.5;
          vec2 bend = uWindDir * (gust * 0.9 + 0.2) * uWindStrength;
          bend += sin(uTime * 3.0 + rand * 6.2831) * 0.06 * uWindDir;

          // Interacción: se apartan del puntero
          vec2 away = aOffset.xz - uInteractPos.xz;
          float dist = length(away);
          float push = (1.0 - smoothstep(0.0, uInteractRadius, dist)) * uInteractStrength;
          bend += away / max(dist, 1e-3) * push;

          // Hoja local con una inclinación aleatoria, girada en Y
          float lean = (rand - 0.5) * 0.6;
          vec3 blade = vec3(position.x * width, h * height, h * h * lean * height);
          float c = cos(angle);
          float s = sin(angle);
          blade = vec3(blade.x * c + blade.z * s, blade.y, -blade.x * s + blade.z * c);

          // Doblado proporcional a h² (la raíz queda fija), conservando el largo
          float bendLen = min(length(bend), 1.3);
          bend = bendLen > 0.0 ? normalize(bend) * bendLen : bend;
          blade.xz += bend * h * h * height;
          blade.y -= bendLen * bendLen * h * h * height * 0.3;

          vec3 grassPos = aOffset + blade;

          // Normal casi la del terreno: sombreado suave tipo pintura, sigue las colinas
          vec3 bladeNormal = normalize(vec3(s, 0.35, c));
          vec3 objectNormal = normalize(mix(aTerrainNormal, bladeNormal, uNormalBlend));

          vH = h;
          vRand = rand;
          vPatch = aPatch;
        `)
        .replace('#include <begin_vertex>', 'vec3 transformed = grassPos;')

      shader.fragmentShader = /* glsl */ `
        uniform vec3 uBaseColor;
        uniform vec3 uTipColor;
        uniform vec3 uPatchColor;
        uniform float uPatchStrength;
        varying float vH;
        varying float vRand;
        varying float vPatch;
      ` + shader.fragmentShader
        .replace('#include <color_fragment>', /* glsl */ `
          vec3 tip = mix(uTipColor, uPatchColor, smoothstep(0.35, 0.75, vPatch) * uPatchStrength);
          diffuseColor.rgb = mix(uBaseColor, tip, smoothstep(0.0, 0.9, vH)) * (0.9 + vRand * 0.2);
        `)
        // Con DoubleSide three invierte la normal en las caras traseras: se deshace
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
          normal = normalize(vNormal);`)
    }
    material.customProgramCacheKey = () => 'grass'
    return material
  }

  rebuild() {
    for (const { mesh } of this.chunks) mesh.geometry.dispose()
    this.group.clear()
    this.buildChunks()
  }

  /** Punto del mundo que aparta el pasto (null = ninguno) */
  setInteraction(point) {
    if (point) this.interactTarget.copy(point)
    else this.interactTarget.set(0, -100, 0)
  }

  /** camera: para aclarar los trozos lejanos, que ya quedan bajo la niebla y el tilt-shift */
  update(time, camera) {
    if (camera) {
      const { near, far, min } = GRASS.lod
      for (const { mesh, total } of this.chunks) {
        const distance = camera.position.distanceTo(mesh.geometry.boundingSphere.center)
        const density = 1 - smoothstep(distance, near, far) * (1 - min)
        mesh.geometry.instanceCount = Math.ceil(total * density)
      }
    }

    const delta = Math.min(time - this.previousTime, 0.1)
    this.previousTime = time
    this.uniforms.uTime.value = time

    const current = this.uniforms.uInteractPos.value
    // Si el puntero sale del terreno, salta lejos en vez de arrastrarse por el campo
    if (this.interactTarget.y < -50 || current.y < -50) current.copy(this.interactTarget)
    else current.lerp(this.interactTarget, 1 - Math.exp(-delta * 10))
  }

  setupDebug(debug) {
    const folder = debug.folder('Pasto')
    if (!folder) return
    const u = this.uniforms

    folder.add(this.params, 'count', 10000, 400000, 10000).name('cantidad').onFinishChange(() => this.rebuild())
    folder.add(this.params, 'segments', 1, 8, 1).name('segmentos').onFinishChange(() => this.rebuild())
    folder.add(u.uHeight, 'value', 0.1, 2, 0.01).name('altura')
    folder.add(u.uWidth, 'value', 0.02, 0.4, 0.005).name('ancho')
    folder.add(u.uNormalBlend, 'value', 0, 1, 0.01).name('mezcla normales')

    const wind = folder.addFolder('Viento').close()
    const dir = { x: GRASS.wind.direction[0], z: GRASS.wind.direction[1] }
    const setDir = () => u.uWindDir.value.set(dir.x, dir.z).normalize()
    wind.add(u.uWindStrength, 'value', 0, 1.5, 0.01).name('fuerza')
    wind.add(u.uWindSpeed, 'value', 0, 2, 0.01).name('velocidad')
    wind.add(u.uWindFrequency, 'value', 0.01, 0.5, 0.005).name('frecuencia')
    wind.add(dir, 'x', -1, 1, 0.01).name('dirección x').onChange(setDir)
    wind.add(dir, 'z', -1, 1, 0.01).name('dirección z').onChange(setDir)

    const interact = folder.addFolder('Interacción').close()
    interact.add(u.uInteractRadius, 'value', 0, 5, 0.05).name('radio')
    interact.add(u.uInteractStrength, 'value', 0, 3, 0.05).name('fuerza')

    // Hex en params: el THREE.Color está en espacio lineal
    const colors = folder.addFolder('Colores').close()
    colors.addColor(this.params, 'baseColor').name('base').onChange((hex) => u.uBaseColor.value.set(hex))
    colors.addColor(this.params, 'tipColor').name('punta').onChange((hex) => u.uTipColor.value.set(hex))
    colors.addColor(this.params, 'patchColor').name('manchas').onChange((hex) => u.uPatchColor.value.set(hex))
    colors.add(u.uPatchStrength, 'value', 0, 1, 0.01).name('fuerza manchas')
  }
}
