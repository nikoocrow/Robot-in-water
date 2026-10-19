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

export const SKY = {
  horizon: [0.67, 1.0, 0.978],
  zenith: [0.003, 0.501, 1.0],
  start: 0.055,
  end: 0.513,
  offset: 0.2
}

// Mar infinito bajo el horizonte (se dibuja en el shader del cielo, no viene del .blend)
export const SEA = {
  level: 0.1,                     // altura del agua de la mitad trasera de la escena
  shallow: [0.2, 0.21, 0.23],     // tono aparente del agua de Blender sobre el suelo gris
  deep: [0.11, 0.12, 0.14],
  foam: [0.75, 0.78, 0.8],
  scale: 0.9,                     // tamaño de las celdas (más alto = más pequeñas)
  speed: 0.15,                    // avance de las olas
  reflection: 0.6,                // intensidad del reflejo del cielo
  sparkle: 4.0,                   // destellos del sol sobre el agua
  haze: [25, 160]                 // bruma: distancia de inicio y de fin
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
  height: [3, 12],
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

// Postproceso (UnrealBloomPass). Solo brilla lo que supera el umbral (espacio lineal)
export const BLOOM = {
  strength: 0.65,
  radius: 0.5,
  threshold: 1.4
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
  lowLevel: -0.55,              // altura del agua de la mitad delantera (más baja)
  shore: [0.3, 0.37, 0.42],     // agua clara junto a la costa
  shoreFoam: 1.7                // brillo de la espuma de la orilla (>1.4 brilla con el bloom)
}

// Cámara: altura mínima para no bajar a ras del agua (el mar está en y = 0.1)
export const CAMERA = {
  minHeight: 0.6
}

// Texto del pecho del robot (en el .blend salía como cajas)
export const ROBOT_LABEL = {
  node: 'Text',
  text: '42261',
  fill: 0.9                     // fracción del hueco original que ocupa
}
