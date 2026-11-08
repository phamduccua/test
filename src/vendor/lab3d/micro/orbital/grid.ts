import type { Psi } from './hydrogen';

/** Lưới vô hướng đều N³ trên khối [−half, half]³ (thuần). Chỉ số: i + n·(j + n·k). */
export interface ScalarGrid {
  n: number;
  half: number;
  step: number;
  data: Float32Array;
}

export function gridCoord(g: ScalarGrid, i: number): number {
  return -g.half + i * g.step;
}

/** Lấy mẫu hàm f tại các nút lưới (toạ độ lưới = toạ độ truyền thẳng vào f). */
export function sampleGrid(f: Psi, n: number, half: number): ScalarGrid {
  const step = (2 * half) / (n - 1);
  const data = new Float32Array(n * n * n);
  let idx = 0;
  for (let k = 0; k < n; k++) {
    const z = -half + k * step;
    for (let j = 0; j < n; j++) {
      const y = -half + j * step;
      for (let i = 0; i < n; i++) data[idx++] = f(-half + i * step, y, z);
    }
  }
  return { n, half, step, data };
}

/** Tổng ∫|f|² dV trên lưới (≈ 1 nếu ψ chuẩn hoá và lưới đủ rộng). */
export function gridNorm(g: ScalarGrid): number {
  let s = 0;
  for (let i = 0; i < g.data.length; i++) s += g.data[i] * g.data[i];
  return s * g.step ** 3;
}

/**
 * Giá trị đẳng trị |ψ| sao cho miền |ψ| ≥ giá trị đó chứa tỉ lệ `p` (0…1) xác suất (so với tổng trên lưới) –
 * "mặt bao 90%" của sách giáo khoa.
 */
export function isoForEnclosed(g: ScalarGrid, p: number): number {
  const d = new Float32Array(g.data.length);
  let total = 0;
  for (let i = 0; i < d.length; i++) {
    d[i] = g.data[i] * g.data[i];
    total += d[i];
  }
  d.sort();
  const goal = total * Math.min(Math.max(p, 0), 1);
  let acc = 0;
  for (let i = d.length - 1; i >= 0; i--) {
    acc += d[i];
    if (acc >= goal) return Math.sqrt(d[i]);
  }
  return 0;
}

/** Giá trị |f| lớn nhất trên lưới. */
export function gridMaxAbs(g: ScalarGrid): number {
  let m = 0;
  for (let i = 0; i < g.data.length; i++) m = Math.max(m, Math.abs(g.data[i]));
  return m;
}
