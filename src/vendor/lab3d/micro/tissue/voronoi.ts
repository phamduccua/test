/** Mô tế bào đa giác (thuần, không three): Voronoi có Lloyd + co giãn dị hướng, đơn vị tuỳ ý (thường µm), mặt phẳng (x, y). */

export type Pt = [number, number];

export interface VoronoiCell {
  /** Đa giác lồi, ngược chiều kim đồng hồ. */
  poly: Pt[];
  center: Pt;
  area: number;
}

export interface VoronoiOptions {
  /** Bán kính vùng mẫu (tế bào có tâm ngoài vòng bị bỏ). */
  radius: number;
  /** Cỡ tế bào trung bình (đường kính). */
  size: number;
  /** Kéo dài theo trục x (1 = đẳng hướng). */
  stretch?: number;
  /** Số vòng Lloyd (đều hơn). */
  relax?: number;
  /** Độ lệch ngẫu nhiên của lưới hạt giống (0…1). */
  jitter?: number;
  seed?: number;
}

/** Bộ sinh số giả ngẫu nhiên LCG (0…1). */
export function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Cắt đa giác lồi bằng nửa mặt phẳng n·p ≤ d. */
export function clipPoly(poly: Pt[], nx: number, ny: number, d: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + ny * a[1] - d;
    const db = nx * b[0] + ny * b[1] - d;
    if (da <= 0) out.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function polyArea(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

export function polyCentroid(p: Pt[]): Pt {
  let x = 0;
  let y = 0;
  p.forEach((q) => ((x += q[0]), (y += q[1])));
  return [x / p.length, y / p.length];
}

/** Co đa giác về tâm một khoảng `inset` (xấp xỉ, đủ cho đa giác gần tròn). */
export function insetPoly(p: Pt[], c: Pt, inset: number): Pt[] {
  return p.map(([x, y]) => {
    const dx = x - c[0];
    const dy = y - c[1];
    const k = Math.max(0.05, 1 - inset / Math.max(Math.hypot(dx, dy), 1e-6));
    return [c[0] + dx * k, c[1] + dy * k];
  });
}

/** Ô Voronoi trong vòng tròn bán kính `radius` (lưới tam giác lệch ngẫu nhiên → hạt giống, lân cận tìm theo lưới băm). */
export function voronoiTissue(o: VoronoiOptions): VoronoiCell[] {
  const rnd = lcg(o.seed ?? 7);
  const sx = Math.sqrt(o.stretch ?? 1);
  const step = o.size;
  const jit = o.jitter ?? 0.45;
  const R = o.radius + step * 1.5;
  let seeds: Pt[] = [];
  const rows = Math.ceil(R / (step * 0.866));
  for (let r = -rows; r <= rows; r++) {
    for (let q = -Math.ceil(R / step) - 1; q <= Math.ceil(R / step) + 1; q++) {
      const x = (q + (r & 1 ? 0.5 : 0) + (rnd() - 0.5) * jit) * step;
      const y = (r + (rnd() - 0.5) * jit) * step * 0.866;
      if (Math.hypot(x, y) < R) seeds.push([x, y]);
    }
  }
  // Tính ở lưới đẳng hướng, xong giãn x·√k, nén y/√k → tế bào dài theo x, diện tích giữ nguyên.
  let cells: VoronoiCell[] = [];
  for (let it = 0; it <= (o.relax ?? 1); it++) {
    cells = cellsOf(seeds, step * 2.2);
    if (it < (o.relax ?? 1)) seeds = cells.map((c) => c.center);
  }
  return cells
    .filter((c) => Math.hypot(c.center[0], c.center[1]) < o.radius)
    .map((c) => {
      const poly = c.poly.map(([x, y]) => [x * sx, y / sx] as Pt);
      return { poly, center: [c.center[0] * sx, c.center[1] / sx], area: polyArea(poly) };
    });
}

function cellsOf(seeds: Pt[], reach: number): VoronoiCell[] {
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number) => `${Math.floor(x / reach)},${Math.floor(y / reach)}`;
  seeds.forEach((s, i) => {
    const k = key(s[0], s[1]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(i);
  });
  return seeds.map((s, i) => {
    const h = reach * 1.2;
    let poly: Pt[] = [[s[0] - h, s[1] - h], [s[0] + h, s[1] - h], [s[0] + h, s[1] + h], [s[0] - h, s[1] + h]];
    const gx = Math.floor(s[0] / reach);
    const gy = Math.floor(s[1] / reach);
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        for (const j of grid.get(`${gx + a},${gy + b}`) ?? []) {
          if (j === i) continue;
          const t = seeds[j];
          const nx = t[0] - s[0];
          const ny = t[1] - s[1];
          const d = (nx * (t[0] + s[0]) + ny * (t[1] + s[1])) / 2;
          poly = clipPoly(poly, nx, ny, d);
        }
      }
    }
    const center = polyCentroid(poly);
    return { poly, center, area: polyArea(poly) };
  });
}
