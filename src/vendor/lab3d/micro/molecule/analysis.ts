/** Phân tích phân tử (thuần): láng giềng, đếm liên kết, góc liên kết, thứ tự lắp ráp. */
import type { MoleculeData } from './types';
import { labText } from '../../text';

export function neighbors(m: MoleculeData): number[][] {
  const nb: number[][] = m.atoms.map(() => []);
  for (const b of m.bonds) {
    nb[b.a].push(b.b);
    nb[b.b].push(b.a);
  }
  return nb;
}

export interface BondCounts {
  single: number;
  double: number;
  triple: number;
}

export function bondCounts(m: MoleculeData): BondCounts {
  const c = { single: 0, double: 0, triple: 0 };
  for (const b of m.bonds) {
    if (b.order === 3) c.triple++;
    else if (b.order === 2) c.double++;
    else c.single++;
  }
  return c;
}

/** "4 đơn + 1 đôi" … */
export function bondCountText(c: BondCounts): string {
  const parts: string[] = [];
  if (c.single) parts.push(`${c.single}${labText('t_22b57278badb')}`);
  if (c.double) parts.push(`${c.double}${labText('t_179b98085c81')}`);
  if (c.triple) parts.push(`${c.triple} ba`);
  return parts.join(' + ') || '–';
}

export interface BondAngle {
  center: number;
  a: number;
  b: number;
  /** Độ. */
  deg: number;
}

export function angleDeg(m: MoleculeData, a: number, c: number, b: number): number {
  const A = m.atoms[a], C = m.atoms[c], B = m.atoms[b];
  const u = [A.x - C.x, A.y - C.y, A.z - C.z];
  const v = [B.x - C.x, B.y - C.y, B.z - C.z];
  const d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(u[0], u[1], u[2]) * Math.hypot(v[0], v[1], v[2]));
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
}

/**
 * Các góc liên kết tiêu biểu: với mỗi nguyên tử trung tâm (≥ 2 liên kết) lấy mỗi giá trị góc khác nhau một lần
 * (làm tròn 1°), ưu tiên cặp có nguyên tử nặng.
 */
export function representativeAngles(m: MoleculeData): BondAngle[] {
  const nb = neighbors(m);
  const out: BondAngle[] = [];
  nb.forEach((list, c) => {
    if (list.length < 2) return;
    const seen = new Set<number>();
    const pairs: [number, number][] = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) pairs.push([list[i], list[j]]);
    const heavy = (k: number) => (m.atoms[k].el === 'H' ? 0 : 1);
    pairs.sort((p, q) => heavy(q[0]) + heavy(q[1]) - heavy(p[0]) - heavy(p[1]));
    for (const [a, b] of pairs) {
      const deg = angleDeg(m, a, c, b);
      const key = Math.round(deg);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ center: c, a, b, deg });
    }
  });
  return out;
}

/** Thứ tự lắp: duyệt BFS từ nguyên tử nặng có nhiều liên kết nhất; mỗi bước = 1 nguyên tử + liên kết với cái đã có. */
export function assemblyOrder(m: MoleculeData): { atom: number; bonds: number[] }[] {
  const nb = neighbors(m);
  const n = m.atoms.length;
  if (!n) return [];
  let start = 0;
  for (let i = 0; i < n; i++) if (m.atoms[i].el !== 'H' && nb[i].length > nb[start].length) start = i;
  const placed = new Set<number>();
  const order: number[] = [];
  const queue = [start];
  // Ưu tiên khung nguyên tử nặng trước, H sau.
  while (order.length < n) {
    const next = queue.shift() ?? [...Array(n).keys()].find((i) => !placed.has(i))!;
    if (placed.has(next)) continue;
    placed.add(next);
    order.push(next);
    const fresh = nb[next].filter((k) => !placed.has(k));
    queue.push(...fresh.filter((k) => m.atoms[k].el !== 'H'), ...fresh.filter((k) => m.atoms[k].el === 'H'));
    queue.sort((p, q) => Number(m.atoms[p].el === 'H') - Number(m.atoms[q].el === 'H'));
  }
  const done = new Set<number>();
  return order.map((atom) => {
    done.add(atom);
    const bonds = m.bonds.flatMap((b, i) => ((b.a === atom && done.has(b.b)) || (b.b === atom && done.has(b.a)) ? [i] : []));
    return { atom, bonds };
  });
}
