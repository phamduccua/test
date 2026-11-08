import type { Slot, TrendDatum } from './types';

/** Bố cục lưới chu kì × nhóm (thuần). Mặt bàn = mặt phẳng XZ; x = cột (trái → phải), z = chu kì (xa → gần camera). */

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const;

export const romanGroup = (g: number) => `${ROMAN[g - 1] ?? g}A`;

/** Chữ số chỉ số dưới (vd. 19 → "₁₉"). */
export const subscript = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);

export interface GridGeometry {
  cell: number;
  periods: number[];
  groups: number[];
  width: number;
  depth: number;
  /** Tâm ô của chu kì / cột. */
  at(period: number, group: number): Slot;
  /** Vị trí "nhà" của từng phần tử. */
  homes: Slot[];
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export function cellSize(data: readonly TrendDatum[], sphereScale: number, gap = 0.35, minCell = 1.4): number {
  const max = Math.max(...data.map((d) => d.value));
  return Math.max(minCell, 2 * max * sphereScale + gap);
}

export function gridGeometry(data: readonly TrendDatum[], cell: number): GridGeometry {
  const ps = data.map((d) => d.period);
  const gs = data.map((d) => d.group);
  const periods = range(Math.min(...ps), Math.max(...ps));
  const groups = range(Math.min(...gs), Math.max(...gs));
  const width = groups.length * cell;
  const depth = periods.length * cell;
  const at = (period: number, group: number): Slot => ({
    x: (group - groups[0] - (groups.length - 1) / 2) * cell,
    y: 0,
    z: (period - periods[0] - (periods.length - 1) / 2) * cell,
  });
  return { cell, periods, groups, width, depth, at, homes: data.map((d) => at(d.period, d.group)) };
}

/** "Sắp xếp": lấp các ô theo thứ tự đọc (trái → phải, trên → dưới) với giá trị giảm dần (hoặc tăng). */
export function sortedSlots(data: readonly TrendDatum[], g: GridGeometry, descending = true): Slot[] {
  const order = data.map((_, i) => i).sort((a, b) => (descending ? -1 : 1) * (data[a].value - data[b].value) || data[a].Z - data[b].Z);
  const out: Slot[] = new Array(data.length);
  order.forEach((idx, k) => {
    const row = Math.floor(k / g.groups.length);
    out[idx] = g.at(g.periods[0] + row, g.groups[0] + (k % g.groups.length));
  });
  return out;
}

/** Xếp hàng theo Z phía trước lưới (đồ thị phụ). Trả về vị trí cho các chỉ số được chọn. */
export function lineupSlots(
  data: readonly TrendDatum[],
  picked: readonly number[],
  g: GridGeometry,
  sphereScale: number,
  gap = 0.45,
): { slots: Map<number, Slot>; z: number; x0: number; x1: number; maxR: number } {
  const order = [...picked].sort((a, b) => data[a].Z - data[b].Z);
  const maxR = Math.max(0.2, ...order.map((i) => data[i].value * sphereScale));
  const step = Math.min(2 * maxR + gap, g.width / Math.max(1, order.length - 1 || 1));
  const z = g.depth / 2 + maxR + g.cell * 0.75 + 0.6;
  const slots = new Map<number, Slot>();
  const x0 = (-(order.length - 1) / 2) * step;
  order.forEach((i, k) => slots.set(i, { x: x0 + k * step, y: 0, z }));
  return { slots, z, x0: x0 - maxR, x1: -x0 + maxR, maxR };
}

/** Độ cao đỉnh mark: cột (barT) + quả cầu đặt trên đỉnh (sphereT). Tuyến tính theo giá trị → dùng làm trục đồ thị. */
export function markTop(v: number, barT: number, sphereT: number, sphereScale: number, barScale: number): number {
  return v * (barT * barScale + sphereT * 2 * sphereScale);
}

/** Bước vạch chia "đẹp" (1, 2, 5 × 10ⁿ) cho trục phủ tới `max` (vạch cuối ≥ max). */
export function niceTicks(max: number, count = 4): number[] {
  const raw = max / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = step; v < max + step - 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
