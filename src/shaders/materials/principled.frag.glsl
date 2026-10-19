// Principled BSDF simple ("Text", "Black", "Material.002")

uniform vec3 uBaseColor;
uniform float uMetallic;
uniform float uRoughness;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float shadow = getShadowMask();
  vec3 color = bl_principled_bsdf(uBaseColor, uMetallic, uRoughness, N, V, shadow);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
