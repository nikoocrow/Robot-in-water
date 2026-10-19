// Silueta de la isla (no viene del .blend): superelipse con ondulaciones.
// Coordenadas de mundo de Three.js en el plano XZ. Negativo = dentro.
uniform float uIslandRadius;
uniform float uIslandRoundness;  // exponente: 2 = círculo, más alto = más cuadrada
uniform float uIslandWobble;     // amplitud de las ondulaciones (fracción del radio)
uniform float uIslandSeed;

float islandDistance(vec2 p) {
  float a = atan(p.y, p.x);
  float n = uIslandRoundness;
  float shape = pow(pow(abs(cos(a)), n) + pow(abs(sin(a)), n), -1.0 / n);
  float s = uIslandSeed;
  float wobble = 0.5 * sin(3.0 * a + s)
               + 0.3 * sin(5.0 * a + 2.0 * s)
               + 0.2 * sin(9.0 * a + 3.0 * s);
  return length(p) - uIslandRadius * shape * (1.0 + uIslandWobble * wobble);
}

// 1 dentro, 0 fuera, con antialias de un píxel en el borde
float islandMask(vec2 p) {
  float d = islandDistance(p);
  float w = fwidth(d) + 1e-4;
  return 1.0 - smoothstep(-w, w, d);
}
