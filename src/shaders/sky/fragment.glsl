// World: Generated -> Mapping (rot Y 90°, loc x 0.2) -> Gradient lineal -> Color Ramp
uniform vec3 uHorizonColor;
uniform vec3 uZenithColor;
uniform float uStart;
uniform float uEnd;
uniform float uOffset;

// Disco solar (no viene del .blend)
uniform vec3 uSunDiscDir;
uniform vec3 uSunColor;
uniform float uSunSize;
uniform float uSunIntensity;
uniform float uSunGlow;

// Agua del río: plano analítico bajo el horizonte (no viene del .blend).
// Solo se ve donde el terreno queda bajo el agua (el material del suelo se descarta)
uniform vec3 uCameraPos;
uniform float uTime;
uniform vec3 uSeaShallow;
uniform vec3 uSeaDeep;
uniform vec3 uSeaFoam;
uniform float uSeaScale;
uniform float uSeaSpeed;
uniform float uSeaReflection;
uniform float uSeaSparkle;
uniform vec2 uSeaHaze;       // distancia donde empieza / termina la bruma (= niebla)

// 1 = río (el agua solo se ve en el cauce), 0 = mar infinito alrededor de la isla
uniform float uRiverMode;
// Nivel de arriba / de abajo y tramo z del salto
uniform vec2 uRiverLevel;
uniform vec2 uRiverStep;
// Máscara del terreno, indexada por xz de mundo.
// G = distancia al borde del cauce (-1..10 m); la línea del agua está uWaterline más afuera
uniform sampler2D uRiverMask;
uniform float uWaterline;
uniform float uTerrainSize;
// Cauce (mismos valores que Terrain.js) y velocidad de la corriente en m/s
uniform vec2 uRiverMeander;
uniform vec2 uRiverWidth;    // semiancho junto a la isla / del resto
uniform vec2 uRiverNarrow;   // tramo |z| en el que pasa de uno a otro
uniform float uRiverSpeed;

// Orillas
uniform vec3 uShoreColor;
uniform float uShoreFoam;

varying vec3 vDirection;

vec3 skyGradient(vec3 dir) {
  float t = clamp(dir.y + uOffset, 0.0, 1.0);   // dir.y = Z de Blender
  float f = clamp((t - uStart) / (uEnd - uStart), 0.0, 1.0);
  return mix(uHorizonColor, uZenithColor, f);
}

vec3 skyColor(vec3 dir) {
  float angle = acos(clamp(dot(dir, uSunDiscDir), -1.0, 1.0));
  float disc = 1.0 - smoothstep(uSunSize * 0.85, uSunSize, angle);
  float halo = exp(-angle * 12.0) * uSunGlow + exp(-angle * 45.0) * uSunGlow;
  return skyGradient(dir) + uSunColor * (disc * uSunIntensity + halo);
}

vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash22(i).x, hash22(i + vec2(1, 0)).x, f.x),
             mix(hash22(i + vec2(0, 1)).x, hash22(i + vec2(1, 1)).x, f.x), f.y);
}

// Voronoi: x = F1, y = F2 - F1 (distancia al borde), z = valor aleatorio de la celda
vec3 voronoi(vec2 p, float time) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  float id = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = vec2(x, y);
      vec2 h = hash22(i + cell);
      vec2 point = cell + 0.5 + 0.4 * sin(time + 6.2831 * h);
      float d = length(point - f);
      if (d < f1) { f2 = f1; f1 = d; id = h.y; }
      else if (d < f2) { f2 = d; }
    }
  }
  return vec3(f1, f2 - f1, id);
}

// El río salta del nivel de atrás al de delante, igual que el agua de la isla.
// En el mar solo baja junto a la mitad delantera de la isla, para que la orilla coincida
// con el borde; lejos vuelve al nivel general
float seaLevelAt(vec2 p) {
  float front = smoothstep(uRiverStep.x, uRiverStep.y, p.y);
  if (uRiverMode < 0.5) front *= 1.0 - smoothstep(1.0, 8.0, islandDistance(p));
  return mix(uRiverLevel.x, uRiverLevel.y, front);
}

// Centro del cauce en x: recto junto a la isla, serpentea lejos (= Terrain.riverCenter)
float riverCenter(float z) {
  float fade = smoothstep(6.0, 20.0, abs(z));
  return (sin(z * 0.075 + 0.6) * uRiverMeander.x + sin(z * 0.16 + 2.0) * uRiverMeander.y) * fade;
}

// Coordenadas de la corriente en metros: x = a través del cauce, y = a lo largo (río abajo = +z).
// Siguen las curvas, se juntan donde el río se estrecha y rodean la isla como un flujo
// potencial alrededor de un obstáculo (función de corriente y potencial de un cilindro)
vec2 riverFlow(vec2 p) {
  float halfWidth = mix(uRiverWidth.x, uRiverWidth.y, smoothstep(uRiverNarrow.x, uRiverNarrow.y, abs(p.y)));
  float across = (p.x - riverCenter(p.y)) * uRiverWidth.x / halfWidth;
  float r = max(length(p), 1e-3);
  float radius = max(r - islandDistance(p), 0.1);   // borde de la isla en esa dirección
  float k = min(radius * radius / (r * r), 1.0);
  return vec2(across * (1.0 - k), p.y * (1.0 + k));
}

vec3 sea(vec3 dir) {
  // Intersección con una superficie de altura variable por punto fijo.
  // Altura mínima para que el mar nunca desaparezca si la cámara baja
  float level = uRiverLevel.x;
  float dist = 0.0;
  vec2 world = uCameraPos.xz;
  for (int i = 0; i < 4; i++) {
    float height = max(uCameraPos.y - level, 0.05);
    dist = height / max(-dir.y, 1e-4);
    world = uCameraPos.xz + dir.xz * dist;
    float next = seaLevelAt(world);
    if (abs(next - level) < 1e-3) break;
    level = next;
  }

  // El detalle se apaga con la distancia para evitar parpadeo y moiré
  float detail = 1.0 - smoothstep(uSeaHaze.x * 0.4, uSeaHaze.x * 1.5, dist);

  bool river = uRiverMode > 0.5;
  // Río: todo el patrón se arrastra río abajo por las coordenadas de la corriente
  vec2 flow = river ? riverFlow(world) - vec2(0.0, uTime * uRiverSpeed) : world;

  // Manchas por celdas, como el suelo que se ve a través del agua de Blender
  vec3 patches = voronoi(flow * uSeaScale, uTime * 0.15);
  vec3 color = mix(uSeaShallow, uSeaDeep, patches.z * detail);

  // Espuma. Mar: crestas cortas en celdas estiradas a lo ancho que avanzan hacia la orilla.
  // Río: rayas largas estiradas en el sentido de la corriente
  vec2 uv = river
    ? vec2(flow.x * 2.2, flow.y * 0.3) * uSeaScale
    : vec2(world.x * 0.5, world.y) * uSeaScale * 3.0 + vec2(0.0, uTime * uSeaSpeed);
  vec3 waves = voronoi(uv, uTime * (river ? 0.3 : 0.8));
  float aa = fwidth(waves.y) + 1e-4;
  float foam = 1.0 - smoothstep(0.03 - aa, 0.03 + aa, waves.y);
  // En el río hay más rayas y se ven más lejos
  float sparse = river ? 0.55 : 0.72;
  foam *= smoothstep(sparse, sparse + 0.08, noise(uv * 0.6 + 3.7)) * smoothstep(0.25, 0.6, waves.x);
  foam *= 1.0 - smoothstep(river ? 18.0 : 10.0, river ? 55.0 : 40.0, dist);
  color = mix(color, uSeaFoam, foam);

  // Orillas (de la isla y del río): agua clara, espuma de contacto y ondas.
  // Distancia a la orilla del río: la horneada en la máscara, desde la línea del agua
  float shore = islandDistance(world);
  float rippleShore = shore;
  if (river) {
    float inside = texture2D(uRiverMask, world / uTerrainSize + 0.5).g * 11.0 - 1.0;
    // Las líneas de orilla solo siguen las márgenes (paralelas a la corriente); alrededor
    // de la isla serían concéntricas y cruzarían el agua río abajo
    rippleShore = max(inside + uWaterline, 0.0);
    shore = min(shore, rippleShore);
  }
  color = mix(uShoreColor, color, smoothstep(0.0, 2.5, shore));
  // Mar: ondas que se alejan de la costa. Río: líneas paralelas a la orilla, a trozos
  // que bajan con la corriente
  vec2 shoreNoise = river ? vec2(flow.x * 1.1, flow.y * 0.3) : world * 1.1 - uTime * 0.15;
  float contact = 1.0 - smoothstep(0.0, 0.3 + 0.25 * noise((river ? flow : world) * 2.0 + uTime * 0.4), shore);
  float ripple = sin(rippleShore * 5.0 - (river ? 0.0 : uTime * 1.6) + noise(world * 1.3) * 4.0);
  float rings = smoothstep(0.82, 0.95, ripple)
              * (1.0 - smoothstep(0.4, 2.8, rippleShore))
              * smoothstep(0.35, 0.55, noise(shoreNoise));
  color = mix(color, uSeaFoam * uShoreFoam, max(contact, rings * 0.8));

  // Normal con un poco de oleaje para el reflejo y los destellos
  vec2 slope = (vec2(noise(uv * 1.5), noise(uv * 1.5 + 17.0)) - 0.5) * 0.3 * detail;
  vec3 N = normalize(vec3(slope.x, 1.0, slope.y));
  vec3 R = reflect(dir, N);
  R.y = abs(R.y);

  // Reflejo del degradado del cielo (sin el disco: el sol va en los destellos)
  float fresnel = 0.02 + 0.98 * pow(1.0 - clamp(-dir.y, 0.0, 1.0), 5.0);
  color = mix(color, skyGradient(R), fresnel * uSeaReflection);

  // Camino de destellos hacia el sol (superan el umbral del bloom)
  float sparkle = smoothstep(0.9990, 0.9996, dot(R, uSunDiscDir)) * step(0.5, noise(uv * 4.0));
  color += uSunColor * sparkle * uSeaSparkle;

  // Bruma. Río: la misma que la niebla del terreno (color del horizonte).
  // Mar: se funde con el cielo a ras de agua
  float haze = smoothstep(uSeaHaze.x, uSeaHaze.y, dist);
  vec3 hazeColor = uRiverMode > 0.5 ? uHorizonColor : skyColor(normalize(vec3(dir.x, 0.0, dir.z)));
  return mix(color, hazeColor, haze);
}

void main() {
  vec3 dir = normalize(vDirection);
  vec3 color = dir.y < 0.0 ? sea(dir) : skyColor(dir);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
