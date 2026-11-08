/** Dựng toạ độ phân tử từ z-matrix (độ dài liên kết, góc, góc nhị diện) – thuần, thuật toán NeRF. */
import type { BondOrder, MolAtom, MolBond } from './types';

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const D = Math.PI / 180;

/**
 * Một dòng z-matrix: nguyên tố, nối với `to` (độ dài r Å, bậc liên kết), góc `angle`° với `at`,
 * nhị diện `dih`° với `dt`. Nguyên tử đầu tiên chỉ cần `el`.
 */
export interface ZRow {
  el: string;
  to?: number;
  r?: number;
  at?: number;
  angle?: number;
  dt?: number;
  dih?: number;
  order?: BondOrder;
}

/** Đặt nguyên tử d sao cho |cd| = r, ∠bcd = θ, nhị diện abcd = φ. */
function place(a: V, b: V, c: V, r: number, theta: number, phi: number): V {
  const bc = norm(sub(c, b));
  const n = norm(cross(sub(b, a), bc));
  const m = cross(n, bc);
  const dx = -r * Math.cos(theta);
  const dy = r * Math.sin(theta) * Math.cos(phi);
  const dz = r * Math.sin(theta) * Math.sin(phi);
  return [c[0] + dx * bc[0] + dy * m[0] + dz * n[0], c[1] + dx * bc[1] + dy * m[1] + dz * n[1], c[2] + dx * bc[2] + dy * m[2] + dz * n[2]];
}

export function fromZMatrix(rows: ZRow[]): { atoms: MolAtom[]; bonds: MolBond[] } {
  const P: V[] = [];
  const bonds: MolBond[] = [];
  rows.forEach((row, i) => {
    if (i === 0 || row.to === undefined) {
      P.push([0, 0, 0]);
      return;
    }
    const c = P[row.to];
    const r = row.r ?? 1;
    if (row.at === undefined) {
      P.push([c[0] + r, c[1], c[2]]);
    } else {
      const b = P[row.at];
      // Điểm giả cho nhị diện khi chưa đủ 3 nguyên tử tham chiếu.
      const a: V = row.dt !== undefined ? P[row.dt] : [b[0], b[1] + 1, b[2] + 0.37];
      P.push(place(a, b, c, r, (row.angle ?? 109.47) * D, (row.dih ?? 0) * D));
    }
    bonds.push({ a: row.to, b: i, order: row.order ?? 1 });
  });
  return { atoms: rows.map((row, i) => ({ el: row.el, x: P[i][0], y: P[i][1], z: P[i][2] })), bonds };
}

/** Dời gốc về trọng tâm hình học. */
export function centered(atoms: MolAtom[]): MolAtom[] {
  const n = atoms.length || 1;
  const c = atoms.reduce((s, a) => [s[0] + a.x / n, s[1] + a.y / n, s[2] + a.z / n], [0, 0, 0]);
  return atoms.map((a) => ({ ...a, x: a.x - c[0], y: a.y - c[1], z: a.z - c[2] }));
}
