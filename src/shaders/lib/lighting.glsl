// ---------------------------------------------------------------
// Iluminación de la escena de Blender (EEVEE)
//   Sol: strength en W/m²  ->  difuso = albedo * E * N·L / PI
//   World para rayos no-cámara: gris uniforme -> difuso = albedo * L
// ---------------------------------------------------------------

float bl_sun_term(vec3 N, float shadow) {
  return uSunStrength * RECIPROCAL_PI * max(dot(N, uSunDir), 0.0) * shadow;
}

// Diffuse BSDF
vec3 bl_diffuse_bsdf(vec3 albedo, vec3 N, float shadow) {
  return albedo * (bl_sun_term(N, shadow) + uWorldColor);
}

// Aproximación analítica del BRDF integrado (Karis)
vec2 bl_env_brdf(float roughness, float NoV) {
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
  const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = roughness * c0 + c1;
  float a004 = min(r.x * r.x, exp2(-9.28 * NoV)) * r.x + r.y;
  return vec2(-1.04, 1.04) * a004 + r.zw;
}

// Principled BSDF (difuso Lambert + especular GGX)
vec3 bl_principled_bsdf(vec3 base, float metallic, float roughness, vec3 N, vec3 V, float shadow) {
  vec3 L = uSunDir;
  vec3 H = normalize(L + V);
  float NdL = max(dot(N, L), 0.0);
  float NdV = max(dot(N, V), 1e-4);
  float NdH = max(dot(N, H), 0.0);
  float VdH = max(dot(V, H), 0.0);

  vec3 F0 = mix(vec3(0.04), base, metallic);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - VdH, 5.0);

  float a = max(roughness * roughness, 0.0005);
  float a2 = a * a;
  float D = a2 / (PI * pow2(NdH * NdH * (a2 - 1.0) + 1.0));
  float gv = NdL * sqrt(NdV * NdV * (1.0 - a2) + a2);
  float gl = NdV * sqrt(NdL * NdL * (1.0 - a2) + a2);
  float Vis = 0.5 / max(gv + gl, 1e-5);

  vec3 specSun = D * Vis * F * uSunStrength * NdL * shadow;
  vec2 ab = bl_env_brdf(roughness, NdV);
  vec3 specAlbedo = F0 * ab.x + ab.y;
  vec3 specWorld = uWorldColor * specAlbedo;

  vec3 diffuse = base * (1.0 - metallic) * (1.0 - (0.04 * ab.x + ab.y))
               * (bl_sun_term(N, shadow) + uWorldColor);

  return diffuse + specSun + specWorld;
}
