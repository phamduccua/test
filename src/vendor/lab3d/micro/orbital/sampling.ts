import { gridCoord, type ScalarGrid } from './grid';

/** Đám điểm xác suất (thuần): mật độ điểm ∝ |ψ|², kèm dấu ψ để tô màu pha. */
export interface DensityPoints {
  positions: Float32Array;
  /** +1 / −1 theo dấu ψ tại nút lưới được chọn. */
  signs: Int8Array;
  count: number;
}

/** Bộ sinh số giả ngẫu nhiên có hạt giống (mulberry32). */
export function rng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rút `count` điểm theo |ψ|² trên lưới: chọn nút theo hàm phân phối tích luỹ rồi rung đều trong ô (±step/2).
 * Nhanh với mọi orbital (không cần loại bỏ ngẫu nhiên).
 */
export function sampleDensity(g: ScalarGrid, count: number, rand: () => number = rng(7)): DensityPoints {
  const N = g.data.length;
  const cdf = new Float64Array(N);
  let acc = 0;
  for (let i = 0; i < N; i++) {
    acc += g.data[i] * g.data[i];
    cdf[i] = acc;
  }
  const positions = new Float32Array(count * 3);
  const signs = new Int8Array(count);
  const n = g.n;
  for (let s = 0; s < count; s++) {
    const u = rand() * acc;
    let lo = 0;
    let hi = N - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    const i = lo % n;
    const j = Math.floor(lo / n) % n;
    const k = Math.floor(lo / (n * n));
    positions[s * 3] = gridCoord(g, i) + (rand() - 0.5) * g.step;
    positions[s * 3 + 1] = gridCoord(g, j) + (rand() - 0.5) * g.step;
    positions[s * 3 + 2] = gridCoord(g, k) + (rand() - 0.5) * g.step;
    signs[s] = g.data[lo] >= 0 ? 1 : -1;
  }
  return { positions, signs, count };
}
