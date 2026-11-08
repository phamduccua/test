import { colonyRadius, VISIBLE_R, type Strain } from './growth';
import { poisson, type Rng } from './random';
import { cellCenter, inside, type PlateGrid } from './streak';

/** Khuẩn lạc trên đĩa (thuần). Mỗi tế bào sống rơi trên thạch → một khuẩn lạc; ô quá dày → thảm. */
export type ColonyKind = 'main' | 'mould' | 'yellow';

export interface Colony {
  u: number;
  v: number;
  /** Vùng ria (−1 = không thuộc vùng nào, vd. nhiễm từ không khí). */
  zone: number;
  kind: ColonyKind;
  /** Tiềm phát riêng cộng thêm (giờ-chuẩn). */
  lag: number;
  /** Bán kính tối đa do chen chúc (mm). */
  cap: number;
  /** Hệ số cỡ riêng (0,8…1,2). */
  size: number;
}

export interface PlateCulture {
  colonies: Colony[];
  /** Mật độ thảm (tế bào/mm²) theo ô của lưới; 0 = không phải thảm. */
  lawn: Float32Array;
  lawnCells: number;
}

/** Ô có ≥ `lawnAt` tế bào/mm² thì các khuẩn lạc chạm nhau ngay khi còn rất nhỏ → vẽ thành thảm. */
export function seedColonies(g: PlateGrid, r: Rng, o: { lawnAt?: number; max?: number } = {}): PlateCulture {
  const lawnAt = o.lawnAt ?? 8;
  const max = o.max ?? 2400;
  const area = g.cell * g.cell;
  const lawn = new Float32Array(g.cells.length);
  const colonies: Colony[] = [];
  let lawnCells = 0;
  g.cells.forEach((n, k) => {
    if (n <= 0 || !inside(g, k)) return;
    if (n / area >= lawnAt || colonies.length >= max) {
      lawn[k] = n / area;
      lawnCells++;
      return;
    }
    const c = cellCenter(g, k);
    for (let i = poisson(r, n); i > 0; i--)
      colonies.push({ u: c.u + (r() - 0.5) * g.cell, v: c.v + (r() - 0.5) * g.cell, zone: g.zone[k], kind: 'main', lag: (r() - 0.5) * 0.8, cap: 9, size: 0.85 + 0.3 * r() });
  });
  limitByNeighbours(colonies, g.cell * 6);
  return { colonies, lawn, lawnCells };
}

/** Bào tử/tế bào từ không khí rơi xuống đĩa mở nắp: Poisson(λ), vị trí đều trên mặt thạch. */
export function airborne(R: number, lambda: number, r: Rng): Colony[] {
  const out: Colony[] = [];
  for (let i = poisson(r, lambda); i > 0; i--) {
    const a = r() * Math.PI * 2;
    const d = R * 0.95 * Math.sqrt(r());
    const kind: ColonyKind = r() < 0.6 ? 'mould' : 'yellow';
    out.push({ u: d * Math.cos(a), v: d * Math.sin(a), zone: -1, kind, lag: 2 + 3 * r(), cap: 9, size: kind === 'mould' ? 1.6 + r() : 0.7 + 0.3 * r() });
  }
  return out;
}

/** Chặn bán kính bằng nửa khoảng cách tới khuẩn lạc gần nhất (+10 % cho hai khuẩn lạc chạm, nhập vào nhau). */
export function limitByNeighbours(list: Colony[], bin: number) {
  const key = (u: number, v: number) => `${Math.floor(u / bin)},${Math.floor(v / bin)}`;
  const hash = new Map<string, Colony[]>();
  list.forEach((c) => {
    const k = key(c.u, c.v);
    (hash.get(k) ?? hash.set(k, []).get(k)!).push(c);
  });
  list.forEach((c) => {
    let best = Infinity;
    const iu = Math.floor(c.u / bin);
    const iv = Math.floor(c.v / bin);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (const o of hash.get(`${iu + a},${iv + b}`) ?? []) if (o !== c) best = Math.min(best, Math.hypot(o.u - c.u, o.v - c.v));
    c.cap = Math.min(c.cap, best * 0.55);
  });
}

/** Bán kính hiện tại (mm) của khuẩn lạc sau `age` giờ-chuẩn. */
export function radiusOf(c: Colony, s: Strain, age: number): number {
  return Math.min(c.cap, colonyRadius(s, age, c.lag) * c.size);
}

export interface ZoneCount {
  /** Số khuẩn lạc (gồm cả còn nhỏ chưa thấy) trong vùng. */
  total: number;
  /** Số khuẩn lạc nhìn thấy, tách rời (không chạm khuẩn lạc khác). */
  isolated: number;
  /** Vùng có thảm vi khuẩn. */
  lawn: boolean;
}

/** Đếm khuẩn lạc theo vùng ở `age` giờ-chuẩn (khuẩn lạc chạm nhau – bán kính bị chặn – không tính là riêng rẽ). */
export function countZones(pc: PlateCulture, g: PlateGrid, s: Strain, age: number, zones: number): ZoneCount[] {
  const out = Array.from({ length: zones }, () => ({ total: 0, isolated: 0, lawn: false }));
  pc.lawn.forEach((d, k) => d > 0 && g.zone[k] >= 0 && (out[g.zone[k]].lawn = true));
  for (const c of pc.colonies) {
    if (c.kind !== 'main' || c.zone < 0) continue;
    const z = out[c.zone];
    z.total++;
    const r = radiusOf(c, s, age);
    if (r >= VISIBLE_R && r < c.cap * 0.98) z.isolated++;
  }
  return out;
}
