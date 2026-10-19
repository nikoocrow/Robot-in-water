# Robot in Water — PJ-03 en la orilla

Escena 3D interactiva hecha con **Three.js** y **Vite**: el robot PJ-03 vigila el mar con su catalejo
desde una roca, en una pequeña isla rodeada de un océano infinito, con nubes de algodón y un sol detrás.

Es la conversión a la web de la escena de Blender `4-6 Object Assembly and Scene Setting.blend`:
cada material se reescribió en GLSL nodo por nodo, y sobre esa base se añadieron cielo, mar, nubes
y postproceso pensados para el navegador.

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
animación o vuelve a la toma original de Blender, y el botón *Credits* abre la tarjeta del autor.

## Qué hay en la escena

| Elemento | Cómo está hecho |
| --- | --- |
| **Robot y materiales** | Cada material de Blender traducido a GLSL siguiendo su árbol de nodos (ver abajo). |
| **Animación del robot** | La acción de Blender no cierra en la misma pose; al cargar se funde su último tramo con el inicio para que el bucle sea infinito y sin saltos. |
| **Lente del catalejo** | Shader propio: cristal abombado, iris con paralaje y pupila que pulsa, reflejo del cielo y destellos cartoon. |
| **Número del pecho** | El texto del `.blend` llegaba como cajas; se sustituye por "42261" con una fuente de Three.js, pegado al mismo hueso. |
| **Isla** | La losa cuadrada de Blender se recorta con una silueta orgánica; el agua y la espuma de la cascada se conservan. |
| **Mar infinito** | Se calcula en el shader del cielo intersectando cada rayo con el plano del agua: oleaje, espuma, reflejo del cielo, destellos del sol, orilla con espuma y bruma hacia el horizonte. |
| **Nubes** | Racimos de esferas instanciadas con luz envolvente y bordes translúcidos, tipo humo de algodón. |
| **Sol** | Disco solar en el cielo, colocado delante de la cámara para que asome tras las nubes. La luz de la escena sigue siendo la de Blender. |
| **Bloom** | `UnrealBloomPass` sobre un render HDR con MSAA; solo brilla lo que supera el umbral (espuma, sol, bordes). |

Casi todo se ajusta desde [`src/config/scene.js`](src/config/scene.js): colores, tamaños, velocidades,
forma de la isla, intensidad del bloom, altura mínima de la cámara, texto del pecho, etc.

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
   ├─ core/                   # Renderer (composer + bloom), CameraRig, Sizes
   ├─ materials/              # BlenderMaterials: un ShaderMaterial por material de Blender
   ├─ shaders/
   │  ├─ lib/                 # réplica de los nodos (hash, voronoi, noise…) y silueta de la isla
   │  ├─ surface/vertex.glsl  # vertex shader común (coordenadas Object, atributos, sombras)
   │  ├─ materials/           # robot, terrain, splash, principled, emission, water, lens
   │  ├─ sky/                 # cielo, sol y mar infinito
   │  └─ clouds/              # nubes
   ├─ world/                  # Sky, Clouds, Lights, Robot, RobotLabel, RockScatter, Droplets, World
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
gris 0.323 para los rayos que no son de cámara. La vista es *Standard*, sin tone mapping.

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
- El cielo y el mar se dibujan después de la geometría opaca, así que el test de profundidad evita
  calcularlos en los píxeles que tapa la isla.
- El canvas no tiene MSAA ni profundidad propios: la escena se dibuja en el render target del composer.
- **Calidad adaptativa** (`core/Quality.js`): si el equipo no llega a ~60 fps, baja de nivel
  (resolución en pantallas Retina de 2× hacia 1×, sombra de 4096 a 2048). Con densidad ≥ 1.75×
  usa MSAA 2× en vez de 4×, porque los bordes ya son finos. Los niveles están en `QUALITY`.
- **`?debug`** en la URL muestra fps, ms por frame, tiempo de GPU, nivel, resolución, draw calls y
  triángulos, y permite forzar un nivel. `?quality=N` fija el nivel sin ajuste automático.
- La cámara no baja de `CAMERA.minHeight`, para no quedar a ras del agua.
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
