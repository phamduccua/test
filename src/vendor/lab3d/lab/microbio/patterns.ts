import type { P2 } from './streak';

/** Đường ria mẫu (thuần, mm, toạ độ đĩa như `streak.ts`). */
export interface StreakZone {
  /** Đường gấp khúc que đi qua (ziczac). */
  points: P2[];
  /** Chỗ đặt nhãn số vùng. */
  label: P2;
}

export interface ZoneLayout {
  /** Tâm vùng: bán kính (phần R) và góc (độ, ngược chiều kim đồng hồ từ +u). */
  r: number;
  deg: number;
}

/** Bố cục 5 vùng giống hình tròn phóng to ở H 20.4: 4 vùng quanh mép theo chiều kim đồng hồ, vùng 5 vào giữa. */
export const FIVE_ZONES: ZoneLayout[] = [
  { r: 0.58, deg: 140 },
  { r: 0.6, deg: 52 },
  { r: 0.58, deg: -35 },
  { r: 0.52, deg: -118 },
  { r: 0.12, deg: -175 },
];

const pol = (R: number, z: ZoneLayout): P2 => ({ u: R * z.r * Math.cos((z.deg * Math.PI) / 180), v: R * z.r * Math.sin((z.deg * Math.PI) / 180) });
const add = (a: P2, b: P2, k = 1): P2 => ({ u: a.u + b.u * k, v: a.v + b.v * k });

/** Trọng tâm các điểm (chỗ đặt nhãn vùng), kéo vào trong `lim`. */
function centroid(pts: P2[], lim: number): P2 {
  const s = pts.reduce((a, p) => ({ u: a.u + p.u, v: a.v + p.v }), { u: 0, v: 0 });
  return clamp({ u: s.u / pts.length, v: s.v / pts.length }, lim);
}

/** Kéo điểm vào trong vòng bán kính `lim`. */
function clamp(p: P2, lim: number): P2 {
  const d = Math.hypot(p.u, p.v);
  return d <= lim ? p : { u: (p.u * lim) / d, v: (p.v * lim) / d };
}

/**
 * Sinh đường ria cho từng vùng. Vùng 1: các nét ziczac song song sát mép. Vùng k ≥ 2: nét quạt bắt đầu
 * trong đuôi vùng k − 1 (cắt qua vệt cũ để mang tế bào sang) rồi toả ra vùng mới.
 */
export function streakZones(R: number, o: { layout?: ZoneLayout[]; strokes?: number; seed?: number } = {}): StreakZone[] {
  const layout = o.layout ?? FIVE_ZONES;
  const m = o.strokes ?? 6;
  let s = o.seed ?? 3;
  const jit = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 1.2;
  const lim = R - 2.5;
  return layout.map((z, k) => {
    const c = pol(R, z);
    const pts: P2[] = [];
    if (k === 0) {
      // Nét song song theo tiếp tuyến, xếp dần vào trong theo bán kính.
      const rad = { u: c.u / Math.hypot(c.u, c.v), v: c.v / Math.hypot(c.u, c.v) };
      const tan = { u: -rad.v, v: rad.u };
      const half = R * 0.26;
      for (let j = 0; j <= m; j++) {
        const off = add(c, rad, (0.5 - j / m) * R * 0.3);
        const dir = j % 2 ? 1 : -1;
        pts.push(clamp(add(add(off, tan, dir * half), rad, jit()), lim), clamp(add(add(off, tan, -dir * half * 0.9), rad, jit()), lim));
      }
      return { points: pts, label: centroid(pts, lim - 3) };
    }
    const p = pol(R, layout[k - 1]);
    const d = { u: c.u - p.u, v: c.v - p.v };
    const L = Math.hypot(d.u, d.v);
    const f = { u: d.u / L, v: d.v / L };
    const side = { u: -f.v, v: f.u };
    const spread = R * (k === layout.length - 1 ? 0.24 : 0.3);
    for (let j = 0; j < m; j++) {
      const t = j / (m - 1) - 0.5;
      const from = add(add(p, f, L * 0.1), side, t * spread * 0.8 + jit());
      const to = add(add(c, f, L * 0.28), side, t * spread * 1.2 + jit());
      pts.push(clamp(from, lim), clamp(to, lim));
    }
    return { points: pts, label: centroid(pts, lim - 3) };
  });
}
