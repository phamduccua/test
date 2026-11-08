/** GLSL cho createProfileGas: raymarch trong trụ bao, mật độ bị cắt theo bán kính trong R(y) của dụng cụ tròn xoay. */
export const PROFILE_GAS_SAMPLES = 48;

export const PROFILE_GAS_VERT = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const PROFILE_GAS_FRAG = /* glsl */ `
uniform vec3 uCam;
uniform float uR, uY0, uH, uDensity, uStrat, uTime, uFreq, uRise, uMode;
uniform float uRad[${PROFILE_GAS_SAMPLES}];
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
float innerR(float h) {
  float x = clamp(h, 0.0, 1.0) * float(${PROFILE_GAS_SAMPLES - 1});
  int i = int(floor(x));
  int j = min(i + 1, ${PROFILE_GAS_SAMPLES - 1});
  return mix(uRad[i], uRad[j], fract(x));
}
float density(vec3 p) {
  float h = (p.y - uY0) / uH;
  if (h < 0.0 || h > 1.0) return 0.0;
  float r = length(p.xz) / max(innerR(h), 1e-4);
  float strat = exp(-uStrat * h);
  vec3 q = p * uFreq;
  float ang = q.y * 0.3 + uTime * 0.12;
  q.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q.xz;
  q.y -= uTime * uRise * uFreq;
  float n = fbm(q + vec3(sin(q.y * 0.9 + uTime * 0.3), 0.0, cos(q.y * 0.7 - uTime * 0.25)) * 0.7);
  float wisp = smoothstep(0.15, 0.85, n);
  float edge = smoothstep(1.0, 0.86, r);
  return uDensity * strat * mix(0.55, 1.35, wisp) * edge;
}
void main() {
  vec3 ro = vPos;
  vec3 rd = normalize(vPos - uCam);
  float a = dot(rd.xz, rd.xz);
  float b = dot(ro.xz, rd.xz);
  float c = dot(ro.xz, ro.xz) - uR * uR;
  float tc = a > 1e-6 ? (-b + sqrt(max(b * b - a * c, 0.0))) / a : 1e3;
  float yTop = uY0 + uH;
  float ty = rd.y > 1e-5 ? (yTop - ro.y) / rd.y : (rd.y < -1e-5 ? (uY0 - ro.y) / rd.y : 1e3);
  float tEnd = max(0.0, min(tc, ty));
  float dt = tEnd / float(STEPS);
  float jitter = hash(vec3(gl_FragCoord.xy, 1.0));
  float tau = 0.0;
  float glow = 0.0;
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (float(i) + jitter) * dt;
    float d = density(p) * dt;
    glow += d * exp(-tau * 1.2);
    tau += d;
  }
  if (uMode < 0.5) gl_FragColor = vec4(exp(-uSigma * tau), 1.0);
  else gl_FragColor = vec4(uGlow * glow, 1.0);
}`;
