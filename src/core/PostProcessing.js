import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { POST } from '../config/scene.js'

const TONE_MAPPINGS = {
  None: THREE.NoToneMapping,
  Linear: THREE.LinearToneMapping,
  Reinhard: THREE.ReinhardToneMapping,
  ACES: THREE.ACESFilmicToneMapping,
  AgX: THREE.AgXToneMapping,
  Neutral: THREE.NeutralToneMapping
}

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Gaussiana separable de 13 taps; el radio crece lejos de la franja nítida
const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    uDirection: { value: new THREE.Vector2(1, 0) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: POST.tiltShift.focus },
    uRange: { value: POST.tiltShift.range },
    uFeather: { value: POST.tiltShift.feather },
    uBlur: { value: POST.tiltShift.blur }
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uDirection;
    uniform vec2 uResolution;
    uniform float uFocus;
    uniform float uRange;
    uniform float uFeather;
    uniform float uBlur;
    varying vec2 vUv;

    void main() {
      float amount = smoothstep(uRange, uRange + uFeather, abs(vUv.y - uFocus)) * uBlur;
      if (amount < 0.01) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }
      vec2 stepUv = uDirection * amount / uResolution;
      vec4 sum = vec4(0.0);
      float total = 0.0;
      for (int i = -6; i <= 6; i++) {
        float w = exp(-float(i * i) / 18.0);
        sum += texture2D(tDiffuse, vUv + stepUv * float(i)) * w;
        total += w;
      }
      gl_FragColor = sum / total;
    }
  `
}

// Aberración, color, viñeta y grano. Ya en espacio de display (después del OutputPass)
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uAberration: { value: 0 },
    uTint: { value: new THREE.Color() },
    uBrightness: { value: 0 },
    uContrast: { value: 1 },
    uSaturation: { value: 1 },
    uVignette: { value: 0 },
    uVignetteSoftness: { value: 0.5 },
    uVignetteColor: { value: new THREE.Color() },
    uGrain: { value: 0 }
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uAberration;
    uniform vec3 uTint;
    uniform float uBrightness;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uVignette;
    uniform float uVignetteSoftness;
    uniform vec3 uVignetteColor;
    uniform float uGrain;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      vec2 offset = centered * uAberration * length(centered) * 4.0;
      vec3 color = vec3(
        texture2D(tDiffuse, vUv + offset).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - offset).b
      );

      color *= uTint;
      color += uBrightness;
      color = (color - 0.5) * uContrast + 0.5;
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, uSaturation);

      float edge = length(centered) * 1.41421;
      float vignette = smoothstep(1.0 - uVignetteSoftness, 1.0, edge) * uVignette;
      color = mix(color, uVignetteColor, vignette);

      color += (hash(vUv * uResolution + fract(uTime) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `
}

/**
 * Render en HDR (half float + MSAA) -> bloom -> tone mapping y sRGB (OutputPass)
 * -> tilt-shift en dos pasadas -> aberración, color, viñeta y grano.
 */
export default class PostProcessing {
  constructor(renderer, scene, camera, debug) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.enabled = true
    // Lo que cambia entre escenarios se aplica con setScenario
    this.params = { toneMapping: 'None', tiltShift: true }

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(renderer, target)
    this.composer.addPass(new RenderPass(scene, camera))

    const { tiltShift, color } = POST
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, 0, 0)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    // Los dos pases comparten los parámetros (mismos objetos uniform)
    this.tiltX = new ShaderPass(TiltShiftShader)
    this.tiltY = new ShaderPass(TiltShiftShader)
    this.tiltY.uniforms = {
      ...this.tiltX.uniforms,
      tDiffuse: { value: null },
      uDirection: { value: new THREE.Vector2(0, 1) }
    }
    this.tiltY.material.uniforms = this.tiltY.uniforms
    this.params.tiltShift = tiltShift.enabled
    this.composer.addPass(this.tiltX)
    this.composer.addPass(this.tiltY)

    this.final = new ShaderPass(FinalShader)
    const u = this.final.uniforms
    u.uAberration.value = color.aberration
    u.uSaturation.value = color.saturation
    u.uContrast.value = color.contrast
    u.uBrightness.value = color.brightness
    u.uVignette.value = color.vignette
    u.uVignetteSoftness.value = color.vignetteSoftness
    u.uGrain.value = color.grain
    this.colors = { tint: color.tint, vignetteColor: color.vignetteColor }
    this.setDisplayColor(u.uTint, color.tint)
    this.setDisplayColor(u.uVignetteColor, color.vignetteColor)
    this.composer.addPass(this.final)

    this.setupDebug(debug)
  }

  /** Tone mapping, exposición, bloom y si hay tilt-shift y pase de color (SCENARIOS[x].post) */
  setScenario({ toneMapping, exposure, bloom, effects }) {
    this.params.toneMapping = toneMapping
    this.renderer.toneMapping = TONE_MAPPINGS[toneMapping]
    this.renderer.toneMappingExposure = exposure
    this.bloom.strength = bloom.strength
    this.bloom.radius = bloom.radius
    this.bloom.threshold = bloom.threshold
    this.effects = effects
    this.final.enabled = effects
    this.setTiltShift(this.params.tiltShift)
  }

  setTiltShift(enabled) {
    this.params.tiltShift = enabled
    this.tiltX.enabled = this.tiltY.enabled = enabled && this.effects
  }

  /** Ya estamos en espacio de display: el hex se carga tal cual, sin pasar a lineal */
  setDisplayColor(uniform, hex) {
    uniform.value.setStyle(hex, THREE.LinearSRGBColorSpace)
  }

  /** Muestras MSAA del render target de la escena */
  setSamples(samples) {
    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (target.samples === samples) continue
      target.samples = samples
      target.dispose() // three lo recrea con las nuevas muestras en el siguiente uso
    }
  }

  /** Llamar después de renderer.setSize: el composer trabaja al tamaño del drawing buffer */
  resize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    this.composer.setPixelRatio(1)
    this.composer.setSize(size.x, size.y)
    this.tiltX.uniforms.uResolution.value.copy(size)
    this.final.uniforms.uResolution.value.copy(size)
  }

  render(time) {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera)
      return
    }
    this.final.uniforms.uTime.value = time
    this.composer.render()
  }

  setupDebug(debug) {
    const folder = debug.folder('Postprocesado')
    if (!folder) return
    folder.add(this, 'enabled').name('activado')
    folder.add(this.params, 'toneMapping', Object.keys(TONE_MAPPINGS)).name('tone mapping')
      .onChange((name) => { this.renderer.toneMapping = TONE_MAPPINGS[name] })
    folder.add(this.renderer, 'toneMappingExposure', 0, 3, 0.01).name('exposición')

    const bloom = folder.addFolder('Bloom').close()
    bloom.add(this.bloom, 'enabled').name('activado')
    bloom.add(this.bloom, 'strength', 0, 3, 0.01).name('fuerza')
    bloom.add(this.bloom, 'radius', 0, 1.5, 0.01).name('radio')
    bloom.add(this.bloom, 'threshold', 0, 3, 0.01).name('umbral')

    const tilt = folder.addFolder('Tilt-shift').close()
    const tu = this.tiltX.uniforms
    // En el mar no hay tilt-shift aunque esté activado
    tilt.add(this.params, 'tiltShift').name('activado').onChange((on) => this.setTiltShift(on))
    tilt.add(tu.uFocus, 'value', 0, 1, 0.01).name('foco')
    tilt.add(tu.uRange, 'value', 0, 0.5, 0.01).name('zona nítida')
    tilt.add(tu.uFeather, 'value', 0.01, 1, 0.01).name('suavizado')
    tilt.add(tu.uBlur, 'value', 0, 6, 0.05).name('blur')

    const color = folder.addFolder('Color').close()
    const u = this.final.uniforms
    color.add(this.final, 'enabled').name('activado')
    color.add(u.uAberration, 'value', 0, 0.01, 0.0001).name('aberración')
    color.add(u.uSaturation, 'value', 0, 2, 0.01).name('saturación')
    color.add(u.uContrast, 'value', 0.5, 1.5, 0.01).name('contraste')
    color.add(u.uBrightness, 'value', -0.3, 0.3, 0.005).name('brillo')
    color.addColor(this.colors, 'tint').name('tinte').onChange((hex) => this.setDisplayColor(u.uTint, hex))
    color.add(u.uVignette, 'value', 0, 1, 0.01).name('viñeta')
    color.add(u.uVignetteSoftness, 'value', 0.01, 1, 0.01).name('suavidad')
    color.addColor(this.colors, 'vignetteColor').name('color viñeta')
      .onChange((hex) => this.setDisplayColor(u.uVignetteColor, hex))
    color.add(u.uGrain, 'value', 0, 0.2, 0.001).name('grano')
  }
}
