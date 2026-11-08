/**
 * Cấu hình electron theo Z (thuần): điền theo thứ tự năng lượng (Bước 1–3 của SGK), dạng đầy đủ / rút gọn khí hiếm /
 * số e theo lớp, nguyên tố s/p/d/f. Ngoại lệ Cr, Cu (ngoài phạm vi SGK 10) chỉ dùng khi `exceptions: true`.
 */
import { subshells as realSubshells } from '../elements/config';
import { AUFBAU, CAPACITY, energyRank, sup, type SubL, type SubshellId } from './subshell';
import { labText } from '../../text';

export interface SubshellFill extends SubshellId {
  e: number;
}

/** Ghi chú ngoại lệ (không có trong sách – chỉ để tham khảo). */
export const EXCEPTION_NOTES: Record<number, string> = {
  24: labText('t_25974cfd13f2'),
  29: labText('t_790b3b7b0ac7'),
};

export const NOBLE_GASES: readonly { Z: number; symbol: string }[] = [
  { Z: 2, symbol: 'He' },
  { Z: 10, symbol: 'Ne' },
  { Z: 18, symbol: 'Ar' },
  { Z: 36, symbol: 'Kr' },
  { Z: 54, symbol: 'Xe' },
];

/** Các phân lớp đã điền, theo thứ tự năng lượng tăng dần (1s 2s 2p 3s 3p 4s 3d …). */
export function aufbauFill(Z: number, o: { exceptions?: boolean } = {}): SubshellFill[] {
  if (o.exceptions && EXCEPTION_NOTES[Z])
    return realSubshells(Z)
      .map((s) => ({ n: s.n, l: s.l as SubL, e: s.e }))
      .sort((a, b) => energyRank(a) - energyRank(b));
  const out: SubshellFill[] = [];
  let left = Z;
  for (const s of AUFBAU) {
    if (left <= 0) break;
    const e = Math.min(CAPACITY(s.l), left);
    out.push({ ...s, e });
    left -= e;
  }
  return out;
}

export const formatFill = (list: SubshellFill[], joiner = '') => list.map((s) => `${s.n}${s.l}${sup(s.e)}`).join(joiner);

/** "1s²2s²2p⁴" (Bảng 3.1). */
export const fullConfig = (Z: number, joiner = '') => formatFill(aufbauFill(Z), joiner);

/** Khí hiếm đứng trước (Z_kh < Z) – null nếu Z ≤ 2. */
export function nobleCore(Z: number): { Z: number; symbol: string } | null {
  return [...NOBLE_GASES].reverse().find((g) => g.Z < Z) ?? null;
}

/** "[He]2s²2p⁴", "[Ar]4s¹"; Z ≤ 2 → dạng đầy đủ. */
export function shortConfig(Z: number, joiner = ''): string {
  const core = nobleCore(Z);
  if (!core) return fullConfig(Z, joiner);
  const rest = aufbauFill(Z).slice(aufbauFill(core.Z).length);
  return `[${core.symbol}]${formatFill(rest, joiner)}`;
}

/** Số e trên mỗi lớp K, L, M, N: O → [2, 6], K → [2, 8, 8, 1]. */
export function shellCountsOf(Z: number): number[] {
  const out: number[] = [];
  for (const s of aufbauFill(Z)) out[s.n - 1] = (out[s.n - 1] ?? 0) + s.e;
  return Array.from(out, (v) => v ?? 0);
}
export const shellText = (Z: number) => `(${shellCountsOf(Z).join(', ')})`;

/** Phân lớp chứa electron cuối cùng (theo thứ tự điền) và loại nguyên tố s/p/d/f. */
export function lastSubshell(Z: number): SubshellFill {
  const list = aufbauFill(Z);
  return list[list.length - 1];
}
export const blockOf = (Z: number): SubL => lastSubshell(Z).l;

/**
 * Đọc cấu hình học sinh gõ: "1s2 2s2 2p4", "1s²2s²2p⁴", "[He]2s22p4". Trả null nếu sai cú pháp.
 * Số mũ có thể là chữ số thường (1s2) – phân tách nhờ quy tắc: số lớp là 1 chữ số đứng trước chữ s/p/d/f.
 */
export function parseConfig(text: string): SubshellFill[] | null {
  const norm = text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c))).replace(/\s+/g, '');
  const out: SubshellFill[] = [];
  let rest = norm;
  const core = /^\[(He|Ne|Ar|Kr|Xe)\]/i.exec(rest);
  if (core) {
    const g = NOBLE_GASES.find((x) => x.symbol.toLowerCase() === core[1].toLowerCase());
    if (g) out.push(...aufbauFill(g.Z));
    rest = rest.slice(core[0].length);
  }
  while (rest.length) {
    // s, p: số mũ 1 chữ số; d, f: tối đa 10 / 14 → có thể 2 chữ số.
    const mm = /^([1-7])([spdf])/.exec(rest);
    const l = mm?.[2] as SubL | undefined;
    const ee = mm && l && (l === 'd' || l === 'f' ? /^(1[0-4]|[0-9])/ : /^[0-9]/).exec(rest.slice(2));
    if (!mm || !l || !ee) return null;
    out.push({ n: Number(mm[1]), l, e: Number(ee[0]) });
    rest = rest.slice(2 + ee[0].length);
  }
  return out.length ? out : null;
}

/** So sánh hai cấu hình (cùng phân lớp, cùng số e, cùng thứ tự). */
export function sameFill(a: SubshellFill[], b: SubshellFill[]): boolean {
  return a.length === b.length && a.every((s, i) => s.n === b[i].n && s.l === b[i].l && s.e === b[i].e);
}
