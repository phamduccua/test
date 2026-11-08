import type * as THREE from 'three';
import type { LabMaterialLook } from '../materials/look';

/** Bộ đèn chuẩn của phòng lab (xem createLabLighting). */
export type LabLightingPreset = 'bench' | 'dark' | 'bright';

export interface LightLevels {
  hemi: number;
  key: number;
  fill: number;
  rim: number;
}

export interface BackdropColors {
  /** Màu sát mặt bàn / giữa / mép trên (sRGB hex). */
  bottom: string;
  mid: string;
  top: string;
  /** Tối hai mép trái–phải 0…1. */
  vignette?: number;
}

export interface LabLook {
  /** Env 'lab-studio' (phòng tối + softbox) – cường độ. */
  envIntensity: number;
  background: THREE.ColorRepresentation;
  exposure: number;
  lights: LightLevels;
  /** Nhân màu tường/sàn phòng (tối đi để không trôi màu sau thuỷ tinh). */
  roomTone: THREE.ColorRepresentation;
  /** Nhân màu mặt bàn trắng (đỡ chói dưới ống nghiệm). */
  whiteTopTint: THREE.ColorRepresentation;
  backdrop: BackdropColors;
  /** Hậu kỳ (chất lượng ≥ medium): bloom điểm sáng, tương phản, vignette. */
  post: { bloom: number; contrast: number; vignette: number; saturation: number };
  /** Giao diện vật liệu kit (setLabMaterialLook). */
  materials: Partial<LabMaterialLook>;
}

/**
 * - `bench`  – mặc định cho ống nghiệm/cốc: phông xám xanh sáng dần về mặt bàn (màu dung dịch đọc rõ, dụng cụ nổi khối),
 *              tối dần lên trên (mép kính và vệt softbox nổi), phòng tối bớt.
 * - `dark`   – phông than gần đen: kết tủa trắng, khói/bọt, ngọn lửa, đèn sáng nổi bật.
 * - `bright` – phông trắng mờ (kiểu chụp sản phẩm nền trắng): dung dịch đậm màu, giấy/biểu đồ trên bàn.
 */
export const LAB_LOOKS: Record<LabLightingPreset, LabLook> = {
  bench: {
    // Kế hoạch nâng cấp P0-4: phông sáng và chuyển màu rõ hơn, phòng bớt tối, key mạnh hơn nhấn vào bàn; viền kính đậm thêm để
    // dụng cụ không chìm vào phông sáng hơn.
    envIntensity: 1.05,
    background: 0x232a33,
    exposure: 0.95,
    lights: { hemi: 0.5, key: 2.15, fill: 0.62, rim: 1.45 },
    roomTone: 0x808a95,
    whiteTopTint: 0xbcc3ca,
    backdrop: { bottom: '#c2cbd4', mid: '#7a8692', top: '#343d48', vignette: 0.3 },
    post: { bloom: 0.3, contrast: 0.1, vignette: 0.26, saturation: 0.04 },
    materials: { glassEdge: 0.58, liquidDepth: 1, liquidGlow: 0.6, markOutline: 0.7, wood: ['#dcc29e', '#a3825c'], whiteBody: '#d3d7dc' },
  },
  dark: {
    envIntensity: 0.9,
    background: 0x0b0e12,
    exposure: 1,
    lights: { hemi: 0.35, key: 2.0, fill: 0.5, rim: 1.7 },
    roomTone: 0x3a414a,
    whiteTopTint: 0xc9ced3,
    backdrop: { bottom: '#3e4651', mid: '#222831', top: '#101419', vignette: 0.4 },
    post: { bloom: 0.4, contrast: 0.08, vignette: 0.36, saturation: 0 },
    materials: { glassEdge: 0.35, glassEdgeColor: 0x2a3440, liquidDepth: 1, liquidGlow: 1, markOutline: 0.5, wood: ['#cfb48e', '#957650'], whiteBody: '#d3d7dc' },
  },
  bright: {
    envIntensity: 1.15,
    background: 0x9aa4ae,
    exposure: 0.85,
    lights: { hemi: 0.5, key: 1.8, fill: 0.7, rim: 1.1 },
    roomTone: 0xb4bcc4,
    whiteTopTint: 0xe8ebee,
    backdrop: { bottom: '#eef1f3', mid: '#d5dbe0', top: '#9ea8b2', vignette: 0.25 },
    post: { bloom: 0.2, contrast: 0.06, vignette: 0.22, saturation: 0 },
    materials: { glassEdge: 0.6, liquidDepth: 1, liquidGlow: 0.3, markOutline: 0.85, wood: ['#e0c8a6', '#a8885f'], whiteBody: '#d8dce0' },
  },
};
