import * as THREE from 'three';
import { labText } from '../../text';

export interface BackdropColors {
  /** Màu vùng sáng (tâm vầng sáng). */
  glow: string;
  /** Màu giữa. */
  mid: string;
  /** Màu viền tối. */
  edge: string;
  /** Vị trí tâm vầng sáng (0…1, theo ảnh). */
  cx?: number;
  cy?: number;
}

export const BACKDROPS = {
  /** Xanh than sâu, vầng sáng xanh lam dịu – mặc định vi mô. */
  night: { glow: '#2b4766', mid: '#142235', edge: '#070c14', cx: 0.5, cy: 0.42 },
  /** Xám xanh như bìa SGK Hoá học 10. */
  cover: { glow: '#9fb6cf', mid: '#5b7391', edge: '#1d2a3c', cx: 0.62, cy: 0.38 },
  /** Tím than. */
  violet: { glow: '#3d3566', mid: '#1b1834', edge: '#08070f', cx: 0.5, cy: 0.45 },
} satisfies Record<string, BackdropColors>;

/** Nền gradient tỏa tròn + nhiễu hạt mịn (chống banding) vẽ trên canvas → texture nền (cố định theo màn hình). */
export function backdropTexture(c: BackdropColors, w = 1024, h = 640): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error(labText('t_bb11751fbaec'));
  const cx = (c.cx ?? 0.5) * w;
  const cy = (c.cy ?? 0.45) * h;
  const grd = g.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.62);
  grd.addColorStop(0, c.glow);
  grd.addColorStop(0.45, c.mid);
  grd.addColorStop(1, c.edge);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  let s = 1234567;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 1103515245 + 12345) >>> 0;
    const n = ((s >>> 16) / 65536 - 0.5) * 5;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
