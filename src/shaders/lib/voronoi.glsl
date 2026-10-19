// ---------------------------------------------------------------
// Voronoi Texture de Blender (3D, F1)
// ---------------------------------------------------------------

#define VORONOI_EUCLIDEAN 0
#define VORONOI_MINKOWSKI 1

float bl_voronoi_distance(vec3 a, vec3 b, int metric, float exponent) {
  if (metric == VORONOI_EUCLIDEAN) return distance(a, b);
  vec3 d = abs(a - b);
  return pow(pow(d.x, exponent) + pow(d.y, exponent) + pow(d.z, exponent), 1.0 / exponent);
}

// coord ya multiplicado por "Scale"
void bl_voronoi_f1(vec3 coord, int metric, float exponent, float randomness, out float dist, out vec3 color) {
  vec3 cellF = floor(coord);
  vec3 local = coord - cellF;
  ivec3 cell = ivec3(cellF);
  float minDist = 3.4e38;
  ivec3 target = ivec3(0);

  for (int k = -1; k <= 1; k++) {
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        ivec3 offset = ivec3(i, j, k);
        vec3 point = vec3(offset) + bl_hash_ivec3_to_vec3(cell + offset) * randomness;
        float d = bl_voronoi_distance(point, local, metric, exponent);
        if (d < minDist) {
          target = offset;
          minDist = d;
        }
      }
    }
  }

  dist = minDist;
  color = bl_hash_ivec3_to_vec3(cell + target);
}

// Salida "Color" con Detail/Roughness/Lacunarity (fractal), como en Blender 4+
vec3 bl_voronoi_color(vec3 co, float scale, float detail, float roughness, float lacunarity,
                      int metric, float exponent, bool doNormalize) {
  vec3 coord = co * scale;
  float amplitude = 1.0, maxAmp = 0.0, octaveScale = 1.0;
  vec3 color = vec3(0.0);
  bool zeroInput = detail == 0.0 || roughness == 0.0 || lacunarity == 0.0;
  int n = int(ceil(detail));

  for (int i = 0; i <= 15; i++) {
    if (i > n) break;
    float d;
    vec3 c;
    bl_voronoi_f1(coord * octaveScale, metric, exponent, 1.0, d, c);
    if (zeroInput) return c;

    if (float(i) <= detail) {
      maxAmp += amplitude;
      color += c * amplitude;
      octaveScale *= lacunarity;
      amplitude *= roughness;
    } else {
      float r = detail - floor(detail);
      if (r != 0.0) {
        maxAmp = mix(maxAmp, maxAmp + amplitude, r);
        color = mix(color, color + c * amplitude, r);
      }
    }
  }
  return doNormalize ? color / maxAmp : color;
}
