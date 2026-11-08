/** Phân lớp, thứ tự năng lượng (Aufbau / Klechkowski) và kí hiệu chỉ số trên (thuần, không three). */
export type SubL = 's' | 'p' | 'd' | 'f';
export interface SubshellId {
  n: number;
  l: SubL;
}
/** +1 = ↑ (lên), −1 = ↓ (xuống). */
export type Spin = 1 | -1;

export const L_INDEX: Record<SubL, number> = { s: 0, p: 1, d: 2, f: 3 };
/** Số AO trong phân lớp: s 1, p 3, d 5, f 7. */
export const ORBITALS_PER: Record<SubL, number> = { s: 1, p: 3, d: 5, f: 7 };
export const CAPACITY = (l: SubL) => 2 * ORBITALS_PER[l];
export const SHELL_NAMES = 'KLMNOPQ';

/** Thứ tự tăng dần năng lượng: 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p. */
export const AUFBAU: readonly SubshellId[] = (
  ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p'] as const
).map((k) => ({ n: Number(k[0]), l: k[1] as SubL }));

export const subName = (s: SubshellId) => `${s.n}${s.l}`;
export const sameSub = (a: SubshellId, b: SubshellId) => a.n === b.n && a.l === b.l;

/** Hạng năng lượng (vị trí trong dãy Aufbau). */
export function energyRank(s: SubshellId): number {
  const i = AUFBAU.findIndex((a) => sameSub(a, s));
  return i < 0 ? 99 + s.n * 4 + L_INDEX[s.l] : i;
}

/** "1s 2s 2p 3s" → danh sách phân lớp. */
export function parseSubshells(text: string): SubshellId[] {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((k) => ({ n: Number(k.slice(0, -1)), l: k.slice(-1) as SubL }));
}

/** Các phân lớp của lớp n (n ≤ 4 theo sách): 3 → 3s 3p 3d. */
export function shellSubshells(n: number): SubshellId[] {
  return (['s', 'p', 'd', 'f'] as SubL[]).slice(0, Math.min(n, 4)).map((l) => ({ n, l }));
}

/** Lớp n: tên K/L/M/N, số phân lớp n, số AO n², số e tối đa 2n². */
export function shellInfo(n: number) {
  const subs = shellSubshells(n);
  const orbitals = subs.reduce((a, s) => a + ORBITALS_PER[s.l], 0);
  return { n, name: SHELL_NAMES[n - 1] ?? `n=${n}`, subs, subCount: subs.length, orbitals, electrons: 2 * orbitals };
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 12 → "¹²". */
export const sup = (v: number) =>
  String(v)
    .split('')
    .map((c) => SUP[Number(c)] ?? c)
    .join('');
