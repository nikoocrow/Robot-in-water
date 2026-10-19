varying vec3 vDirection;

void main() {
  vDirection = position;
  vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = pos.xyww;
}
