attribute float aShade;   // 0 = base de la nube, 1 = cima

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vShade;

void main() {
  vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);

  // Las instancias usan escala uniforme
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vWorldPosition = worldPosition.xyz;
  vShade = aShade;

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
