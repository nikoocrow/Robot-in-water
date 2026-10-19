// Material "Water"
//   UV -> Mapping -> Voronoi (Distance) combinado con los atributos Bright / Dark
//   Mix Shader: 32 % Diffuse + 68 % Transparent, espuma con Emission 2.1

uniform vec3 uShallowColor;
uniform vec3 uDeepColor;
uniform float uDiffuseAmount;
uniform float uFoamStrength;

void main() {
  float island = islandMask(vWorldPos.xz);
  if (island <= 0.0) discard;

  vec3 N = normalize(vWorldNormal);
  if (!gl_FrontFacing) N = -N;
  float shadow = getShadowMask();

  float bright = vMask.r;
  float dark = vMask.g;

  // Mapping (Point): UV * (5, 1, 1) + (0, frame / 20, 0)  <- driver del .blend
  float frame = uTime * uFps;
  vec3 p = vec3(vUv.x * 5.0, vUv.y + frame / 20.0, 0.0);
  float dist;
  vec3 c;
  bl_voronoi_f1(p * 5.0, VORONOI_EUCLIDEAN, 0.0, 1.0, dist, c);

  float foam = bl_overlay(dist, 1.0 - bright) < 0.3 ? 1.0 : 0.0;
  foam = foam * bright > 0.2 ? 1.0 : 0.0;

  float deep = bl_overlay(dist, dark) > 0.5 ? 1.0 : 0.0;
  deep = deep * dark > 0.1 ? 1.0 : 0.0;

  vec3 albedo = mix(uShallowColor, uDeepColor, deep);
  vec3 diffuse = bl_diffuse_bsdf(albedo, N, shadow);

  gl_FragColor = foam > 0.5
    ? vec4(vec3(uFoamStrength), island)
    : vec4(diffuse, uDiffuseAmount * island);
  #include <colorspace_fragment>
}
