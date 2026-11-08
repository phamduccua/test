import * as THREE from 'three';
import type { Tracker } from '../types';

/**
 * Điểm sáng cộng màu kiểu "bloom" (một draw call): lõi trắng + quầng màu, kích thước theo đv thế giới.
 * Dùng cho chớp sáng huỳnh quang, hạt α phát sáng, tia lửa… Không cần post-processing.
 */
export interface GlowPoints {
  points: THREE.Points;
  readonly max: number;
  /** Đặt điểm i: vị trí, đường kính (đv), màu, độ sáng 0…1 (0 = ẩn). */
  set(i: number, x: number, y: number, z: number, size: number, color: THREE.Color, alpha: number): void;
  hide(i: number): void;
  /** Đánh dấu đã đổi (gọi một lần mỗi frame sau các `set`). */
  commit(): void;
}

const VERT = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
uniform float uViewH;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aColor.a > 0.0 ? aSize * projectionMatrix[1][1] * uViewH * 0.5 / max(0.01, -mv.z) : 0.0;
}`;

const FRAG = /* glsl */ `
uniform float uCore;
varying vec4 vColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float halo = pow(1.0 - r, 2.2);
  float core = smoothstep(uCore, 0.0, r);
  vec3 c = vColor.rgb * halo + vec3(1.0) * core * 0.9;
  gl_FragColor = vec4(c * vColor.a, 1.0);
}`;

export function createGlowPoints(ctx: Tracker, o: { max: number; core?: number; renderOrder?: number }): GlowPoints {
  const max = o.max;
  const pos = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const col = new Float32Array(max * 4);
  const geo = ctx.track(new THREE.BufferGeometry());
  const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const aSize = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  const aCol = new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos);
  geo.setAttribute('aSize', aSize);
  geo.setAttribute('aColor', aCol);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const uniforms = { uViewH: { value: 800 }, uCore: { value: o.core ?? 0.22 } };
  const mat = ctx.track(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = o.renderOrder ?? 10;
  const v2 = new THREE.Vector2();
  points.onBeforeRender = (renderer) => {
    uniforms.uViewH.value = renderer.getDrawingBufferSize(v2).y;
  };
  return {
    points,
    max,
    set(i, x, y, z, s, c, a) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      size[i] = s;
      col.set([c.r, c.g, c.b, Math.max(0, a)], i * 4);
    },
    hide(i) {
      col[i * 4 + 3] = 0;
    },
    commit() {
      aPos.needsUpdate = aSize.needsUpdate = aCol.needsUpdate = true;
    },
  };
}

/** Bể chớp sáng tắt dần (scintillation): `spawn` tại một điểm, tự mờ theo `decay` giây. */
export interface FlashPool {
  points: THREE.Points;
  spawn(x: number, y: number, z: number, o?: { size?: number; color?: THREE.Color; life?: number }): void;
  update(dt: number): void;
  clear(): void;
  /** Số chớp đang sáng. */
  readonly active: number;
}

export function createFlashPool(
  ctx: Tracker,
  o: { max?: number; size?: number; color?: THREE.ColorRepresentation; decay?: number } = {},
): FlashPool {
  const gp = createGlowPoints(ctx, { max: o.max ?? 600 });
  const base = new THREE.Color(o.color ?? 0x9ff7e8);
  const life = new Float32Array(gp.max);
  const span = new Float32Array(gp.max);
  const size = new Float32Array(gp.max);
  const xyz = new Float32Array(gp.max * 3);
  const colors = Array.from({ length: gp.max }, () => base.clone());
  let next = 0;
  let active = 0;
  for (let i = 0; i < gp.max; i++) gp.hide(i);
  return {
    points: gp.points,
    get active() {
      return active;
    },
    spawn(x, y, z, s = {}) {
      const i = next;
      next = (next + 1) % gp.max;
      xyz.set([x, y, z], i * 3);
      span[i] = life[i] = s.life ?? o.decay ?? 0.2;
      size[i] = s.size ?? o.size ?? 0.08;
      colors[i].copy(s.color ?? base);
    },
    update(dt) {
      active = 0;
      for (let i = 0; i < gp.max; i++) {
        if (life[i] <= 0) {
          gp.hide(i);
          continue;
        }
        life[i] = Math.max(0, life[i] - dt);
        const k = life[i] / span[i];
        active++;
        gp.set(i, xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2], size[i] * (0.6 + 0.4 * k), colors[i], k * k);
      }
      gp.commit();
    },
    clear() {
      life.fill(0);
    },
  };
}
