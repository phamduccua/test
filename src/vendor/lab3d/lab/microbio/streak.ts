/**
 * Cấy ria trên đĩa thạch (thuần). Toạ độ đĩa theo mm: gốc ở tâm, u sang phải, v ra xa người xem (nhìn từ trên xuống).
 * Lưới 0,5 mm lưu số tế bào đã đặt lên thạch; que cấy nhả một phần tế bào đang mang theo mỗi mm,
 * và vớt lại tế bào của các vệt cũ khi cắt qua chúng → mỗi vùng sau loãng hơn vùng trước hàng chục lần.
 */
export interface P2 {
  u: number;
  v: number;
}

export interface PlateGrid {
  /** Bán kính mặt thạch (mm). */
  radius: number;
  /** Cạnh ô lưới (mm). */
  cell: number;
  n: number;
  /** Số tế bào mỗi ô. */
  cells: Float64Array;
  /** Vùng ria đặt nhiều tế bào nhất vào ô (−1 = chưa có). */
  zone: Int8Array;
  zoneDep: Float64Array;
}

export interface Loop {
  /** Số tế bào sống đang mang trong vòng que. */
  load: number;
}

export interface StreakOptions {
  /** Phần tế bào que nhả ra mỗi mm đường ria (mm⁻¹). */
  release?: number;
  /** Phần tế bào của vệt cũ bị que vớt lại khi đi qua hết bề rộng vệt. */
  pickup?: number;
  /** Bề rộng vệt que (mm). */
  width?: number;
}

export function createPlateGrid(radius: number, cell = 0.5): PlateGrid {
  const n = Math.ceil((2 * radius) / cell);
  return { radius, cell, n, cells: new Float64Array(n * n), zone: new Int8Array(n * n).fill(-1), zoneDep: new Float64Array(n * n) };
}

export const cellIndex = (g: PlateGrid, u: number, v: number) => {
  const i = Math.floor((u + g.radius) / g.cell);
  const j = Math.floor((v + g.radius) / g.cell);
  return i < 0 || j < 0 || i >= g.n || j >= g.n ? -1 : j * g.n + i;
};
export const cellCenter = (g: PlateGrid, k: number): P2 => ({
  u: ((k % g.n) + 0.5) * g.cell - g.radius,
  v: (Math.floor(k / g.n) + 0.5) * g.cell - g.radius,
});

/** Que đi dọc đường gấp khúc `pts`; vùng số `zone` (0…). Trả độ dài đã ria (mm). */
export function streakAlong(g: PlateGrid, loop: Loop, pts: P2[], zone: number, o: StreakOptions = {}): number {
  const kd = o.release ?? 0.015;
  const w = o.width ?? 2;
  const ds = g.cell / 2;
  const q = Math.min(1, ((o.pickup ?? 1) * ds) / w);
  const snap = Float64Array.from(g.cells);
  const rad = Math.ceil(w / 2 / g.cell);
  let len = 0;
  const visit = (u: number, v: number) => {
    const foot: number[] = [];
    for (let dj = -rad; dj <= rad; dj++)
      for (let di = -rad; di <= rad; di++) {
        if ((di * g.cell) ** 2 + (dj * g.cell) ** 2 > (w / 2) ** 2) continue;
        const k = cellIndex(g, u + di * g.cell, v + dj * g.cell);
        if (k >= 0 && inside(g, k)) foot.push(k);
      }
    if (!foot.length) return;
    let took = 0;
    for (const k of foot) {
      const t = snap[k] * q;
      snap[k] -= t;
      g.cells[k] -= t;
      took += t;
    }
    const dep = loop.load * kd * ds;
    for (const k of foot) {
      const d = dep / foot.length;
      g.cells[k] += d;
      if (d > g.zoneDep[k] || g.zone[k] < 0) {
        g.zoneDep[k] = Math.max(g.zoneDep[k], d);
        g.zone[k] = zone;
      }
    }
    loop.load += took - dep;
  };
  for (let s = 1; s < pts.length; s++) {
    const a = pts[s - 1];
    const b = pts[s];
    const L = Math.hypot(b.u - a.u, b.v - a.v);
    const m = Math.max(1, Math.ceil(L / ds));
    for (let i = 0; i < m; i++) visit(a.u + ((b.u - a.u) * i) / m, a.v + ((b.v - a.v) * i) / m);
    len += L;
  }
  return len;
}

export const inside = (g: PlateGrid, k: number) => {
  const c = cellCenter(g, k);
  return c.u * c.u + c.v * c.v <= g.radius * g.radius;
};

/** Tổng tế bào mỗi vùng (theo `zone` của ô). */
export function zoneTotals(g: PlateGrid, zones: number): number[] {
  const out = new Array<number>(zones).fill(0);
  g.cells.forEach((c, k) => g.zone[k] >= 0 && (out[g.zone[k]] += c));
  return out;
}
