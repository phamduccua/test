import * as THREE from 'three';
import { labMaterialLook } from '../materials/look';

export interface LiquidLook {
  color: THREE.Color;
  /** Độ đậm màu 0 (gần như nước) … 1 (rất đậm). */
  density: number;
  /** Độ đục 0 (trong) … 1 (đục hẳn, như sữa vôi). */
  turbidity: number;
  turbidColor: THREE.Color;
  /** true = huyền phù màu đậm (Cu₂O, kết tủa màu): giữ nguyên `turbidColor`, không pha trắng thành màu pastel. */
  turbidPure?: boolean;
}

const WHITE = new THREE.Color(0xffffff);
const tmp = new THREE.Color();

/** Chất lỏng trong suốt có suy giảm màu Beer–Lambert (attenuationColor/Distance). */
export function createLiquidMaterial(thickness: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    ior: 1.333,
    thickness,
    specularIntensity: 0.8,
    envMapIntensity: 1.1,
    side: THREE.DoubleSide,
  });
}

/** Áp màu/độ đậm/độ đục vào vật liệu. */
export function applyLiquidLook(mat: THREE.MeshPhysicalMaterial, look: LiquidLook): void {
  const d = THREE.MathUtils.clamp(look.density, 0, 1);
  const t = THREE.MathUtils.clamp(look.turbidity, 0, 1);
  const k = labMaterialLook();
  mat.attenuationColor.copy(look.color);
  let dist = 0.05 + (1 - d) * (1 - d) * 1.6;
  if (k.liquidDepth > 0) {
    // Beer–Lambert chuẩn hoá theo bề dày dụng cụ (mat.thickness ≈ 0,8 × đường kính): độ đậm d cho cùng một "độ màu"
    // ở ống nghiệm 16 mm lẫn cốc 250 mL; chỉ làm đậm hơn (không nhạt hơn giao diện cũ).
    const optical = 0.1 + 1.3 * Math.pow(d, 1.6);
    dist = Math.min(dist, mat.thickness / Math.max(1e-3, optical * k.liquidDepth + 1e-3));
  }
  mat.attenuationDistance = dist;
  tmp.copy(WHITE).lerp(look.color, 0.15 + 0.35 * d);
  mat.color.copy(tmp.lerp(look.turbidColor, look.turbidPure ? Math.min(1, t * 1.6) : t * 0.9));
  mat.transmission = 1 - 0.88 * t;
  mat.roughness = 0.04 + 0.35 * t;
  // Tán xạ thuận giả: dung dịch màu "phát" nhẹ màu của nó (không bị xám trên phông tối); kết tủa/đục thì theo màu đục.
  const glow = k.liquidGlow * (0.04 + 0.14 * d) * (1 - t);
  mat.emissive.copy(look.color).multiplyScalar(glow);
  if (t > 0) mat.emissive.add(tmp.copy(look.turbidColor).multiplyScalar(k.liquidGlow * 0.05 * t));
}
