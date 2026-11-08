import type { OrbitalQN } from './hydrogen';

/** Tên / nhãn orbital thực (thuần). */
export const SUBSHELL = 'spdfghik';

const NAMES: Record<number, Record<number, string>> = {
  0: { 0: '' },
  1: { 1: 'x', [-1]: 'y', 0: 'z' },
  2: { [-2]: 'xy', [-1]: 'yz', 0: 'z²', 1: 'xz', 2: 'x²−y²' },
  3: { [-3]: 'y(3x²−y²)', [-2]: 'xyz', [-1]: 'yz²', 0: 'z³', 1: 'xz²', 2: 'z(x²−y²)', 3: 'x(x²−3y²)' },
};

/** Chỉ số dưới của orbital (vd. "x", "xy", "z²"), "m=…" khi l ≥ 4. */
export function orbitalSuffix(l: number, m: number): string {
  return NAMES[l]?.[m] ?? `m=${m}`;
}

/** "2px", "3dz²", "1s"… */
export function orbitalName({ n, l, m }: OrbitalQN): string {
  return `${n}${SUBSHELL[l] ?? `[l=${l}]`}${orbitalSuffix(l, m)}`;
}

/** Thứ tự m quen dùng trong sách: p → x, y, z; d → xy, xz, yz, x²−y², z². */
export function mOrder(l: number): number[] {
  if (l === 1) return [1, -1, 0];
  if (l === 2) return [-2, 1, -1, 2, 0];
  const out: number[] = [];
  for (let m = -l; m <= l; m++) out.push(m);
  return out;
}

/** Toàn bộ orbital thực của một phân lớp n, l. */
export function subshellOrbitals(n: number, l: number): OrbitalQN[] {
  return mOrder(l).map((m) => ({ n, l, m }));
}

/** Đọc tên kiểu "2px", "3dxy", "1s", "3dz2" → bộ số lượng tử (null nếu không nhận ra). */
export function parseOrbital(name: string): OrbitalQN | null {
  const mm = /^(\d+)([spdf])(.*)$/.exec(name.replace(/\s|_/g, ''));
  if (!mm) return null;
  const n = Number(mm[1]);
  const l = SUBSHELL.indexOf(mm[2]);
  const suf = mm[3]
    .replace(/([a-z)])2/g, '$1²')
    .replace(/([a-z)])3/g, '$1³')
    .replace(/-/g, '−');
  const entry = Object.entries(NAMES[l] ?? {}).find(([, v]) => v === suf);
  return entry && l < n ? { n, l, m: Number(entry[0]) } : null;
}
