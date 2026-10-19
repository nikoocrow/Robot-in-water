import * as THREE from 'three'
import { vectorFromBlender } from '../utils/blender.js'

/**
 * Reimplementación del emisor de partículas "splash" (Plane.001 -> Icosphere).
 * Blender: emite desde las caras, velocidad por normal + aleatoria,
 * vida corta y sin gravedad. Aquí se simula en CPU con un InstancedMesh.
 */
export default class Droplets {
  constructor(scene, material, config) {
    this.config = config
    this.triangles = this.buildTriangles(config.faces)
    this.totalArea = this.triangles.reduce((sum, t) => sum + t.area, 0)

    this.capacity = Math.ceil(config.countPerSecond * config.lifetimeSeconds * 1.5) + 16
    this.particles = []
    this.spawnAccumulator = 0

    const geometry = new THREE.IcosahedronGeometry(1, 1)
    this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
    this.mesh.castShadow = true
    scene.add(this.mesh)

    this.dummy = new THREE.Object3D()
  }

  buildTriangles(faces) {
    const triangles = []
    for (const face of faces) {
      const v = face.verts.map(vectorFromBlender)
      const normal = vectorFromBlender(face.normal).normalize()
      for (let i = 1; i < v.length - 1; i++) {
        const a = v[0], b = v[i], c = v[i + 1]
        const area = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2
        triangles.push({ a, b, c, normal, area })
      }
    }
    return triangles
  }

  randomPointOnSurface() {
    let r = Math.random() * this.totalArea
    let tri = this.triangles[0]
    for (const t of this.triangles) {
      r -= t.area
      if (r <= 0) { tri = t; break }
    }
    let u = Math.random()
    let v = Math.random()
    if (u + v > 1) { u = 1 - u; v = 1 - v }
    const point = tri.a.clone()
      .addScaledVector(new THREE.Vector3().subVectors(tri.b, tri.a), u)
      .addScaledVector(new THREE.Vector3().subVectors(tri.c, tri.a), v)
    return { point, normal: tri.normal }
  }

  spawn() {
    const c = this.config
    const { point, normal } = this.randomPointOnSurface()
    const randomDir = new THREE.Vector3().randomDirection()
    const velocity = normal.clone().multiplyScalar(c.normalSpeed)
      .addScaledVector(randomDir, c.randomSpeed * Math.random())

    this.particles.push({
      position: point,
      velocity,
      age: 0,
      life: c.lifetimeSeconds * (1 - c.lifetimeRandom * Math.random()),
      size: c.size * (1 - c.sizeRandom * Math.random())
    })
  }

  update(delta) {
    const dt = Math.min(delta, 0.05)

    this.spawnAccumulator += this.config.countPerSecond * dt
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1
      if (this.particles.length < this.capacity) this.spawn()
    }

    let index = 0
    for (const p of this.particles) {
      p.age += dt
      if (p.age >= p.life) continue
      p.position.addScaledVector(p.velocity, dt)

      this.dummy.position.copy(p.position)
      this.dummy.scale.setScalar(p.size * 0.5) // size es el diámetro; la geometría tiene radio 1
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(index, this.dummy.matrix)
      this.particles[index++] = p
    }
    this.particles.length = index

    this.mesh.count = index
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
