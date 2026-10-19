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

// Mar infinito: plano analítico bajo el horizonte (no viene del .blend)
uniform vec3 uCameraPos;
uniform float uTime;
uniform float uSeaLevel;
uniform vec3 uSeaShallow;
uniform vec3 uSeaDeep;
uniform vec3 uSeaFoam;
uniform float uSeaScale;
uniform float uSeaSpeed;
uniform float uSeaReflection;
uniform float uSeaSparkle;
uniform vec2 uSeaHaze;       // distancia donde empieza / termina la bruma

// Orilla de la isla
uniform float uLowLevel;     // agua de la mitad delantera, más baja
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

// Junto a la mitad delantera de la isla el mar baja hasta su nivel de agua,
// para que la orilla coincida con el borde; lejos vuelve al nivel general
float seaLevelAt(vec2 p) {
  float front = smoothstep(0.2, 1.4, p.y);
  float near = 1.0 - smoothstep(1.0, 8.0, islandDistance(p));
  return mix(uSeaLevel, uLowLevel, front * near);
}

vec3 sea(vec3 dir) {
  // Intersección con una superficie de altura variable por punto fijo.
  // Altura mínima para que el mar nunca desaparezca si la cámara baja
  float level = uSeaLevel;
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

  // Manchas por celdas, como el suelo que se ve a través del agua de Blender
  vec3 patches = voronoi(world * uSeaScale, uTime * 0.15);
  vec3 color = mix(uSeaShallow, uSeaDeep, patches.z * detail);

  // Espuma: crestas cortas en los bordes de celdas pequeñas y estiradas
  vec2 uv = vec2(world.x * 0.5, world.y) * uSeaScale * 3.0 + vec2(0.0, uTime * uSeaSpeed);
  vec3 waves = voronoi(uv, uTime * 0.8);
  float aa = fwidth(waves.y) + 1e-4;
  float foam = 1.0 - smoothstep(0.03 - aa, 0.03 + aa, waves.y);
  foam *= smoothstep(0.72, 0.8, noise(uv * 0.6 + 3.7)) * smoothstep(0.25, 0.6, waves.x);
  foam *= 1.0 - smoothstep(10.0, 40.0, dist);
  color = mix(color, uSeaFoam, foam);

  // Orilla: agua clara, espuma de contacto y ondas que se alejan de la costa
  float shore = islandDistance(world);
  color = mix(uShoreColor, color, smoothstep(0.0, 3.5, shore));
  float contact = 1.0 - smoothstep(0.0, 0.3 + 0.25 * noise(world * 2.0 + uTime * 0.4), shore);
  float ripple = sin(shore * 5.0 - uTime * 1.6 + noise(world * 1.3) * 4.0);
  float rings = smoothstep(0.82, 0.95, ripple)
              * (1.0 - smoothstep(0.4, 2.8, shore))
              * smoothstep(0.35, 0.55, noise(world * 1.1 - uTime * 0.15));
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

  // Bruma hacia el horizonte: se funde con el color del cielo a ras de agua
  float haze = smoothstep(uSeaHaze.x, uSeaHaze.y, dist);
  return mix(color, skyColor(normalize(vec3(dir.x, 0.0, dir.z))), haze);
}

void main() {
  vec3 dir = normalize(vDirection);
  vec3 color = dir.y < 0.0 ? sea(dir) : skyColor(dir);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
