import * as THREE from 'three';
import { radiusAt, type VesselProfile } from '../glassware/profile';
import type { Tracker } from '../types';
import { PROFILE_GAS_FRAG, PROFILE_GAS_SAMPLES, PROFILE_GAS_VERT } from './profileGasShader';

export interface ProfileGasOptions {
  /** Độ cao lòng khí (toạ độ profile): mặc định từ đáy trong tới gần miệng. */
  bottom?: number;
  top?: number;
  /** Hệ số hấp thụ R,G,B (Cl₂ vàng lục: [1.0, 0.35, 2.4]). */
  sigma?: [number, number, number];
  glow?: THREE.ColorRepresentation;
  glowStrength?: number;
  /** Phân tầng mật độ ∝ exp(−strat·h/H) (khí nặng hơn không khí đậm phía dưới). */
  strat?: number;
  frequency?: number;
  rise?: number;
  steps?: number;
  /** Thu bán kính trong (đv) để khí không chạm mặt kính. */
  inset?: number;
}

export interface ProfileGas {
  /** Thêm vào `vessel.group` (gốc trùng gốc profile). */
  group: THREE.Group;
  /** Mật độ tổng (0 = ẩn). */
  density: number;
  strat: number;
  update(dt: number): void;
}

/**
 * Khí màu thể tích lấp đầy MỌI dụng cụ tròn xoay (bình tam giác, bình cầu…): như createVolumeGas nhưng mật độ bị cắt
 * theo bán kính trong R(y) của profile (lấy mẫu 48 điểm). Vật liệu đục + CustomBlending → nhìn thấy xuyên qua kính.
 */
export function createProfileGas(ctx: Tracker, profile: VesselProfile, o: ProfileGasOptions = {}): ProfileGas {
  const y0 = o.bottom ?? profile.innerBottom + 0.002;
  const y1 = o.top ?? profile.height - 0.01;
  const H = Math.max(1e-3, y1 - y0);
  const inset = o.inset ?? 0.004;
  const rad = Array.from({ length: PROFILE_GAS_SAMPLES }, (_, i) =>
    Math.max(0.001, radiusAt(profile.inner, y0 + (H * i) / (PROFILE_GAS_SAMPLES - 1)) - inset),
  );
  const R = Math.max(...rad) + 0.002;
  const group = new THREE.Group();
  group.name = 'profile-gas';
  const geo = ctx.track(new THREE.CylinderGeometry(R, R, H, 48, 1, false));
  geo.translate(0, y0 + H / 2, 0);
  const shared = {
    uCam: { value: new THREE.Vector3() },
    uR: { value: R },
    uY0: { value: y0 },
    uH: { value: H },
    uRad: { value: rad },
    uDensity: { value: 0 },
    uStrat: { value: o.strat ?? 0.6 },
    uTime: { value: 0 },
    uFreq: { value: o.frequency ?? 9 },
    uRise: { value: o.rise ?? 0.05 },
    uSigma: { value: new THREE.Vector3(...(o.sigma ?? [1.0, 0.35, 2.4])) },
    uGlow: { value: new THREE.Color(o.glow ?? 0xd8e070).multiplyScalar(o.glowStrength ?? 0.3) },
  };
  const meshes = ([0, 1] as const).map((mode) => {
    const mat = ctx.track(
      new THREE.ShaderMaterial({
        vertexShader: PROFILE_GAS_VERT,
        fragmentShader: PROFILE_GAS_FRAG,
        uniforms: { ...shared, uMode: { value: mode } },
        defines: { STEPS: o.steps ?? 24 },
        depthWrite: false,
        transparent: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: mode === 0 ? THREE.ZeroFactor : THREE.OneFactor,
        blendDst: mode === 0 ? THREE.SrcColorFactor : THREE.OneFactor,
      }),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 5 + mode;
    mesh.onBeforeRender = (_r, _s, cam) => {
      shared.uCam.value.setFromMatrixPosition(cam.matrixWorld);
      mesh.worldToLocal(shared.uCam.value);
    };
    group.add(mesh);
    return mesh;
  });
  const gas: ProfileGas = {
    group,
    density: 0,
    strat: shared.uStrat.value,
    update(dt) {
      shared.uTime.value += dt;
      shared.uDensity.value = gas.density;
      shared.uStrat.value = gas.strat;
      const on = gas.density > 0.004;
      meshes.forEach((m) => (m.visible = on));
    },
  };
  return gas;
}
