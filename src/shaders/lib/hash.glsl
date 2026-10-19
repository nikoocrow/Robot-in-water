// ---------------------------------------------------------------
// Hashes idénticos a los de Blender 5.x
// ---------------------------------------------------------------

// PCG 3D (Blender lo usa en el nodo Voronoi)
ivec3 bl_hash_pcg3d(ivec3 v) {
  v = v * 1664525 + 1013904223;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v & 0x7FFFFFFF;
}

vec3 bl_hash_ivec3_to_vec3(ivec3 k) {
  return vec3(bl_hash_pcg3d(k)) * (1.0 / float(0x7FFFFFFF));
}

// Jenkins lookup3 (Blender lo usa en el ruido Perlin)
uint bl_rot(uint x, uint k) {
  return (x << k) | (x >> (32u - k));
}

uint bl_hash_uint3(uint kx, uint ky, uint kz) {
  uint a, b, c;
  a = b = c = 0xdeadbeefu + (3u << 2u) + 13u;
  c += kz;
  b += ky;
  a += kx;
  c ^= b; c -= bl_rot(b, 14u);
  a ^= c; a -= bl_rot(c, 11u);
  b ^= a; b -= bl_rot(a, 25u);
  c ^= b; c -= bl_rot(b, 16u);
  a ^= c; a -= bl_rot(c, 4u);
  b ^= a; b -= bl_rot(a, 14u);
  c ^= b; c -= bl_rot(b, 24u);
  return c;
}
