// Material "Splash": Shader to RGB -> Color Ramp (constante) -> Emission 1.6

void main() {
  float island = 1.0;
  #ifdef ISLAND_MASK
    island = islandMask(vWorldPos.xz);
    if (island <= 0.0) discard;
  #endif

  vec3 N = normalize(vWorldNormal);
  #ifdef SPLASH_ANIMATED
    // Blender recalcula las normales después de Set Position
    N = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
    if (dot(N, cameraPosition - vWorldPos) < 0.0) N = -N;
  #endif
  float shadow = getShadowMask();
  float shade = bl_luminance(bl_diffuse_bsdf(vec3(0.8), N, shadow));
  vec3 color = shade < 0.295 ? vec3(0.037, 0.111, 0.156) : vec3(1.0);

  gl_FragColor = vec4(color * 1.6, island);
  #include <colorspace_fragment>
}
