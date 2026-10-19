#include <common>
#include <shadowmap_pars_vertex>

#ifdef HAS_PAINT_EDGE
  attribute float _paint_edge;
  attribute float _edge_width;
  attribute vec3 _point_normal;
#endif
#ifdef HAS_DATA_SURFACE
  attribute vec3 _data_surface;
  attribute vec3 _data_edge_noise;
#endif
#ifdef HAS_SELF_SCALE
  attribute vec3 _self_scale;
#endif
#ifdef SPLASH_ANIMATED
  // Geometry Nodes "Curve Splash": geometría antes de Set Position
  attribute vec3 _splash_base;
  attribute vec3 _splash_dir;
  attribute float _splash_amp;
  uniform vec3 uSplashSpeed;     // "Speed & Dir" (ejes de Blender)
  uniform float uSplashScale;    // "Scale"
  uniform float uSplashCurve[65];// Float Curve muestreada

  float splashFloatCurve(float x) {
    float f = clamp(x, 0.0, 1.0) * 64.0;
    int i = int(floor(f));
    if (i >= 64) return uSplashCurve[64];
    return mix(uSplashCurve[i], uSplashCurve[i + 1], f - float(i));
  }
#endif

uniform float uTime;  // Scene Time (segundos)

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vObjB;          // coordenadas "Object" en ejes de Blender
varying vec2 vUv;            // UV con la V de Blender
varying float vPaintEdge;
varying float vEdgeWidth;
varying vec3 vPointNormalW;
varying vec3 vDataSurface;
varying vec3 vEdgeNoise;
varying vec3 vSelfScale;
varying vec2 vMask;

void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>

  #ifdef SPLASH_ANIMATED
    // Set Position: offset = mix(Normal, Z, 0.5) * FloatCurve(Noise(Position - Speed * t)) * Radius * Width
    float splashNoise = bl_noise_texture(_splash_base - uSplashSpeed * uTime, uSplashScale, 2.0, 0.5, 2.0);
    vec3 splashPos = _splash_base + _splash_dir * splashFloatCurve(splashNoise) * _splash_amp;
    transformed = vec3(splashPos.x, splashPos.z, -splashPos.y);
  #endif

  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>

  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif

  vWorldPos = (m * vec4(transformed, 1.0)).xyz;
  vWorldNormal = normalize(transpose(inverse(mat3(m))) * normal);

  // glTF (Y arriba) -> Blender (Z arriba)
  vObjB = vec3(transformed.x, -transformed.z, transformed.y);
  vUv = vec2(uv.x, 1.0 - uv.y);

  vPaintEdge = 0.0;
  vEdgeWidth = 0.0;
  vPointNormalW = vWorldNormal;
  vDataSurface = vec3(0.0);
  vEdgeNoise = vec3(0.0);
  vSelfScale = vec3(0.0);
  vMask = vec2(0.0);

  #ifdef HAS_PAINT_EDGE
    vPaintEdge = _paint_edge;
    vEdgeWidth = _edge_width;
    // Vector Transform (Object -> World); el atributo viene en ejes de Blender
    vPointNormalW = mat3(m) * vec3(_point_normal.x, _point_normal.z, -_point_normal.y);
  #endif
  #ifdef HAS_DATA_SURFACE
    vDataSurface = _data_surface;
    vEdgeNoise = _data_edge_noise;
  #endif
  #ifdef HAS_SELF_SCALE
    vSelfScale = _self_scale;
  #endif
  #ifdef USE_COLOR
    vMask = color.rg;
  #endif
}
