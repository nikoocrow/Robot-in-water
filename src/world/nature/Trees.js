import * as THREE from 'three'
import { TREES } from '../../config/scene.js'
import { seeded } from '../../utils/random.js'

const CANOPY_Y = 4.4

/** Hoja para el alphaMap: hojas puntiagudas que salen del centro, blanco sobre transparente */
function leafTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.translate(64, 64)
  for (let i = 0; i < 7; i++) {
    ctx.save()
    ctx.rotate((i / 7) * Math.PI * 2 + (i % 2) * 0.2)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(22, -24, 0, -60)
    ctx.quadraticCurveTo(-22, -24, 0, 0)
    ctx.fill()
    ctx.restore()
  }
  ctx.beginPath()
  ctx.arc(0, 0, 26, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.NoColorSpace
  return texture
}

/** Rampa toon de 3 pasos */
function gradientMap() {
  const texture = new THREE.DataTexture(new Uint8Array([55, 135, 255]), 3, 1, THREE.RedFormat)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

/**
 * Árboles "fluffy": tronco toon y una copa de cientos de quads que miran
 * a la cámara (billboard en view space). La normal de cada hoja apunta desde el
 * centro de la copa, así la luz sombrea la nube entera como una esfera blanda.
 */
export default class Trees {
  constructor(scene, debug, terrain) {
    this.random = seeded(TREES.seed)
    this.params = { leafColor: TREES.leafColor, trunkColor: TREES.trunkColor }

    this.uniforms = {
      uTime: { value: 0 },
      uSway: { value: TREES.sway },
      uLeafSize: { value: TREES.leafSize }
    }

    const alphaMap = leafTexture()
    this.leafMaterial = new THREE.MeshToonMaterial({
      color: TREES.leafColor,
      alphaMap,
      alphaTest: TREES.alphaTest,
      side: THREE.DoubleSide,
      vertexColors: true,
      gradientMap: gradientMap()
    })
    // Sombra con forma de hojas: el mismo billboard, visto desde la luz
    this.depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      alphaMap,
      alphaTest: TREES.alphaTest
    })
    for (const material of [this.leafMaterial, this.depthMaterial]) {
      material.onBeforeCompile = (shader) => this.patchLeafShader(shader)
      material.customProgramCacheKey = () => 'fluffy-leaves'
    }

    this.trunkMaterial = new THREE.MeshToonMaterial({ color: TREES.trunkColor, gradientMap: this.leafMaterial.gradientMap })

    this.group = new THREE.Group()
    for (const [x, z] of TREES.spots) {
      if (terrain.getPathMask(x, z) >= 0.2) console.warn(`[Trees] (${x}, ${z}) está sobre un camino`)
      this.group.add(this.buildTree({ x, z }, terrain))
    }
    scene.add(this.group)

    this.setupDebug(debug)
  }

  buildTree({ x, z }, terrain) {
    const random = this.random
    const tree = new THREE.Group()
    tree.position.set(x, terrain.getHeight(x, z) - 0.1, z)
    tree.scale.setScalar(1.15 + random() * 0.35)
    tree.rotation.y = random() * Math.PI * 2

    // Tronco y dos ramas cortas inclinadas hacia la copa
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.32, 3.4, 8), this.trunkMaterial)
    trunk.position.y = 1.7
    tree.add(trunk)
    for (const side of [-1, 1]) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.3, 6), this.trunkMaterial)
      branch.position.set(side * 0.35, 2.9 + random() * 0.3, (random() - 0.5) * 0.3)
      branch.rotation.z = -side * (0.6 + random() * 0.25)
      tree.add(branch)
    }
    for (const mesh of tree.children) mesh.castShadow = true

    const canopy = new THREE.Mesh(this.canopyGeometry(), this.leafMaterial)
    canopy.castShadow = true
    // Con billboard la sombra se muestrearía en el centro del quad: no recibe
    canopy.receiveShadow = false
    canopy.customDepthMaterial = this.depthMaterial
    tree.add(canopy)
    return tree
  }

  canopyGeometry() {
    const random = this.random
    const center = new THREE.Vector3(0, CANOPY_Y, 0)

    // Esfera principal + satélites: silueta irregular
    const spheres = [{ center: center.clone(), radius: 1.7 }]
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + random() * 0.6
      const radius = 0.9 + random() * 0.5
      const offset = new THREE.Vector3(Math.cos(angle), (random() - 0.35) * 0.9, Math.sin(angle))
        .multiplyScalar(1.7 + radius * 0.25 - 0.5)
      spheres.push({ center: center.clone().add(offset), radius })
    }

    const positions = []
    const normals = []
    const colors = []
    const uvs = []
    const leaves = []
    const indices = []
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]]
    const dir = new THREE.Vector3()
    const fromSphere = new THREE.Vector3()
    const fromCenter = new THREE.Vector3()
    const point = new THREE.Vector3()

    for (const sphere of spheres) {
      const count = Math.round(sphere.radius * sphere.radius * 55)
      for (let i = 0; i < count; i++) {
        const y = random() * 2 - 1
        const theta = random() * Math.PI * 2
        dir.set(Math.cos(theta), 0, Math.sin(theta)).multiplyScalar(Math.sqrt(1 - y * y)).setY(y)
        const r = sphere.radius * Math.cbrt(0.35 + random() * 0.65)
        point.copy(sphere.center).addScaledVector(dir, r)

        fromCenter.subVectors(point, center).normalize()
        fromSphere.subVectors(point, sphere.center).normalize()
        const normal = fromCenter.lerp(fromSphere, 0.35).normalize()

        // AO falso: más oscuro adentro y abajo
        const depth = point.distanceTo(center) / 2.6
        const ao = THREE.MathUtils.clamp(0.4 + depth * 0.5 + (point.y - center.y) * 0.18, 0.4, 1.1)
        const leaf = [random() * Math.PI * 2, 0.8 + random() * 0.6, random() * Math.PI * 2]

        const base = positions.length / 3
        for (const [u, v] of corners) {
          positions.push(point.x, point.y, point.z)
          normals.push(normal.x, normal.y, normal.z)
          colors.push(ao, ao, ao)
          uvs.push(u, v)
          leaves.push(...leaf)
        }
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setAttribute('aLeaf', new THREE.Float32BufferAttribute(leaves, 3))
    geometry.setIndex(indices)
    // Los quads se expanden en el shader
    geometry.computeBoundingSphere()
    geometry.boundingSphere.radius += 1.5
    return geometry
  }

  patchLeafShader(shader) {
    Object.assign(shader.uniforms, this.uniforms)
    shader.vertexShader = /* glsl */ `
      attribute vec3 aLeaf;
      uniform float uTime;
      uniform float uSway;
      uniform float uLeafSize;
    ` + shader.vertexShader
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        // Balanceo: más arriba, más se mueve. Cada árbol con su fase
        float treePhase = modelMatrix[3].x * 0.37;
        float swayT = uTime * 1.6 + aLeaf.z + transformed.y * 0.8 + treePhase;
        transformed.x += sin(swayT) * uSway * transformed.y;
        transformed.z += cos(swayT * 0.8) * uSway * 0.6 * transformed.y;
      `)
      .replace('#include <project_vertex>', /* glsl */ `
        // Billboard en view space: el quad siempre mira a la cámara (o a la luz)
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        vec2 corner = (uv - 0.5) * uLeafSize * aLeaf.y;
        float lc = cos(aLeaf.x);
        float ls = sin(aLeaf.x);
        mvPosition.xy += vec2(corner.x * lc - corner.y * ls, corner.x * ls + corner.y * lc);
        gl_Position = projectionMatrix * mvPosition;
      `)
  }

  update(time) {
    this.uniforms.uTime.value = time
  }

  setupDebug(debug) {
    const folder = debug.folder('Árboles')
    if (!folder) return
    folder.addColor(this.params, 'leafColor').name('hojas').onChange((hex) => this.leafMaterial.color.set(hex))
    folder.addColor(this.params, 'trunkColor').name('tronco').onChange((hex) => this.trunkMaterial.color.set(hex))
    folder.add(this.uniforms.uLeafSize, 'value', 0.2, 2, 0.01).name('tamaño hoja')
    folder.add(this.uniforms.uSway, 'value', 0, 0.1, 0.001).name('balanceo')
    folder.add(this.leafMaterial, 'alphaTest', 0, 1, 0.01).name('alphaTest').onChange((value) => {
      this.depthMaterial.alphaTest = value
      this.leafMaterial.needsUpdate = true
      this.depthMaterial.needsUpdate = true
    })
  }
}
