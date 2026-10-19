// Lente del catalejo ("Material.001"): cristal abombado con iris interior,
// reflejo del cielo, especular del sol y destellos cartoon fijos a la cámara

uniform mat3 uLensRot;       // rotación mundo de la malla (columnas normalizadas)
uniform float uLensRadius;
uniform float uBulge;        // curvatura falsa del cristal
uniform float uDepth;        // profundidad aparente del iris (paralaje)
uniform vec3 uDeep;
uniform vec3 uIris;
uniform vec3 uGlow;
uniform float uGlowStrength;
uniform vec3 uHorizon;
uniform vec3 uZenith;

void main() {
  // Coordenadas locales del glTF: el disco está en XY y mira hacia +Z
  vec3 local = vec3(vObjB.x, vObjB.z, -vObjB.y);
  vec2 p = local.xy / uLensRadius;
  float r = length(p);

  vec3 N = normalize(uLensRot * vec3(p * uBulge, 1.0));
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdotV = clamp(dot(N, V), 0.0, 1.0);

  // Interior: el iris se desplaza con la vista como si estuviera hundido en el cristal
  vec3 viewLocal = transpose(uLensRot) * V;
  vec2 q = p - viewLocal.xy / max(viewLocal.z, 0.25) * uDepth;
  float rq = length(q);
  float angle = atan(q.y, q.x);

  float irisMask = 1.0 - smoothstep(0.68, 0.72, rq);
  float streaks = 0.65 + 0.35 * sin(angle * 22.0 + sin(angle * 5.0) * 2.0);
  float ringLine = 1.0 - smoothstep(0.0, 0.035, abs(rq - 0.72));
  float pulse = 0.85 + 0.15 * sin(uTime * 2.5);
  float pupil = 1.0 - smoothstep(0.2, 0.26, rq);
  float halo = exp(-rq * rq * 18.0);

  vec3 color = uDeep;
  color = mix(color, uIris * streaks * (1.2 - rq), irisMask);
  color += uIris * ringLine * 0.8;
  color += uGlow * halo * 0.6 * pulse;
  color = mix(color, uGlow * uGlowStrength * pulse, pupil);

  // Sombra en el borde, donde el cristal se mete en el tubo
  color *= smoothstep(1.05, 0.78, r);

  // Reflejo del cielo con Fresnel
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.6, R.y));
  float fresnel = 0.06 + 0.94 * pow(1.0 - NdotV, 4.0);
  color = mix(color, sky, fresnel);

  // Especular del sol (supera el umbral del bloom)
  color += vec3(pow(max(dot(R, normalize(uSunDir)), 0.0), 400.0) * 6.0);

  // Destellos cartoon: dos manchas nítidas, arriba a la izquierda en pantalla
  mat3 viewToWorld = transpose(mat3(viewMatrix));
  vec3 glintA = normalize(viewToWorld * vec3(-0.5, 0.6, 1.0));
  vec3 glintB = normalize(viewToWorld * vec3(-0.18, 0.25, 1.0));
  float glint = smoothstep(0.986, 0.99, dot(R, glintA))
              + smoothstep(0.997, 0.998, dot(R, glintB)) * 0.8;
  color = mix(color, vec3(1.8), clamp(glint, 0.0, 1.0) * step(r, 0.95));

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
