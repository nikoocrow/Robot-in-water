// Emission / color directo a Surface ("Eye")

uniform vec3 uEmission;

void main() {
  gl_FragColor = vec4(uEmission, 1.0);
  #include <colorspace_fragment>
}
