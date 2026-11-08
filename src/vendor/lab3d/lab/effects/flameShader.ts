/** GLSL lửa đèn cồn: Lathe hình giọt, dịch đỉnh theo nhiễu, màu theo chiều cao, alpha theo fresnel. */
export const FLAME_VERT = /* glsl */ `
uniform float uTime;
uniform float uHeight;
uniform float uSway;
varying float vH;
varying vec3 vNormalV;
varying vec3 vViewPos;
float hash(float n) { return fract(sin(n) * 43758.5453); }
float noise(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(i), hash(i + 1.0), f) * 2.0 - 1.0; }
void main() {
  vec3 p = position;
  float h = clamp(p.y / uHeight, 0.0, 1.0);
  float flick = 1.0 + 0.10 * noise(uTime * 9.0) + 0.05 * noise(uTime * 23.0 + 3.0);
  p.y *= flick;
  float bend = pow(h, 1.6) * uSway;
  p.x += bend * noise(uTime * 2.3 + h * 2.0);
  p.z += bend * noise(uTime * 2.9 + 7.0 + h * 2.0);
  p.xz *= 1.0 + 0.08 * noise(uTime * 11.0 + h * 6.0);
  vH = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

export const FLAME_FRAG = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform vec3 uBase;
uniform vec3 uMid;
uniform vec3 uTip;
uniform float uAlpha;
varying float vH;
varying vec3 vNormalV;
varying vec3 vViewPos;
void main() {
  float f = abs(dot(normalize(vNormalV), normalize(-vViewPos)));
  float core = pow(f, 1.4);
  vec3 col = mix(uBase, uMid, smoothstep(0.0, 0.45, vH));
  col = mix(col, uTip, smoothstep(0.5, 1.0, vH));
  float a = core * uAlpha * uIntensity;
  a *= smoothstep(0.0, 0.08, vH) * (1.0 - smoothstep(0.82, 1.0, vH));
  a *= 0.85 + 0.15 * sin(uTime * 17.0 + vH * 9.0);
  gl_FragColor = vec4(col * a, a);
  #include <colorspace_fragment>
}`;
