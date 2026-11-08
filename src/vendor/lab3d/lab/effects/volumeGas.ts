import * as THREE from 'three';
import type { Tracker } from '../types';
import { VOLUME_GAS_FRAG, VOLUME_GAS_VERT } from './volumeGasShader';

export interface VolumeGasOptions {
  /** Bán kính & chiều cao trụ khí (đơn vị cảnh, gốc ở đáy trụ). */
  radius: number;
  height: number;
  /** Hệ số hấp thụ R,G,B trên 1 đơn vị mật độ·đv – kênh lớn bị hấp thụ mạnh (I₂: hấp thụ lục → tím). */
  sigma?: [number, number, number];
  /** Màu tán xạ/phát sáng nhẹ (lớp cộng). */
  glow?: THREE.ColorRepresentation;
  glowStrength?: number;
  /** Độ phân tầng: mật độ ∝ exp(−strat·h/H) (khí nặng đậm phía dưới). */
  strat?: number;
  /** Tần số nhiễu (1/đv) & tốc độ cuộn lên (đv/s). */
  frequency?: number;
  rise?: number;
  steps?: number;
}

export interface VolumeGas {
  group: THREE.Group;
  /** Mật độ tổng (0 = ẩn). */
  density: number;
  /** Mặt trước của khối khí 0…1 (khí dâng dần từ đáy). */
  front: number;
  strat: number;
  update(dt: number): void;
}

/**
 * A-HOI-KHI-MAU – khí màu thể tích (raymarch nhiễu 3D) trong lòng một dụng cụ trụ.
 * Hai lượt vẽ: hấp thụ Beer–Lambert theo kênh (nhân màu nền) + tán xạ cộng nhẹ.
 * Vật liệu KHÔNG `transparent` (nằm trong danh sách đục, blending tuỳ biến) → được vẽ vào render target
 * transmission nên nhìn thấy được XUYÊN QUA kính (sprite trong suốt thì không).
 */
export function createVolumeGas(ctx: Tracker, o: VolumeGasOptions): VolumeGas {
  const group = new THREE.Group();
  group.name = 'volume-gas';
  const geo = ctx.track(new THREE.CylinderGeometry(o.radius, o.radius, o.height, 48, 1, false));
  geo.translate(0, o.height / 2, 0);
  const shared = {
    uCam: { value: new THREE.Vector3() },
    uR: { value: o.radius },
    uH: { value: o.height },
    uDensity: { value: 0 },
    uFront: { value: 0 },
    uStrat: { value: o.strat ?? 1.2 },
    uTime: { value: 0 },
    uFreq: { value: o.frequency ?? 9 },
    uRise: { value: o.rise ?? 0.35 },
    uSigma: { value: new THREE.Vector3(...(o.sigma ?? [0.8, 2.3, 0.6])) },
    uGlow: { value: new THREE.Color(o.glow ?? 0xb45cff).multiplyScalar(o.glowStrength ?? 0.35) },
  };
  const make = (mode: 0 | 1) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VOLUME_GAS_VERT,
      fragmentShader: VOLUME_GAS_FRAG,
      uniforms: { ...shared, uMode: { value: mode } },
      defines: { STEPS: o.steps ?? 22 },
      depthWrite: false,
      transparent: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      // Hấp thụ: dst·T ; tán xạ: dst + E.
      blendSrc: mode === 0 ? THREE.ZeroFactor : THREE.OneFactor,
      blendDst: mode === 0 ? THREE.SrcColorFactor : THREE.OneFactor,
    });
    ctx.track(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 5 + mode;
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.onBeforeRender = (_r, _s, cam) => {
      shared.uCam.value.setFromMatrixPosition(cam.matrixWorld);
      mesh.worldToLocal(shared.uCam.value);
    };
    group.add(mesh);
    return mesh;
  };
  const meshes = [make(0), make(1)];
  const gas: VolumeGas = {
    group,
    density: 0,
    front: 0,
    strat: shared.uStrat.value,
    update(dt) {
      shared.uTime.value += dt;
      shared.uDensity.value = gas.density;
      shared.uFront.value = gas.front;
      shared.uStrat.value = gas.strat;
      const on = gas.density > 0.004 && gas.front > 0.01;
      meshes.forEach((m) => (m.visible = on));
    },
  };
  return gas;
}
