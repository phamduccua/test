/**
 * Độ âm điện tương đối theo Pauling – SGK Hoá 10 KNTT, Bảng 6.2 (trang in 37).
 * Chu kì 1–6 × nhóm IA–VIIA. Sách in nhầm "₂Li" → đúng là ₃Li.
 * `book`: màu ô trong bảng – 'white' (H), 'blue' (xanh lam – kim loại), 'red' (đỏ san hô – phi kim).
 */
export type BookCellColor = 'white' | 'blue' | 'red';

export interface ElectronegativityDatum {
  Z: number;
  symbol: string;
  period: number;
  /** Nhóm A (1 = IA … 7 = VIIA). */
  group: number;
  /** Độ âm điện χ (Pauling). */
  chi: number;
  book: BookCellColor;
}

type Cell = readonly [number, string, number, 'b' | 'r' | 'w'];

const ROWS: readonly (readonly Cell[])[] = [
  [[1, 'H', 2.2, 'w']],
  [[3, 'Li', 0.98, 'b'], [4, 'Be', 1.57, 'b'], [5, 'B', 2.04, 'r'], [6, 'C', 2.55, 'r'], [7, 'N', 3.04, 'r'], [8, 'O', 3.44, 'r'], [9, 'F', 3.98, 'r']],
  [[11, 'Na', 0.93, 'b'], [12, 'Mg', 1.31, 'b'], [13, 'Al', 1.61, 'b'], [14, 'Si', 1.9, 'r'], [15, 'P', 2.19, 'r'], [16, 'S', 2.58, 'r'], [17, 'Cl', 3.16, 'r']],
  [[19, 'K', 0.82, 'b'], [20, 'Ca', 1.0, 'b'], [31, 'Ga', 1.81, 'b'], [32, 'Ge', 2.01, 'b'], [33, 'As', 2.18, 'r'], [34, 'Se', 2.55, 'r'], [35, 'Br', 2.96, 'r']],
  [[37, 'Rb', 0.82, 'b'], [38, 'Sr', 0.95, 'b'], [49, 'In', 1.78, 'b'], [50, 'Sn', 1.96, 'b'], [51, 'Sb', 2.05, 'b'], [52, 'Te', 2.1, 'b'], [53, 'I', 2.66, 'r']],
  [[55, 'Cs', 0.79, 'b'], [56, 'Ba', 0.89, 'b'], [81, 'Tl', 1.62, 'b'], [82, 'Pb', 2.33, 'b'], [83, 'Bi', 2.02, 'b'], [84, 'Po', 2.0, 'b'], [85, 'At', 2.2, 'r']],
];

const COLOR = { b: 'blue', r: 'red', w: 'white' } as const;

export const ELECTRONEGATIVITY_BOOK: readonly ElectronegativityDatum[] = ROWS.flatMap((row, i) =>
  row.map(([Z, symbol, chi, c], g) => ({ Z, symbol, period: i + 1, group: g + 1, chi, book: COLOR[c] })),
);

export function electronegativity(symbol: string): ElectronegativityDatum | undefined {
  return ELECTRONEGATIVITY_BOOK.find((d) => d.symbol === symbol);
}
