// Materiales "Blue", "Metal" y "spyglass" + grupo "Paint Edge"

uniform float uRampPos[4];
uniform vec3 uRampCol[4];
uniform int uRampCount;
uniform float uMetallic;
uniform float uRoughness;
uniform vec3 uTexLoc;      // texspace del objeto (para coordenadas Generated)
uniform vec3 uTexSize;
uniform vec3 uEdgeLit;     // Paint Edge: Socket_2
uniform vec3 uEdgeDark;    // Paint Edge: Socket_3
#ifdef USE_RIM
  uniform float uRimIor;
  uniform vec3 uRimLit;
  uniform vec3 uRimDark;
#endif

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float shadow = getShadowMask();

  // Diffuse BSDF -> Shader to RGB
  float shade = bl_luminance(bl_diffuse_bsdf(vec3(0.8), N, shadow));

  // Voronoi.001 (Euclidean, scale 5) sobre coordenadas Generated
  vec3 generated = (vObjB - (uTexLoc - uTexSize)) / (2.0 * uTexSize);
  float d;
  vec3 jitter;
  bl_voronoi_f1(generated * 5.0, VORONOI_EUCLIDEAN, 0.0, 1.0, d, jitter);

  // Mapping (Texture): location = (color - 0.5) * 0.05 + data_surface, scale (1, 0.8, 0.9)
  vec3 location = (jitter - 0.5) * 0.05 + vDataSurface;
  vec3 coord = (vObjB - location) / vec3(1.0, 0.8, 0.9);

  // Voronoi (Minkowski 0.7, scale 5) -> Color Ramp
  vec3 cellColor;
  bl_voronoi_f1(coord * 5.0, VORONOI_MINKOWSKI, 0.7, 1.0, d, cellColor);
  vec3 base = bl_color_ramp(bl_luminance(cellColor), uRampPos, uRampCol, uRampCount, RAMP_LINEAR);

  // Toon: Darken 0.95 en la zona de sombra
  vec3 darkened = bl_mix_darken(base, vec3(0.015, 0.043, 0.077), 0.95);
  float inShadow = bl_ramp_white_to_black(shade, 0.291, 0.367, RAMP_LINEAR);
  vec3 toon = mix(base, darkened, inShadow);

  // Principled -> Shader to RGB, mezclado 50/50 con el toon
  vec3 principled = bl_principled_bsdf(base, uMetallic, uRoughness, N, V, shadow);
  vec3 color = mix(principled, toon, 0.5);

  // Tinte violeta en caras que miran hacia abajo
  float down = bl_map_range(N.y, -1.0, 1.0, 1.0, 0.0);
  color = bl_mix_multiply(color, vec3(0.178, 0.151, 0.203), down);

  // ---- Grupo "Paint Edge" ----
  vec3 edgeNormal = normalize(mix(N, vPointNormalW, 0.25));
  float edgeShadeValue = bl_luminance(bl_diffuse_bsdf(vec3(0.8), edgeNormal, shadow));
  float edgeShade = bl_ramp_white_to_black(edgeShadeValue, 0.382, 0.513, RAMP_CONSTANT);
  vec3 edgeColor = mix(uEdgeLit, uEdgeDark, edgeShade);

  float noise = bl_noise_texture(vObjB + vEdgeNoise, 2.0, 2.0, 0.5, 2.0);
  float noiseRamp = 1.0 - bl_ramp_white_to_black(noise, 0.487, 0.876, RAMP_LINEAR);
  float isEdge = (vPaintEdge - noiseRamp) > vEdgeWidth ? 1.0 : 0.0;
  color = mix(color, edgeColor, isEdge);

  #ifdef USE_RIM
    // Borde por Fresnel (solo "Blue")
    float rimShade = bl_ramp_white_to_black(shade, 0.265, 0.345, RAMP_LINEAR);
    vec3 rim = mix(uRimLit, uRimDark, rimShade);
    float isRim = bl_fresnel(uRimIor, N, V) > 0.5 ? 1.0 : 0.0;
    color = mix(color, rim, isRim);
  #endif

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
