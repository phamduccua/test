/** Cấu hình electron (thuần): thứ tự Klechkowski + ngoại lệ Cr, Cu (và các nguyên tố nặng hơn cùng nhóm). */
export interface Subshell {
  n: number;
  l: 's' | 'p' | 'd' | 'f';
  e: number;
}

const ORDER: [number, Subshell['l']][] = [
  [1, 's'], [2, 's'], [2, 'p'], [3, 's'], [3, 'p'], [4, 's'], [3, 'd'], [4, 'p'], [5, 's'], [4, 'd'], [5, 'p'],
  [6, 's'], [4, 'f'], [5, 'd'], [6, 'p'], [7, 's'], [5, 'f'], [6, 'd'], [7, 'p'],
];
const CAP = { s: 2, p: 6, d: 10, f: 14 } as const;
/** Z → số electron chuyển từ ns sang (n−1)d. */
const EXCEPTIONS: Record<number, number> = { 24: 1, 29: 1, 41: 1, 42: 1, 44: 1, 45: 1, 46: 2, 47: 1, 78: 1, 79: 1 };

/** Danh sách phân lớp theo thứ tự lớp (1s 2s 2p 3s 3p 3d 4s …). */
export function subshells(Z: number): Subshell[] {
  const out: Subshell[] = [];
  let left = Z;
  for (const [n, l] of ORDER) {
    if (left <= 0) break;
    const e = Math.min(CAP[l], left);
    out.push({ n, l, e });
    left -= e;
  }
  const shift = EXCEPTIONS[Z];
  if (shift) {
    const d = [...out].reverse().find((s) => s.l === 'd');
    const s = d && out.find((x) => x.l === 's' && x.n === d.n + 1);
    if (d && s) {
      d.e += shift;
      s.e -= shift;
      if (s.e === 0) out.splice(out.indexOf(s), 1);
    }
  }
  return out.sort((a, b) => a.n - b.n || 'spdf'.indexOf(a.l) - 'spdf'.indexOf(b.l));
}

/** Số electron trên từng lớp K, L, M, N… (vd. Na → [2, 8, 1]). */
export function shellCounts(Z: number): number[] {
  const shells: number[] = [];
  for (const s of subshells(Z)) shells[s.n - 1] = (shells[s.n - 1] ?? 0) + s.e;
  return Array.from(shells, (v) => v ?? 0);
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (v: number) => String(v).split('').map((c) => SUP[Number(c)]).join('');

/** Chuỗi cấu hình kiểu SGK: "1s² 2s² 2p⁶ 3s¹". */
export function configString(Z: number): string {
  return subshells(Z).map((s) => `${s.n}${s.l}${sup(s.e)}`).join(' ');
}
