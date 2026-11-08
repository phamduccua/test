/** GLSL cho createVolumeGas: raymarch trụ (toạ độ cục bộ, đáy y = 0), mật độ = phân tầng × mặt trước × fbm cuộn xoáy. */
export const VOLUME_GAS_VERT = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const VOLUME_GAS_FRAG = /* glsl */ `
uniform vec3 uCam;
uniform float uR, uH, uDensity, uFront, uStrat, uTime, uFreq, uRise, uMode;
uniform vec3 uSigma;
uniform vec3 uGlow;
varying vec3 vPos;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * noise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
float density(vec3 p) {
  float h = p.y / uH;
  float r = length(p.xz) / uR;
  float front = smoothstep(uFront + 0.1, uFront - 0.14, h);
  float strat = exp(-uStrat * h);
  vec3 q = p * uFreq;
  float ang = q.y * 0.35 + uTime * 0.25;
  q.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q.xz;
  q.y -= uTime * uRise * uFreq;
  float n = fbm(q + vec3(sin(q.y * 0.9 + uTime * 0.5), 0.0, cos(q.y * 0.7 - uTime * 0.4)) * 0.8);
  float wisp = smoothstep(0.2, 0.8, n);
  float edge = smoothstep(1.02, 0.8, r);
  return uDensity * front * strat * mix(0.35, 1.5, wisp) * edge;
}
void main() {
  vec3 ro = vPos;
  vec3 rd = normalize(vPos - uCam);
  float a = dot(rd.xz, rd.xz);
  float b = dot(ro.xz, rd.xz);
  float c = dot(ro.xz, ro.xz) - uR * uR;
  float tc = a > 1e-6 ? (-b + sqrt(max(b * b - a * c, 0.0))) / a : 1e3;
  float ty = rd.y > 1e-5 ? (uH - ro.y) / rd.y : (rd.y < -1e-5 ? -ro.y / rd.y : 1e3);
  float tEnd = max(0.0, min(tc, ty));
  float dt = tEnd / float(STEPS);
  float jitter = hash(vec3(gl_FragCoord.xy, 1.0));
  float tau = 0.0;
  float glow = 0.0;
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (float(i) + jitter) * dt;
    float d = density(p) * dt;
    glow += d * exp(-tau * 1.2) * (0.5 + 0.9 * (1.0 - p.y / uH));
    tau += d;
  }
  if (uMode < 0.5) {
    gl_FragColor = vec4(exp(-uSigma * tau), 1.0);
  } else {
    gl_FragColor = vec4(uGlow * glow, 1.0);
  }
}`;
