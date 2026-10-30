import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
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

// Gaussiana de 13 taps; el radio crece lejos de la franja nítida
const TILT_SHIFT = /* glsl */ `
  uniform float uFocus;
  uniform float uRange;
  uniform float uFeather;
  uniform float uBlur;

  float tiltAmount(vec2 uv) {
    return smoothstep(uRange, uRange + uFeather, abs(uv.y - uFocus)) * uBlur;
  }

  vec3 tiltBlur(sampler2D map, vec2 uv, vec2 stepUv) {
    vec3 sum = vec3(0.0);
    float total = 0.0;
    for (int i = -6; i <= 6; i++) {
      float w = exp(-float(i * i) / 18.0);
      sum += texture2D(map, uv + stepUv * float(i)).rgb * w;
      total += w;
    }
    return sum / total;
  }
`

const tiltUniforms = () => ({
  uFocus: { value: POST.tiltShift.focus },
  uRange: { value: POST.tiltShift.range },
  uFeather: { value: POST.tiltShift.feather },
  uBlur: { value: POST.tiltShift.blur }
})

// Primera pasada del tilt-shift (horizontal), todavía en HDR lineal
const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    ...tiltUniforms()
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    varying vec2 vUv;
    ${TILT_SHIFT}

    void main() {
      float amount = tiltAmount(vUv);
      gl_FragColor = amount < 0.01
        ? texture2D(tDiffuse, vUv)
        : vec4(tiltBlur(tDiffuse, vUv, vec2(amount / uResolution.x, 0.0)), 1.0);
    }
  `
}

// Un solo pase a pantalla: segunda pasada del tilt-shift (vertical), aberración,
// tone mapping + sRGB (lo que hacía el OutputPass) y después, ya en espacio de display,
// color, viñeta y grano. Juntarlos ahorra tres lecturas y escrituras de pantalla completa
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTilt: { value: 0 },
    uGrade: { value: 0 },
    ...tiltUniforms(),
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
    uniform float uTilt;
    uniform float uGrade;
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
    ${TILT_SHIFT}

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      vec3 center = texture2D(tDiffuse, vUv).rgb;
      vec3 color = center;

      float amount = tiltAmount(vUv) * uTilt;
      if (amount >= 0.01) color = tiltBlur(tDiffuse, vUv, vec2(0.0, amount / uResolution.y));

      if (uGrade > 0.5) {
        // Aberración cromática radial: R hacia fuera, B hacia dentro
        vec2 offset = centered * uAberration * length(centered) * 4.0;
        color.r += texture2D(tDiffuse, vUv + offset).r - center.r;
        color.b += texture2D(tDiffuse, vUv - offset).b - center.b;
      }

      // Al pintar en pantalla three define toneMapping() y linearToOutputTexel()
      #ifdef TONE_MAPPING
        color = toneMapping(color);
      #endif
      color = linearToOutputTexel(vec4(max(color, 0.0), 1.0)).rgb;

      if (uGrade > 0.5) {
        color *= uTint;
        color += uBrightness;
        color = (color - 0.5) * uContrast + 0.5;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, uSaturation);

        float edge = length(centered) * 1.41421;
        float vignette = smoothstep(1.0 - uVignetteSoftness, 1.0, edge) * uVignette;
        color = mix(color, uVignetteColor, vignette);

        color += (hash(vUv * uResolution + fract(uTime) * 100.0) - 0.5) * uGrain;
      }
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `
}

/**
 * Render en HDR (half float + MSAA) -> bloom -> tilt-shift horizontal
 * -> [tilt-shift vertical, tone mapping, sRGB, aberración, color, viñeta y grano] a pantalla.
 */
export default class PostProcessing {
  constructor(renderer, scene, camera, debug) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.enabled = true
    // Lo que cambia entre escenarios se aplica con setScenario
    this.params = { toneMapping: 'None', tiltShift: POST.tiltShift.enabled, grade: true }

    // Solo la escena necesita MSAA; la otra textura es para el tilt-shift horizontal
    this.sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(renderer, this.sceneTarget)
    this.passTarget = this.composer.renderTarget2
    this.passTarget.samples = 0
    this.composer.addPass(new RenderPass(scene, camera))

    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, 0, 0)
    // El resplandor es muy difuso: a media resolución no se nota y cuesta 4 veces menos
    const setBloomSize = this.bloom.setSize.bind(this.bloom)
    this.bloom.setSize = (width, height) => setBloomSize(Math.round(width * POST.bloomScale), Math.round(height * POST.bloomScale))
    this.composer.addPass(this.bloom)

    this.tiltX = new ShaderPass(TiltShiftShader)
    this.composer.addPass(this.tiltX)

    this.final = new ShaderPass(FinalShader)
    const u = this.final.uniforms
    // Los parámetros del tilt-shift son los mismos objetos en los dos pases
    for (const key of ['uFocus', 'uRange', 'uFeather', 'uBlur']) u[key] = this.tiltX.uniforms[key]
    const { color } = POST
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
    this.setTiltShift(this.params.tiltShift)
    this.setGrade(this.params.grade)
  }

  setTiltShift(enabled) {
    this.params.tiltShift = enabled
    const on = enabled && this.effects
    this.tiltX.enabled = on
    this.final.uniforms.uTilt.value = on ? 1 : 0
  }

  setGrade(enabled) {
    this.params.grade = enabled
    this.final.uniforms.uGrade.value = enabled && this.effects ? 1 : 0
  }

  /** Ya estamos en espacio de display: el hex se carga tal cual, sin pasar a lineal */
  setDisplayColor(uniform, hex) {
    uniform.value.setStyle(hex, THREE.LinearSRGBColorSpace)
  }

  /** Muestras MSAA del render target de la escena */
  setSamples(samples) {
    if (this.sceneTarget.samples === samples) return
    this.sceneTarget.samples = samples
    this.sceneTarget.dispose() // three lo recrea con las nuevas muestras en el siguiente uso
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
    // El composer alterna sus dos texturas entre frames; se fija cuál es la de la escena
    // para que la única con MSAA sea esa
    this.composer.readBuffer = this.sceneTarget
    this.composer.writeBuffer = this.passTarget
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
    // En el mar no hay tilt-shift ni pase de color aunque estén activados
    tilt.add(this.params, 'tiltShift').name('activado').onChange((on) => this.setTiltShift(on))
    tilt.add(tu.uFocus, 'value', 0, 1, 0.01).name('foco')
    tilt.add(tu.uRange, 'value', 0, 0.5, 0.01).name('zona nítida')
    tilt.add(tu.uFeather, 'value', 0.01, 1, 0.01).name('suavizado')
    tilt.add(tu.uBlur, 'value', 0, 6, 0.05).name('blur')

    const color = folder.addFolder('Color').close()
    const u = this.final.uniforms
    color.add(this.params, 'grade').name('activado').onChange((on) => this.setGrade(on))
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
