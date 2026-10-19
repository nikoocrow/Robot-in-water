// ---------------------------------------------------------------
// Nodos utilitarios de Blender
// ---------------------------------------------------------------

#define RAMP_LINEAR 0
#define RAMP_EASE 1
#define RAMP_CONSTANT 2

// Conversión implícita color -> float (luma Rec.709 de Blender)
float bl_luminance(vec3 c) {
  return dot(c, vec3(0.2126729, 0.7151522, 0.0721750));
}

// Color Ramp genérico de hasta 4 paradas
vec3 bl_color_ramp(float f, float pos[4], vec3 col[4], int count, int interp) {
  if (f <= pos[0]) return col[0];
  for (int i = 0; i < 3; i++) {
    if (i + 1 >= count) break;
    if (f < pos[i + 1]) {
      if (interp == RAMP_CONSTANT) return col[i];
      float t = (f - pos[i]) / max(pos[i + 1] - pos[i], 1e-6);
      if (interp == RAMP_EASE) t = t * t * (3.0 - 2.0 * t);
      return mix(col[i], col[i + 1], t);
    }
  }
  return col[count - 1];
}

// Color Ramp blanco (p0) -> negro (p1); devuelve el gris resultante
float bl_ramp_white_to_black(float f, float p0, float p1, int interp) {
  if (f <= p0) return 1.0;
  if (f >= p1) return 0.0;
  if (interp == RAMP_CONSTANT) return 1.0;
  float t = (f - p0) / (p1 - p0);
  if (interp == RAMP_EASE) t = t * t * (3.0 - 2.0 * t);
  return 1.0 - t;
}

vec3 bl_mix_darken(vec3 a, vec3 b, float f) {
  return mix(a, min(a, b), clamp(f, 0.0, 1.0));
}

vec3 bl_mix_multiply(vec3 a, vec3 b, float f) {
  return mix(a, a * b, clamp(f, 0.0, 1.0));
}

float bl_overlay(float a, float b) {
  return a < 0.5 ? a * 2.0 * b : 1.0 - 2.0 * (1.0 - b) * (1.0 - a);
}

float bl_map_range(float v, float fromMin, float fromMax, float toMin, float toMax) {
  float r = toMin + (v - fromMin) / (fromMax - fromMin) * (toMax - toMin);
  return clamp(r, min(toMin, toMax), max(toMin, toMax));
}

float bl_fresnel_dielectric_cos(float cosi, float eta) {
  float c = abs(cosi);
  float g = eta * eta - 1.0 + c * c;
  if (g > 0.0) {
    g = sqrt(g);
    float A = (g - c) / (g + c);
    float B = (c * (g + c) - 1.0) / (c * (g - c) + 1.0);
    return 0.5 * A * A * (1.0 + B * B);
  }
  return 1.0;
}

float bl_fresnel(float ior, vec3 N, vec3 V) {
  float eta = max(ior, 0.00001);
  eta = gl_FrontFacing ? eta : 1.0 / eta;
  return bl_fresnel_dielectric_cos(dot(V, N), eta);
}
