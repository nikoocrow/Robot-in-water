// Nubes de humo: esferas con luz envolvente, bordes translúcidos y bruma de distancia
uniform vec3 uSunDir;
uniform vec3 uSunDiscDir;   // disco solar visible (contraluz)
uniform vec3 uSunColor;
uniform vec3 uLit;
uniform vec3 uShadow;
uniform vec3 uRim;
uniform vec3 uHaze;
uniform float uHazeAmount;
uniform float uWrap;
uniform float uSoftEdge;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vShade;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPosition);
  vec3 L = normalize(uSunDir);
  float facing = clamp(dot(N, V), 0.0, 1.0);

  // Difuso "wrap": la luz rodea la esfera, sin terminador duro
  float diffuse = clamp((dot(N, L) + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  diffuse = smoothstep(0.0, 1.0, diffuse);

  // Oclusión falsa: la base del racimo recibe menos luz
  float light = diffuse * mix(0.6, 1.0, vShade);
  vec3 color = mix(uShadow, uLit, light);

  // Borde luminoso, más intenso a contraluz del disco solar
  float fresnel = pow(1.0 - facing, 2.0);
  float towardSun = clamp(dot(-V, normalize(uSunDiscDir)), 0.0, 1.0);
  float backlight = pow(towardSun, 4.0);
  color = mix(color, uRim, fresnel * (0.5 + 0.5 * backlight));

  // Ribete dorado en las nubes que pasan por delante del sol
  color += uSunColor * pow(towardSun, 800.0) * (0.1 + 1.6 * fresnel);

  color = mix(color, uHaze, uHazeAmount);

  // El contorno de cada esfera se desvanece: aspecto de humo, no de bola sólida
  float alpha = smoothstep(0.0, uSoftEdge, facing);

  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
