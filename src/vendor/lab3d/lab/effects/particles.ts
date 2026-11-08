import * as THREE from 'three';
import type { Tracker } from '../types';
import { createParticleState, type ParticleConfig } from './particleModel';
import { PARTICLE_PRESETS, type ParticlePresetName } from './particlePresets';
import { puffTexture } from './puffTexture';

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute float aRot;
uniform float uPx;
varying float vAlpha;
varying float vRot;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPx / max(0.001, -mv.z);
  vAlpha = aAlpha;
  vRot = aRot;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
varying float vAlpha;
varying float vRot;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = mat2(c, -s, s, c) * p + 0.5;
  float a = texture2D(uMap, p).a * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

export interface ParticleOptions {
  preset?: ParticlePresetName;
  config?: Partial<ParticleConfig>;
  color?: THREE.ColorRepresentation;
  /** Điểm phát (toạ độ của nhóm cha chứa `points`). */
  origin?: THREE.Vector3;
  additive?: boolean;
}

export interface Particles {
  points: THREE.Points;
  origin: THREE.Vector3;
  emitting: boolean;
  config: ParticleConfig;
  setColor(c: THREE.ColorRepresentation): void;
  update(dt: number): void;
  /** Chạy trước `seconds` giây để hiệu ứng có sẵn khi mở cảnh. */
  prewarm(seconds: number): void;
  clear(): void;
}

/** A-KHOI / A-HOI-KHI-MAU – hệ hạt sprite mềm (khói, hơi nước, khí màu) bên NGOÀI dụng cụ kính. */
export function createParticles(ctx: Tracker, o: ParticleOptions = {}): Particles {
  const preset = PARTICLE_PRESETS[o.preset ?? 'steam'];
  const config: ParticleConfig = { ...preset.config, ...o.config };
  const state = createParticleState(config);
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(state.pos, 3).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(state.size, 1).setUsage(THREE.DynamicDrawUsage);
  const alphaAttr = new THREE.BufferAttribute(state.alpha, 1).setUsage(THREE.DynamicDrawUsage);
  const rotAttr = new THREE.BufferAttribute(state.rot, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aSize', sizeAttr);
  geo.setAttribute('aAlpha', alphaAttr);
  geo.setAttribute('aRot', rotAttr);
  geo.setDrawRange(0, 0);
  const mat = ctx.track(
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMap: { value: puffTexture() },
        uColor: { value: new THREE.Color(o.color ?? preset.color) },
        uPx: { value: 500 },
      },
      transparent: true,
      depthWrite: false,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }),
  );
  const points = new THREE.Points(geo, mat);
  points.name = 'particles';
  points.frustumCulled = false;
  points.renderOrder = 5;
  const size = new THREE.Vector2();
  points.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(size);
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 45;
    mat.uniforms.uPx.value = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  };
  const origin = o.origin?.clone() ?? new THREE.Vector3();
  const api: Particles = {
    points,
    origin,
    emitting: true,
    config,
    setColor(c) {
      (mat.uniforms.uColor.value as THREE.Color).set(c);
    },
    update(dt) {
      state.step(dt, [origin.x, origin.y, origin.z], api.emitting);
      geo.setDrawRange(0, state.count);
      for (const a of [posAttr, sizeAttr, alphaAttr, rotAttr]) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, state.count * a.itemSize);
        a.needsUpdate = true;
      }
    },
    prewarm(seconds) {
      for (let t = 0; t < seconds; t += 1 / 30) state.step(1 / 30, [origin.x, origin.y, origin.z], api.emitting);
      api.update(0);
    },
    clear() {
      state.clear();
      geo.setDrawRange(0, 0);
    },
  };
  return api;
}
