import type { Psi } from './hydrogen';

/** Mặt cắt mật độ (thuần): ảnh RGBA của |ψ|² trên một mặt phẳng qua gốc, tô màu theo dấu ψ / theo orbital. */
export type SlicePlane = 'XY' | 'XZ' | 'YZ';

export interface SliceLayer {
  /** ψ theo toạ độ cảnh (đã bọc bằng psiInScene). */
  psi: Psi;
  /** Màu thuỳ dương / âm (0…1 RGB). */
  pos: [number, number, number];
  neg: [number, number, number];
}

/**
 * Ảnh `res × res` (Uint8 RGBA, hàng 0 = dưới) phủ hình vuông [−half, half]² của mặt phẳng cảnh `plane`.
 * Độ sáng ∝ (|ψ|²/max)^gamma (màu đã nhân sẵn độ sáng – hợp với cộng màu); alpha = độ sáng.
 */
export function sliceImage(layers: SliceLayer[], plane: SlicePlane, half: number, res = 256, gamma = 0.45): Uint8Array {
  const dens = new Float32Array(res * res);
  const rgb = new Float32Array(res * res * 3);
  let max = 1e-30;
  for (let r = 0; r < res; r++) {
    const b = -half + ((r + 0.5) / res) * 2 * half;
    for (let c = 0; c < res; c++) {
      const a = -half + ((c + 0.5) / res) * 2 * half;
      const [X, Y, Z] = plane === 'XY' ? [a, b, 0] : plane === 'XZ' ? [a, 0, -b] : [0, b, -a];
      const idx = r * res + c;
      let sum = 0;
      for (const L of layers) {
        const v = L.psi(X, Y, Z);
        const d = v * v;
        const col = v >= 0 ? L.pos : L.neg;
        rgb[idx * 3] += col[0] * d;
        rgb[idx * 3 + 1] += col[1] * d;
        rgb[idx * 3 + 2] += col[2] * d;
        sum += d;
      }
      dens[idx] = sum;
      max = Math.max(max, sum);
    }
  }
  const out = new Uint8Array(res * res * 4);
  for (let i = 0; i < res * res; i++) {
    const s = dens[i];
    const k = (s / max) ** gamma;
    const inv = s > 0 ? 1 / s : 0;
    for (let ch = 0; ch < 3; ch++) out[i * 4 + ch] = Math.round(255 * Math.min(1, rgb[i * 3 + ch] * inv * k * 1.1));
    out[i * 4 + 3] = Math.round(255 * Math.min(1, k * 1.15));
  }
  return out;
}
