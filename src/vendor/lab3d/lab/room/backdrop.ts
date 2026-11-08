import * as THREE from 'three';
import { canvasTexture, makeCanvas, rng } from '../materials/canvas';
import type { Tracker } from '../types';
import type { BackdropColors } from './lightingPresets';

export interface BackdropOptions {
  colors: BackdropColors;
  width: number;
  height?: number;
  /** Độ cong (rad) của phông quanh trục đứng – ôm nhẹ dụng cụ, mép cong về phía camera. */
  arc?: number;
}

function backdropTexture(c: BackdropColors): THREE.CanvasTexture {
  const W = 256;
  const H = 512;
  const { canvas, g } = makeCanvas(W, H);
  const v = g.createLinearGradient(0, H, 0, 0);
  v.addColorStop(0, c.bottom);
  v.addColorStop(0.32, c.mid);
  v.addColorStop(1, c.top);
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  const k = c.vignette ?? 0.3;
  const h = g.createLinearGradient(0, 0, W, 0);
  h.addColorStop(0, `rgba(0,0,0,${k})`);
  h.addColorStop(0.3, 'rgba(0,0,0,0)');
  h.addColorStop(0.7, 'rgba(0,0,0,0)');
  h.addColorStop(1, `rgba(0,0,0,${k})`);
  g.fillStyle = h;
  g.fillRect(0, 0, W, H);
  // Nhiễu mịn chống banding.
  const img = g.getImageData(0, 0, W, H);
  const rand = rng(5);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 4;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  return canvasTexture(canvas);
}

/**
 * Phông nền mờ (vải/giấy studio) đứng sau dụng cụ – kiểu ảnh chụp sản phẩm phòng thí nghiệm: thuỷ tinh và màu dung dịch
 * nổi trên nền liền, không lẫn vào ron gạch. Gốc = giữa mép dưới (đặt ở mép sau mặt bàn, y = 0). Không nhận/đổ bóng.
 */
export function createLabBackdrop(ctx: Tracker, o: BackdropOptions): THREE.Mesh {
  const H = o.height ?? 7;
  const arc = o.arc ?? 0.5;
  const R = o.width / arc;
  const geo = new THREE.CylinderGeometry(R, R, H, 48, 1, true, Math.PI - arc / 2, arc);
  // Mặt trong của trụ nhìn về +z: dời tâm trụ ra trước để cung đi qua z = 0 ở giữa.
  geo.translate(0, H / 2, R);
  const mat = ctx.track(
    new THREE.MeshBasicMaterial({ map: ctx.track(backdropTexture(o.colors)), side: THREE.BackSide, fog: false }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'lab-backdrop';
  mesh.raycast = () => {};
  return mesh;
}
