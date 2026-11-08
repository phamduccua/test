import * as THREE from 'three';
import type { Tracker } from '../types';

/**
 * "Giao diện kit" dùng chung cho thuỷ tinh + chất lỏng, do createLabLighting bật cho phiên sim hiện tại
 * (tự trả về mặc định = giao diện cũ khi sim huỷ). Mặc định mọi giá trị 0 → vật liệu y như trước.
 */
export interface LabMaterialLook {
  /** Viền tối mảnh ở mép kính nhìn xiên (0…1) – thấy rõ thành/miệng ống trên mọi nền. */
  glassEdge: number;
  /** Màu viền (tuyến tính). */
  glassEdgeColor: THREE.ColorRepresentation;
  /** Tăng độ đậm màu dung dịch trong dụng cụ nhỏ (0 = như cũ, 1 = Beer–Lambert chuẩn hoá theo bề dày). */
  liquidDepth: number;
  /** Tán xạ thuận giả (emissive theo màu dung dịch) – màu không bị "xám" trên phông tối (0…1). */
  liquidGlow: number;
  /** Viền tối quanh vạch chia/chữ men trắng (độ đục 0…1) – đọc được cả trên nền sáng. */
  markOutline: number;
  /** Màu vân gỗ [sáng, tối] cho labMaterials().wood() (giá ống, kẹp) – gỗ dẻ nhạt, không cam gắt dưới tone mapping Neutral. */
  wood?: [string, string];
  /** Màu "nhựa trắng" của kit (labMaterials().whitePlastic) – preset ánh sáng đặt xám nhẹ để không loá trên mặt bàn trắng. */
  whiteBody?: THREE.ColorRepresentation;
}

const DEFAULT: LabMaterialLook = { glassEdge: 0, glassEdgeColor: 0x0b1116, liquidDepth: 0, liquidGlow: 0, markOutline: 0 };

/** Uniform dùng chung (shader kính tham chiếu trực tiếp → đổi giá trị không cần biên dịch lại). */
export const LOOK_UNIFORMS = {
  uGlassEdge: { value: 0 },
  uGlassEdgeColor: { value: new THREE.Color(DEFAULT.glassEdgeColor) },
};

let current: LabMaterialLook = { ...DEFAULT };

export function labMaterialLook(): Readonly<LabMaterialLook> {
  return current;
}

/** Bật giao diện vật liệu cho phiên sim của `ctx` (trả lại mặc định khi ctx huỷ). */
export function setLabMaterialLook(ctx: Tracker, look: Partial<LabMaterialLook>): void {
  current = { ...DEFAULT, ...look };
  LOOK_UNIFORMS.uGlassEdge.value = current.glassEdge;
  LOOK_UNIFORMS.uGlassEdgeColor.value.set(current.glassEdgeColor);
  ctx.track(() => {
    current = { ...DEFAULT };
    LOOK_UNIFORMS.uGlassEdge.value = 0;
  });
}
