import * as THREE from 'three'
import { CONFETTI } from '../../config/scene.js'
import { seeded } from '../../utils/random.js'

/** Confeti morado y amarillo flotando: cuadrados que derivan en x y giran */
export default class Confetti {
  constructor(scene, debug) {
    const random = seeded(CONFETTI.seed)
    const count = CONFETTI.count
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const palette = CONFETTI.colors.map((hex) => new THREE.Color(hex))
    const [low, high] = CONFETTI.height

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() - 0.5) * CONFETTI.area
      positions[i * 3 + 1] = low + random() * (high - low)
      positions[i * 3 + 2] = (random() - 0.5) * CONFETTI.area
      palette[i % palette.length].toArray(colors, i * 3)
      seeds[i] = random()
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uArea: { value: CONFETTI.area },
        uSize: { value: CONFETTI.size },
        uPixelRatio: { value: 1 }
      },
      vertexShader: /* glsl */ `
        attribute vec3 color;
        attribute float aSeed;
        uniform float uTime;
        uniform float uArea;
        uniform float uSize;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAngle;

        void main() {
          vec3 p = position;
          // Deriva en x y vuelve a entrar por el otro lado
          p.x = mod(p.x + uTime * (0.3 + aSeed * 0.4) + uArea * 0.5, uArea) - uArea * 0.5;
          p.y += sin(uTime * (0.6 + aSeed) + aSeed * 40.0) * 0.4;
          p.z += cos(uTime * 0.5 + aSeed * 20.0) * 0.3;

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed * 0.6) / -mvPosition.z;
          vColor = color;
          vAngle = uTime * (1.0 + aSeed * 2.0) + aSeed * 6.2831;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAngle;

        void main() {
          // Cuadrado girando dentro del punto, aplastado como un papel que voltea
          vec2 uv = gl_PointCoord - 0.5;
          float c = cos(vAngle);
          float s = sin(vAngle);
          uv = mat2(c, -s, s, c) * uv;
          uv.y /= max(abs(sin(vAngle * 0.7)), 0.25);
          if (abs(uv.x) > 0.3 || abs(uv.y) > 0.3) discard;
          gl_FragColor = vec4(vColor, 1.0);
          #include <colorspace_fragment>
        }
      `
    })

    this.points = new THREE.Points(geometry, this.material)
    this.points.frustumCulled = false
    scene.add(this.points)

    const folder = debug.folder('Confeti')
    if (!folder) return
    folder.add(this.points, 'visible').name('visible')
    folder.add(this.material.uniforms.uSize, 'value', 2, 80, 1).name('tamaño')
  }

  setPixelRatio(pixelRatio) {
    this.material.uniforms.uPixelRatio.value = pixelRatio
  }

  update(time) {
    this.material.uniforms.uTime.value = time
  }
}
