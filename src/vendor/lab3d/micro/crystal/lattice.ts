/** Mạng tinh thể (thuần): ô mạng + cơ sở → danh sách nút, cặp láng giềng gần nhất, số phối trí. */
export type Vec3 = [number, number, number];

export interface SpeciesInfo {
  /** Nhãn hiển thị, vd. "Na⁺". */
  label: string;
  /** Tên SGK, vd. "ion sodium". */
  name: string;
  charge: number;
  /** Bán kính ion (Å). */
  radius: number;
  /** Màu theo SGK. */
  color: number;
  /** Màu CPK (Jmol) của nguyên tố. */
  cpk: number;
}

export interface BasisSite {
  species: string;
  frac: Vec3;
}

export interface CrystalPreset {
  id: string;
  name: string;
  /** Hằng số mạng lập phương (Å). */
  a: number;
  basis: BasisSite[];
  species: Record<string, SpeciesInfo>;
  /** Khoảng cách láng giềng gần nhất (Å). */
  nearest: number;
}

export interface Site {
  species: string;
  /** Toạ độ Å, đã dời tâm khối về gốc. */
  pos: Vec3;
  /** Toạ độ theo nút lưới (số nguyên khi là mạng NaCl, đơn vị a/2). */
  grid: Vec3;
}

const EPS = 1e-6;

/**
 * Các nút trong khối lập phương [0, extent]³ (đơn vị ô mạng, có thể lẻ như 1,5), gồm cả nút trên mặt/cạnh biên.
 * NaCl: extent = (số nút mỗi cạnh − 1) / 2 → 3 nút/cạnh = 1 ô mạng = 27 ion (Hình 11.1b).
 */
export function latticeSites(p: CrystalPreset, extent: number): Site[] {
  const n = Math.ceil(extent + EPS);
  const out: Site[] = [];
  const half = (extent * p.a) / 2;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++)
      for (let k = 0; k <= n; k++)
        for (const b of p.basis) {
          const f: Vec3 = [i + b.frac[0], j + b.frac[1], k + b.frac[2]];
          if (f.some((v) => v > extent + EPS)) continue;
          const pos: Vec3 = [f[0] * p.a - half, f[1] * p.a - half, f[2] * p.a - half];
          out.push({ species: b.species, pos, grid: [Math.round(f[0] * 2), Math.round(f[1] * 2), Math.round(f[2] * 2)] });
        }
  // Thứ tự lắp: từ tầng dưới lên (y), rồi z, rồi x.
  out.sort((s, t) => s.pos[1] - t.pos[1] || s.pos[2] - t.pos[2] || s.pos[0] - t.pos[0]);
  return out;
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Các cặp (i, j) cách nhau ≈ khoảng láng giềng gần nhất. */
export function neighborPairs(sites: Site[], nearest: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < sites.length; i++)
    for (let j = i + 1; j < sites.length; j++) if (Math.abs(dist(sites[i].pos, sites[j].pos) - nearest) < 0.05 * nearest) out.push([i, j]);
  return out;
}

/** Chỉ số các nút láng giềng gần nhất của nút i (= số phối trí nếu nút ở trong khối). */
export function coordinationOf(sites: Site[], i: number, nearest: number): number[] {
  const out: number[] = [];
  sites.forEach((s, j) => {
    if (j !== i && Math.abs(dist(s.pos, sites[i].pos) - nearest) < 0.05 * nearest) out.push(j);
  });
  return out;
}

/** Nút gần tâm khối nhất (ưu tiên loài `species` nếu cho). */
export function centralSite(sites: Site[], species?: string): number {
  let best = -1;
  let bd = Infinity;
  sites.forEach((s, i) => {
    if (species && s.species !== species) return;
    const d = Math.hypot(...s.pos);
    if (d < bd - EPS) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** Nút cùng dấu kề nhau (lỗi xếp) – dùng cho kiểm tra lắp ráp: true nếu đặt `species` ở nút i là sai. */
export function sameChargeConflict(p: CrystalPreset, sites: Site[], placed: ReadonlyMap<number, string>, i: number, species: string): boolean {
  const q = p.species[species]?.charge ?? 0;
  for (const j of coordinationOf(sites, i, p.nearest)) {
    const other = placed.get(j);
    if (other && Math.sign(p.species[other]?.charge ?? 0) === Math.sign(q)) return true;
  }
  return false;
}
