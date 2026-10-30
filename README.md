# Robot in Water — PJ-03 en la orilla

Escena 3D interactiva hecha con **Three.js** y **Vite**: el robot PJ-03 vigila el río con su catalejo
desde una roca, en una pequeña isla en mitad del cauce, entre praderas de pasto, árboles de copa
morada, nubes de algodón y un sol detrás.

Es la conversión a la web de la escena de Blender `4-6 Object Assembly and Scene Setting.blend`:
cada material se reescribió en GLSL nodo por nodo, y sobre esa base se añadieron cielo, río, terreno,
pasto, árboles, nubes y postproceso pensados para el navegador.

**Diseño, modelado y desarrollo:** [nikocrow](https://nikocrow.dev)

## Cómo correrlo

Requiere Node 18 o superior.

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción en /dist
npm run preview  # previsualizar el build

npm run optimize:model  # recomprime assets-src/escena.glb -> src/assets/models/escena.glb
```

**Controles:** arrastra para girar la cámara y usa la rueda para acercar. El panel inferior pausa la
animación, vuelve a la toma original de Blender o cambia de escenario, y el botón *Credits* abre la
tarjeta del autor.

**Escenarios:** el **río** (por defecto: la isla en mitad de un cauce, con pasto y árboles) y el
**mar** original (la isla rodeada de un océano infinito, con la vista *Standard* de Blender). El botón
*Ver el mar / Ver el río* los alterna sin recargar, y `?escena=mar` en la URL abre directamente el mar.
Lo que cambia entre ellos está en `SCENARIOS` (`src/config/scene.js`).

## Qué hay en la escena

| Elemento | Cómo está hecho |
| --- | --- |
| **Robot y materiales** | Cada material de Blender traducido a GLSL siguiendo su árbol de nodos (ver abajo). |
| **Animación del robot** | La acción de Blender no cierra en la misma pose; al cargar se funde su último tramo con el inicio para que el bucle sea infinito y sin saltos. |
| **Lente del catalejo** | Shader propio: cristal abombado, iris con paralaje y pupila que pulsa, reflejo del cielo y destellos cartoon. |
| **Número del pecho** | El texto del `.blend` llegaba como cajas; se sustituye por "42261" con una fuente de Three.js, pegado al mismo hueso. |
| **Isla** | La losa cuadrada de Blender se recorta con una silueta orgánica; el agua y la espuma de la cascada se conservan. |
| **Terreno y río** | Malla de 160 × 160 m con ruido simplex, colinas en el borde y un cauce que atraviesa la isla (`world/nature/Terrain.js`). Los caminos, claros y orillas de tierra salen de `getPathMask`, horneada en una textura que usa el suelo. |
| **Agua del río** | El suelo bajo el nivel del agua se descarta y ahí se ve el agua que calcula el shader del cielo intersectando cada rayo con el plano del agua: oleaje, espuma, reflejo, destellos del sol, espuma en las orillas y bruma igual a la niebla. Sigue los dos niveles del agua de la isla (salto en z ≈ 1). |
| **Pasto** | ~150 000 hojas con GPU instancing sobre un `MeshLambertMaterial` modificado: viento, se aparta del puntero y usa la normal del terreno para un sombreado suave (`world/nature/Grass.js`). |
| **Árboles** | Tronco toon y copa de cientos de quads en billboard con alphaMap de hojas; la sombra también tiene forma de hojas (`world/nature/Trees.js`). |
| **Confeti** | Puntos morados y amarillos que flotan y giran. |
| **Nubes** | Racimos de esferas instanciadas con luz envolvente y bordes translúcidos, tipo humo de algodón. |
| **Sol** | Disco solar en el cielo, colocado delante de la cámara para que asome tras las nubes. La luz de la escena sigue siendo la de Blender. |
| **Postproceso** | Render HDR con MSAA → bloom → tone mapping ACES → tilt-shift en dos pasadas → aberración cromática, color, viñeta y grano (`core/PostProcessing.js`). |

Casi todo se ajusta desde [`src/config/scene.js`](src/config/scene.js): colores, tamaños, velocidades,
forma de la isla y del río, pasto, árboles, postproceso, altura mínima de la cámara, texto del pecho, etc.
Con **`#debug`** en la URL aparecen controles (lil-gui) para casi todos ellos.

## Estructura

```
robot-agua-threejs/
├─ index.html                 # canvas, pantalla de carga, HUD, créditos y precarga del modelo
├─ vite.config.js            # Three.js en un chunk aparte
├─ vercel.json               # caché inmutable para /assets
├─ public/favicon.svg
├─ assets-src/escena.glb     # exportación original de Blender, sin comprimir
├─ scripts/optimize-model.mjs
└─ src/
   ├─ main.js · Experience.js
   ├─ config/scene.js         # valores del .blend y parámetros de todo lo añadido
   ├─ core/                   # Renderer, PostProcessing, CameraRig, Quality, Debug (lil-gui), Sizes
   ├─ materials/              # BlenderMaterials: un ShaderMaterial por material de Blender
   ├─ shaders/
   │  ├─ lib/                 # réplica de los nodos (hash, voronoi, noise…), simplex 2D y silueta de la isla
   │  ├─ surface/vertex.glsl  # vertex shader común (coordenadas Object, atributos, sombras)
   │  ├─ materials/           # robot, terrain, splash, principled, emission, water, lens
   │  ├─ sky/                 # cielo, sol y agua del río
   │  └─ clouds/              # nubes
   ├─ world/                  # Sky, Clouds, Lights, Robot, RobotLabel, RockScatter, Droplets, World
   │  └─ nature/              # Terrain (río), Grass, Trees, Confetti
   ├─ ui/                     # Hud, Credits
   ├─ assets/
   │  ├─ models/escena.glb    # el modelo comprimido con meshopt que carga la web
   │  ├─ data/escena.json     # instancias de rocas, emisor de gotas, sol y texspace por objeto
   │  ├─ images/perfil.jpg    # foto de los créditos
   │  └─ fonts/               # subconjunto de la fuente del número del pecho
   ├─ styles/main.css
   └─ utils/
```

## Materiales: traducción nodo por nodo

| Blender | Archivo |
| --- | --- |
| Blue, Metal, spyglass + grupo Paint Edge | `shaders/materials/robot.frag.glsl` |
| Rock, Ground | `shaders/materials/terrain.frag.glsl` |
| Splash | `shaders/materials/splash.frag.glsl` |
| Water | `shaders/materials/water.frag.glsl` |
| Text, Black, Material.002 | `shaders/materials/principled.frag.glsl` |
| Eye | `shaders/materials/emission.frag.glsl` |
| Material.001 (lente) | `shaders/materials/lens.frag.glsl` (reemplaza la emisión plana original) |
| World | `shaders/sky/fragment.glsl` |

`Voronoi Texture` (hash PCG) y `Noise Texture` (Perlin con hash Jenkins) son réplicas exactas de
Blender 5.1, verificadas contra los valores que devuelve Blender, así que los patrones coinciden.
`Shader to RGB` se reproduce con la misma iluminación de la escena: sol de fuerza 5 y mundo
gris 0.323 para los rayos que no son de cámara. En Blender la vista es *Standard*, sin tone mapping;
aquí el postproceso aplica ACES por defecto para el pasto y los árboles (se cambia en `POST` o con `#debug`).

Animaciones que no viajan en glTF y se recrean en los shaders:
- **Espuma del agua**: driver `frame / 20` en la *Location Y* del Mapping (`water.frag.glsl`).
- **Líneas de la orilla** (*Curve Splash*): el `.glb` trae la geometría antes de *Set Position*
  (`_splash_base`, `_splash_dir`, `_splash_amp`) y el vertex shader aplica el mismo desplazamiento
  con Noise + Float Curve y *Scene Time*. Verificado contra Blender (error < 0.000001 m).

Diferencias conocidas con Blender:
- **Pasto** (*Grass Generator*): en Blender se mueve con el viento; aquí está quieto.
- **Ambient Occlusion** (Rock y Ground): en EEVEE es de pantalla; aquí vale 1.
- **Coordenadas Generated** del robot: se calculan con la posición evaluada, no con la original
  antes de modificadores. Solo afectan un desplazamiento de ±0.025 del Voronoi.
- **Principled BSDF**: GGX estándar en lugar del modelo multicapa exacto de EEVEE.

## Rendimiento

- Las nubes son un único `InstancedMesh` con esferas de baja resolución.
- El cielo y el agua se dibujan después de la geometría opaca, así que el test de profundidad evita
  calcularlos en los píxeles que tapan la isla y el terreno.
- El pasto (una hoja de 9 vértices instanciada) va en trozos de 8 × 8 m: los que quedan fuera de
  cámara no se dibujan y los lejanos, ya bajo la niebla y el tilt-shift, se aclaran (`GRASS.lod`).
  No proyecta sombras y el ruido de las manchas de color se calcula una vez por hoja en la CPU.
- El terreno no dibuja los triángulos que quedan enteros bajo el agua, y solo la franja de la orilla
  usa `discard`: el resto es opaco puro, lo que mejor aprovechan las GPU por tiles (Apple M1/M2…).
- Postproceso en dos pases a pantalla tras el bloom: el tilt-shift horizontal y un pase final que
  junta el vertical, el tone mapping, la conversión a sRGB y el color. Solo la textura de la escena
  lleva MSAA, y el bloom se calcula a media resolución.
- El rayo del puntero (para apartar el pasto) se lanza como mucho una vez por frame.
- El canvas no tiene MSAA ni profundidad propios: la escena se dibuja en el render target del composer.
- **Calidad adaptativa** (`core/Quality.js`): si el equipo no llega a ~60 fps, baja de nivel
  (resolución de 1.5× hacia 0.85×, sombra de 4096 a 2048); si va muy lento baja dos de golpe.
  En pantallas Retina usa MSAA 2×. Los niveles están en `QUALITY`.
- **`?debug`** en la URL muestra fps, ms por frame, tiempo de GPU, nivel, resolución, draw calls y
  triángulos, y permite forzar un nivel. `?quality=N` fija el nivel sin ajuste automático.
- La cámara no baja de `CAMERA.minHeight` ni se mete en el terreno.
- El modelo se precarga desde el HTML, en paralelo con el JS, y lleva hash en el nombre:
  Vercel lo sirve con brotli y caché inmutable, así que las visitas repetidas no lo descargan.
- Los shaders se compilan durante la pantalla de carga, así que los primeros frames no dan tirones.

- El modelo va comprimido con `EXT_meshopt_compression` (8.3 MB → 3.6 MB) **sin cuantizar**: la
  cuantización cambia las coordenadas locales de las mallas, de las que dependen los shaders de
  Blender. Geometría, atributos y animación salen idénticos bit a bit; la única diferencia es que
  `gltf-transform` omite las transformaciones de nodo que están a menos de 0.00001 de la identidad.

## Despliegue

El proyecto se publica en [Vercel](https://vercel.com), que detecta Vite automáticamente
(`npm run build`, salida en `dist/`).

## Volver a exportar desde Blender

Exporta a `assets-src/escena.glb` y ejecuta `npm run optimize:model`.
Los shaders necesitan atributos que glTF solo exporta si su nombre empieza con `_`
(`_paint_edge`, `_edge_width`, `_point_normal`, `_data_surface`, `_data_edge_noise`, `_self_scale`) y
las máscaras *Bright*/*Dark* del agua en el color de vértice (R y G). Se generan con un modificador
temporal de Geometry Nodes que luego se elimina.
