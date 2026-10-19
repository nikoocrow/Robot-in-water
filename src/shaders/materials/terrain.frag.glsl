// Materiales "Rock" y "Ground"

uniform float uRampPos[4];
uniform vec3 uRampCol[4];
uniform int uRampInterp;
uniform float uShadowFrom;
uniform float uShadowTo;
uniform vec3 uRimLit;
uniform float uRimIor;
uniform float uIslandEdge;

void main() {
  #ifdef ISLAND_MASK
    float island = islandMask(vWorldPos.xz);
    if (island <= 0.0) discard;
  #endif

  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float shadow = getShadowMask();

  #ifdef TERRAIN_ROCK
    // Mapping (Point): Geometry.Position * self_scale + (20.4, 0.9, 2.8)
    vec3 worldB = vec3(vWorldPos.x, -vWorldPos.z, vWorldPos.y);
    vec3 coord = worldB * vSelfScale + vec3(20.4, 0.9, 2.8);
    vec3 cells = bl_voronoi_color(coord, 2.5, 4.1, 0.5, 2.0, VORONOI_MINKOWSKI, 0.8, true);
  #else
    // Mapping (Point): Object + (8.1, 0, 0)
    vec3 coord = vObjB + vec3(8.1, 0.0, 0.0);
    vec3 cells = bl_voronoi_color(coord, 1.0, 0.5, 0.5, 2.0, VORONOI_MINKOWSKI, 0.5, true);
  #endif

  vec3 base = bl_color_ramp(bl_luminance(cells), uRampPos, uRampCol, 4, uRampInterp);

  float shade = bl_luminance(bl_diffuse_bsdf(vec3(0.8), N, shadow));
  float inShadow = bl_ramp_white_to_black(shade, uShadowFrom, uShadowTo, RAMP_LINEAR);

  vec3 color = bl_mix_multiply(base, vec3(0.179), inShadow);
  float down = bl_map_range(N.y, -1.0, 1.0, 1.0, 0.0);
  color = bl_mix_multiply(color, vec3(0.071, 0.099, 0.172), down);

  // Rim por Fresnel
  vec3 rim = mix(uRimLit, vec3(0.006, 0.077, 0.157), inShadow);
  float isRim = bl_fresnel(uRimIor, N, V) > 0.5 ? 1.0 : 0.0;
  color = mix(color, rim, isRim);

  #ifdef ISLAND_MASK
    // Franja de roca mojada junto a la costa
    float wet = smoothstep(-uIslandEdge, 0.0, islandDistance(vWorldPos.xz));
    color *= mix(1.0, 0.55, wet);
    gl_FragColor = vec4(color, island);
  #else
    gl_FragColor = vec4(color, 1.0);
  #endif
  #include <colorspace_fragment>
}
