import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { setLabMaterialLook, type LabMaterialLook } from '../materials/look';
import { createLabPost, type LabPost } from './labPost';
import { LAB_LOOKS, type LabLightingPreset, type LabLook } from './lightingPresets';
import type { LightRig } from './lighting';

export interface LabLightingOptions {
  preset?: LabLightingPreset;
  /** Bộ đèn có sẵn (vd. của createLabStage) – chỉnh cường độ theo preset. */
  rig?: LightRig;
  /** Hậu kỳ khi chất lượng ≥ medium (mặc định bật). */
  post?: boolean;
  /** Ghi đè vài thông số của preset. */
  overrides?: Partial<Pick<LabLook, 'envIntensity' | 'exposure' | 'background'>>;
  /** Giao diện vật liệu kit (viền kính, độ đậm/tán xạ dung dịch, viền vạch chia); mặc định theo preset. */
  materials?: Partial<LabMaterialLook>;
}

export interface LabLighting {
  preset: LabLightingPreset;
  look: LabLook;
  post: LabPost | null;
  envIntensity: number;
}

/**
 * Ánh sáng chuẩn cho bàn thí nghiệm: env 'lab-studio' (phòng tối + softbox → mép kính, mặt khum có vệt sáng rõ),
 * tone mapping Neutral (màu dung dịch đúng, bão hoà), phơi sáng theo preset, đèn key/fill/rim + hemi theo preset,
 * hậu kỳ nhẹ ở chất lượng ≥ medium. Engine đặt lại env/tone mapping/exposure/render hook ở sim kế tiếp.
 * Thường gọi gián tiếp: `createLabStage(ctx, { lighting: 'bench' })` (hoặc `createDualStage({ lab: { lighting } })`).
 */
export function createLabLighting(ctx: SimContext, o: LabLightingOptions = {}): LabLighting {
  const preset = o.preset ?? 'bench';
  const look = { ...LAB_LOOKS[preset], ...o.overrides };
  const { scene, renderer } = ctx;
  scene.environment = ctx.sharedEnvironment('lab-studio');
  scene.environmentIntensity = look.envIntensity;
  scene.background = new THREE.Color(look.background);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = look.exposure;
  o.rig?.setLevels(look.lights);
  setLabMaterialLook(ctx, { ...look.materials, ...o.materials });
  const post = o.post === false ? null : createLabPost(ctx, look.post);
  return { preset, look, post, envIntensity: look.envIntensity };
}
