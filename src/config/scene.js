/**
 * Valores copiados de los nodos del .blend original.
 * Todos los colores están en espacio lineal, igual que en Blender.
 */
// Materiales del robot: Color Ramp + Principled + grupo "Paint Edge"
export const ROBOT_MATERIALS = {
  Blue: {
    ramp: {
      pos: [0.0, 0.76, 1.0],
      colors: [[0.04, 0.415, 0.866], [0.045, 0.479, 1.0], [0.848, 0.417, 0.089]]
    },
    metallic: 0.0,
    roughness: 0.5,
    edgeLit: [0.183, 1.787, 2.5],
    edgeDark: [0.019, 0.116, 0.201],
    rim: { ior: 0.98, lit: [0.183, 1.791, 2.5], dark: [0.019, 0.114, 0.202] }
  },
  Metal: {
    ramp: {
      pos: [0.0, 0.796, 1.0],
      colors: [[0.465, 0.465, 0.465], [0.348, 0.348, 0.348], [0.842, 0.3, 0.091]]
    },
    metallic: 0.327,
    roughness: 0.391,
    edgeLit: [2.997, 1.584, 0.706],
    edgeDark: [0.135, 0.088, 0.07]
  },
  spyglass: {
    ramp: {
      pos: [0.0, 1.0],
      colors: [[0.171, 0.171, 0.171], [0.089, 0.089, 0.089]]
    },
    metallic: 0.0,
    roughness: 0.5,
    edgeLit: [2.5, 2.5, 2.5],
    edgeDark: [0.092, 0.092, 0.092]
  }
}

// Rocas y suelo
export const TERRAIN_MATERIALS = {
  Rock: {
    rock: true,
    ramp: {
      pos: [0.0, 0.127, 0.847, 1.0],
      colors: [[0.494, 0.245, 0.119], [0.127, 0.127, 0.127], [0.518, 0.518, 0.518], [0.052, 0.109, 0.175]],
      interp: 'ease'
    },
    shadow: [0.265, 0.345],
    rimLit: [2.0, 2.0, 2.0],
    rimIor: 0.99
  },
  Ground: {
    rock: false,
    ramp: {
      pos: [0.0, 0.127, 0.847, 1.0],
      colors: [[0.494, 0.245, 0.119], [0.127, 0.127, 0.127], [0.223, 0.223, 0.223], [0.052, 0.109, 0.175]],
      interp: 'linear'
    },
    shadow: [0.102, 0.462],
    rimLit: [0.442, 0.442, 0.442],
    rimIor: 0.98
  }
}

export const PRINCIPLED_MATERIALS = {
  Text: { base: [0.8, 0.8, 0.8], metallic: 0.0, roughness: 0.5 },
  Black: { base: [0.00396, 0.00396, 0.00396], metallic: 0.0, roughness: 1.0 },
  'Material.002': { base: [0.12075, 1.0, 0.81688], metallic: 0.0, roughness: 1.0 }
}

export const EMISSION_MATERIALS = {
  Eye: [0.3104 * 2.2, 0.02459 * 2.2, 0.01793 * 2.2]
}

// Lente del catalejo. En Blender era una emisión plana [0.218, 0.005, 0.0]
export const LENS = {
  material: 'Material.001',
  radius: 0.0445,              // radio del disco en coordenadas locales
  bulge: 0.6,
  depth: 0.18,
  deep: [0.012, 0.002, 0.004], // fondo del cristal
  iris: [0.35, 0.03, 0.01],
  glow: [1.0, 0.08, 0.02],     // pupila
  glowStrength: 2.6            // >1.4 para que la pupila brille con el bloom
}

export const WATER = {
  shallow: [0.014, 0.054, 0.111],
  deep: [0.002, 0.005, 0.008],
  diffuseAmount: 1.0 - 0.68,   // Mix Shader: Diffuse / Transparent con factor 0.68
  foamStrength: 2.1
}

// Los colores del cielo dependen del escenario (SCENARIOS)
export const SKY = {
  start: 0.055,
  end: 0.513,
  offset: 0.2
}

// Agua bajo el horizonte (no viene del .blend): plano analítico que se dibuja en el
// shader del cielo. Es el mar infinito o, en el río, se ve donde el terreno queda bajo el agua.
// Colores y bruma en SCENARIOS
export const SEA = {
  level: 0.1,                     // altura del agua de la mitad trasera de la isla
  foam: [0.75, 0.78, 0.8],
  scale: 0.9,                     // tamaño de las celdas (más alto = más pequeñas)
  speed: 0.15,                    // avance de las olas
  reflection: 0.6,                // intensidad del reflejo del cielo
  sparkle: 4.0                    // destellos del sol sobre el agua
}

// Disco solar visible en el cielo. Es solo visual: la luz de Blender viene de detrás
// de la cámara, así que el disco se coloca delante para que se vea tras las nubes
export const SUN_DISC = {
  direction: [-0.34, 0.3, -0.97], // ejes de Three.js
  color: [1.0, 0.85, 0.6],
  size: 0.035,                    // radio angular (radianes)
  intensity: 6.0,                 // >1.4 para que brille con el bloom
  glow: 0.6                       // halo alrededor del disco
}

// Nubes de algodón alrededor de la escena (no vienen del .blend)
export const CLOUDS = {
  seed: 7,
  count: 16,                   // número de nubes
  distance: [34, 60],          // distancia al centro de la escena
  height: [7, 15],              // por encima de las colinas del fondo
  size: [14, 24],              // ancho de cada nube
  puffs: [45, 65],             // esferas por nube
  lit: [1.15, 1.15, 1.15],      // cara iluminada (>1 para que brille con el bloom)
  shadow: [0.72, 0.78, 0.86],  // cara en sombra
  rim: [1.7, 1.7, 1.7],        // borde luminoso
  wrap: 1.0,                   // cuánto rodea la luz a cada esfera
  haze: 0.08,                  // mezcla con el color del horizonte
  softEdge: 0.6,               // cuánto se desvanece el contorno de cada esfera
  drift: 0.004                 // giro alrededor de la escena (rad/s)
}

// Postproceso (core/PostProcessing.js)
// Tone mapping, exposición, bloom y si hay tilt-shift y pase de color: en SCENARIOS
export const POST = {
  // Tilt-shift separable: blur en píxeles por tap fuera de la franja nítida
  // Foco un poco por encima del centro: el robot queda nítido en la toma inicial
  tiltShift: { enabled: true, focus: 0.56, range: 0.2, feather: 0.35, blur: 2.2 },
  // Pase final, en espacio de display
  color: {
    aberration: 0.0015,
    saturation: 1.15,
    contrast: 1.05,
    brightness: 0,
    tint: '#fff8ee',
    vignette: 0.45,
    vignetteSoftness: 0.55,
    vignetteColor: '#0d1a10',
    grain: 0.035
  }
}

// Color de fondo que ven los rayos que no son de cámara (Light Path -> Is Camera Ray)
export const WORLD_LIGHT = [0.323, 0.323, 0.323]

// Bucle de la animación del robot: segundos del final que se funden con el inicio
export const ROBOT_LOOP = {
  blend: 0.75
}

// Rocas modelo del sistema de partículas: en Blender están fuera de la escena y ocultas
export const ROCK_SOURCES = ['Rock.008', 'Rock.009', 'Rock.010']

// Silueta de isla que recorta la losa cuadrada de Blender (suelo, agua y espuma)
export const ISLAND = {
  radius: 6.6,
  roundness: 3.0,               // 2 = círculo, más alto = más cuadrada
  wobble: 0.16,                 // ondulación de la costa (debe caber en los ±8 m de la losa)
  seed: 1.7,                    // cambia la forma de la costa
  edge: 0.9,                    // ancho de la franja de roca mojada en el borde
  shoreFoam: 1.7                // brillo de la espuma de la orilla (>1.4 brilla con el bloom)
}

// Cámara: altura mínima para no bajar a ras del agua (el río está en y = 0.1)
// ni meterse en las colinas
export const CAMERA = {
  minHeight: 0.6,
  aboveTerrain: 0.8
}

// Texto del pecho del robot (en el .blend salía como cajas)
export const ROBOT_LABEL = {
  node: 'Text',
  text: '42261',
  fill: 0.9                     // fracción del hueco original que ocupa
}

// Calidad adaptativa (core/Quality.js). Nivel 0 = máxima. ?quality=N fija un nivel
export const QUALITY = {
  levels: [
    { pixelRatio: 1.5, shadowMapSize: 4096 },
    { pixelRatio: 1.5, shadowMapSize: 2048 },
    { pixelRatio: 1.25, shadowMapSize: 2048 },
    { pixelRatio: 1, shadowMapSize: 2048 },
    { pixelRatio: 0.85, shadowMapSize: 2048 }
  ],
  slowFrameMs: 18.5,            // por debajo de ~54 fps baja un nivel
  fastFrameMs: 11,              // por encima de ~90 fps puede volver a subir…
  upgradeAfter: 6,              // …tras estos segundos seguidos así
  window: 1,                    // segundos de cada medición
  warmup: 2,                    // segundos sin medir al empezar
  cooldown: 1.5                 // segundos sin medir tras un cambio
}

// Luces para los materiales de three (pasto, suelo, árboles). Los de Blender
// calculan su propia luz con uSunDir, así que el sol mantiene esa dirección
export const ENVIRONMENT = {
  sunColor: '#fff1d6',
  sunIntensity: 2.6,
  hemiSky: '#c9e6ff',
  hemiGround: '#5f7d2a',
  hemiIntensity: 1.3
}

// Terreno. Es más grande que el área con pasto y sube en los bordes,
// así nunca se ve el final del mundo
export const TERRAIN = {
  seed: 12,
  size: 160,
  segments: 400,
  grassArea: 64,                // lado del área con pasto, centrada
  rim: { from: 28, to: 72, height: 8 },
  maskResolution: 1024,
  grassColor: '#2f6b14',
  farGrassColor: '#5b9a22',     // fuera del área con pasto: tono medio de las hojas
  dirtColor: '#c98b4f',
  dirtLightColor: '#e0a86a'
}

// Río que atraviesa la isla. Fluye hacia +z y salta en z ≈ 1, como el agua de la isla
export const RIVER = {
  lowLevel: -0.55,              // nivel río abajo (el agua de la mitad delantera de la isla)
  step: [0.2, 1.4],             // tramo z del salto entre los dos niveles
  poolWidth: 8.4,               // semiancho junto a la isla: la isla cabe entera en el cauce
  width: 4.2,                   // semiancho del resto del río
  narrow: [8, 18],              // tramo |z| en el que pasa de un ancho al otro
  bank: 1.6,                    // ancho del talud de la orilla
  floodplain: [0.75, 10],       // altura de la ribera sobre el agua y distancia hasta las colinas
  depth: 0.9,                   // profundidad del lecho bajo el agua
  sand: [0.1, 0.9],             // franja de tierra junto al agua (desde el talud)
  meander: [7, 2.5],            // amplitud de las dos ondas del cauce
  flowSpeed: 0.9                // corriente del agua, río abajo (m/s)
}

export const GRASS = {
  seed: 3,
  count: 220000,
  segments: 4,
  height: 0.85,
  width: 0.14,
  normalBlend: 0.25,
  wind: { strength: 0.35, speed: 0.35, frequency: 0.09, direction: [1, 0.35] },
  interaction: { radius: 1.6, strength: 1.1 },
  baseColor: '#174d0c',
  tipColor: '#a6dc3a',
  patchColor: '#5aa81e',
  patchStrength: 1
}

export const TREES = {
  seed: 5,
  // Fuera de caminos (máscara < 0.2). El sol es bajo y la sombra de la copa cae
  // ~15 m hacia +x -z: el primero se ve tras el robot en la toma inicial y los otros
  // dos dejan la sombra de hojas sobre el pasto
  spots: [[-13.3, -8.8], [-22, 4], [14, 0]],
  leafColor: '#6252ff',
  trunkColor: '#7a4a2c',
  leafSize: 0.75,
  sway: 0.02,
  alphaTest: 0.5
}

export const CONFETTI = {
  seed: 9,
  count: 160,
  colors: ['#8a6bff', '#ffd23f'],
  area: 30,
  height: [0.5, 5],
  size: 22
}

// Escenarios: el río (por defecto) y el mar original. Aquí solo lo que cambia entre ellos.
// ?escena=mar en la URL abre el mar; el botón del panel los alterna sin recargar
export const SCENARIOS = {
  river: {
    nature: true,               // terreno con el río, pasto, árboles y confeti
    // Degradado #d6ecef (horizonte) -> #4f9fe6 (arriba), en lineal
    sky: { horizon: [0.672, 0.831, 0.863], zenith: [0.078, 0.347, 0.791] },
    water: {
      shallow: [0.045, 0.16, 0.2],   // río azul verdoso
      deep: [0.02, 0.08, 0.12],
      shore: [0.12, 0.34, 0.36],     // agua clara junto a la isla y a las orillas
      haze: [30, 72]                 // bruma = niebla del terreno
    },
    // Sombra del sol: mitad del lado del área que cubre. El sol es bajo y las copas
    // de los árboles proyectan lejos
    shadow: { extent: 30, distance: 40, bias: -0.0006, normalBias: 0.03 },
    post: {
      toneMapping: 'ACES',
      exposure: 1.05,
      bloom: { strength: 0.25, radius: 0.5, threshold: 0.85 },
      effects: true                  // tilt-shift y pase de color
    },
    camera: { maxDistance: 18 }      // más lejos se vería el final del pasto
  },
  sea: {
    nature: false,
    sky: { horizon: [0.67, 1.0, 0.978], zenith: [0.003, 0.501, 1.0] },
    water: {
      shallow: [0.2, 0.21, 0.23],    // tono aparente del agua de Blender sobre el suelo gris
      deep: [0.11, 0.12, 0.14],
      shore: [0.3, 0.37, 0.42],
      haze: [25, 160]
    },
    // La isla mide unos ±8 m
    shadow: { extent: 8, distance: 12, bias: -0.0004, normalBias: 0.015 },
    post: {
      // Vista "Standard" de Blender: sRGB sin tone mapping. Solo brilla lo que supera 1.4
      toneMapping: 'None',
      exposure: 1,
      bloom: { strength: 0.65, radius: 0.5, threshold: 1.4 },
      effects: false
    },
    camera: { maxDistance: 25 }
  }
}

export const SCENARIO_PARAM = { name: 'escena', values: { rio: 'river', mar: 'sea' } }
