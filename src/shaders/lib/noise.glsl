// ---------------------------------------------------------------
// Noise Texture de Blender (Perlin + fBM normalizado)
// ---------------------------------------------------------------

float bl_fade(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float bl_negate_if(float v, uint c) {
  return c != 0u ? -v : v;
}

float bl_grad(uint hash, float x, float y, float z) {
  uint h = hash & 15u;
  float u = h < 8u ? x : y;
  float vt = (h == 12u || h == 14u) ? x : z;
  float v = h < 4u ? y : vt;
  return bl_negate_if(u, h & 1u) + bl_negate_if(v, h & 2u);
}

float bl_perlin(vec3 p) {
  vec3 fl = floor(p);
  ivec3 i = ivec3(fl);
  vec3 f = p - fl;
  uint X = uint(i.x), Y = uint(i.y), Z = uint(i.z);
  float u = bl_fade(f.x), v = bl_fade(f.y), w = bl_fade(f.z);

  float n000 = bl_grad(bl_hash_uint3(X,      Y,      Z),      f.x,       f.y,       f.z);
  float n100 = bl_grad(bl_hash_uint3(X + 1u, Y,      Z),      f.x - 1.0, f.y,       f.z);
  float n010 = bl_grad(bl_hash_uint3(X,      Y + 1u, Z),      f.x,       f.y - 1.0, f.z);
  float n110 = bl_grad(bl_hash_uint3(X + 1u, Y + 1u, Z),      f.x - 1.0, f.y - 1.0, f.z);
  float n001 = bl_grad(bl_hash_uint3(X,      Y,      Z + 1u), f.x,       f.y,       f.z - 1.0);
  float n101 = bl_grad(bl_hash_uint3(X + 1u, Y,      Z + 1u), f.x - 1.0, f.y,       f.z - 1.0);
  float n011 = bl_grad(bl_hash_uint3(X,      Y + 1u, Z + 1u), f.x,       f.y - 1.0, f.z - 1.0);
  float n111 = bl_grad(bl_hash_uint3(X + 1u, Y + 1u, Z + 1u), f.x - 1.0, f.y - 1.0, f.z - 1.0);

  return mix(
    mix(mix(n000, n100, u), mix(n010, n110, u), v),
    mix(mix(n001, n101, u), mix(n011, n111, u), v),
    w
  );
}

float bl_snoise(vec3 p) {
  return 0.982 * bl_perlin(p);
}

// Noise Texture: 3D, FBM, normalize = true, distortion = 0
float bl_noise_texture(vec3 co, float scale, float detail, float roughness, float lacunarity) {
  vec3 p = co * scale;
  float fscale = 1.0, amp = 1.0, maxamp = 0.0, sum = 0.0;
  int n = int(detail);
  for (int i = 0; i <= 15; i++) {
    if (i > n) break;
    float t = bl_snoise(fscale * p);
    sum += t * amp;
    maxamp += amp;
    amp *= roughness;
    fscale *= lacunarity;
  }
  float rmd = detail - floor(detail);
  if (rmd != 0.0) {
    float t = bl_snoise(fscale * p);
    float sum2 = sum + t * amp;
    return mix(0.5 * sum / maxamp + 0.5, 0.5 * sum2 / (maxamp + amp) + 0.5, rmd);
  }
  return 0.5 * sum / maxamp + 0.5;
}
