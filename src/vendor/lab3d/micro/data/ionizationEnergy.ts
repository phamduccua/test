import { labText } from '../../text';
/**
 * Năng lượng ion hoá thứ nhất I₁ (kJ/mol) của Z = 1–18 – SGK Hoá 10 KNTT, Hình 6.3 (trang in 36).
 * Hai bộ số liệu: 'nist' = số liệu chuẩn NIST (H = 1312 đúng như lời sách),
 * 'book' = giá trị đọc từ đồ thị Hình 6.3 (sơ đồ định tính, vd. N ≈ 1270, Mg ≈ 595).
 */
export type IonizationSet = 'nist' | 'book';

export interface IonizationDatum {
  Z: number;
  symbol: string;
  period: number;
  /** Nhóm A (1 = IA … 8 = VIIIA; He xếp nhóm VIIIA). */
  group: number;
  nist: number;
  book: number;
}

type Row = readonly [string, number, number, number, number];

// [kí hiệu, chu kì, nhóm, NIST, như hình sách]
const ROWS: readonly Row[] = [
  ['H', 1, 1, 1312, 1230],
  ['He', 1, 8, 2372, 2360],
  ['Li', 2, 1, 520, 590],
  ['Be', 2, 2, 899, 850],
  ['B', 2, 3, 801, 760],
  ['C', 2, 4, 1086, 1040],
  ['N', 2, 5, 1402, 1270],
  ['O', 2, 6, 1314, 1195],
  ['F', 2, 7, 1681, 1530],
  ['Ne', 2, 8, 2081, 2020],
  ['Na', 3, 1, 496, 440],
  ['Mg', 3, 2, 738, 595],
  ['Al', 3, 3, 578, 535],
  ['Si', 3, 4, 787, 695],
  ['P', 3, 5, 1012, 1070],
  ['S', 3, 6, 1000, 1030],
  ['Cl', 3, 7, 1251, 1210],
  ['Ar', 3, 8, 1521, 1590],
];

export const IONIZATION_ENERGY: readonly IonizationDatum[] = ROWS.map(([symbol, period, group, nist, book], i) => ({
  Z: i + 1,
  symbol,
  period,
  group,
  nist,
  book,
}));

export const IONIZATION_SET_LABEL: Record<IonizationSet, string> = {
  nist: labText('t_7a333fa2a5a7'),
  book: labText('t_9af67b14075d'),
};

/** I₁ theo bộ số liệu. */
export const ionization = (d: IonizationDatum, set: IonizationSet) => (set === 'nist' ? d.nist : d.book);

export function ionizationOf(symbol: string): IonizationDatum | undefined {
  return IONIZATION_ENERGY.find((d) => d.symbol === symbol);
}
