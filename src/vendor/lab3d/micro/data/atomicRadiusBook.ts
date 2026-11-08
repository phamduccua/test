/**
 * Bán kính nguyên tử theo SGK Hoá 10 KNTT – Hình 6.2 (trang in 35; nguồn Silberberg 2007), đơn vị pm.
 * Chu kì 2–5 × nhóm IA–VIIA. Sách in nhầm "18K" → đúng là ₁₉K.
 * `book`: màu quả cầu trong hình – 'blue' (xanh lam) hoặc 'red' (đỏ).
 */
export interface BookRadius {
  Z: number;
  symbol: string;
  period: number;
  /** Nhóm A (1 = IA … 7 = VIIA). */
  group: number;
  /** Bán kính nguyên tử (pm). */
  r: number;
  book: 'blue' | 'red';
}

type Row = readonly [number, string, number, 'b' | 'r'];

const ROWS: readonly (readonly Row[])[] = [
  [[3, 'Li', 152, 'b'], [4, 'Be', 112, 'b'], [5, 'B', 85, 'r'], [6, 'C', 77, 'r'], [7, 'N', 75, 'r'], [8, 'O', 73, 'r'], [9, 'F', 72, 'r']],
  [[11, 'Na', 186, 'b'], [12, 'Mg', 160, 'b'], [13, 'Al', 143, 'b'], [14, 'Si', 118, 'r'], [15, 'P', 110, 'r'], [16, 'S', 103, 'r'], [17, 'Cl', 100, 'r']],
  [[19, 'K', 227, 'b'], [20, 'Ca', 197, 'b'], [31, 'Ga', 135, 'b'], [32, 'Ge', 122, 'b'], [33, 'As', 120, 'r'], [34, 'Se', 119, 'r'], [35, 'Br', 114, 'r']],
  [[37, 'Rb', 248, 'b'], [38, 'Sr', 215, 'b'], [49, 'In', 167, 'b'], [50, 'Sn', 140, 'b'], [51, 'Sb', 140, 'b'], [52, 'Te', 142, 'b'], [53, 'I', 133, 'r']],
];

export const ATOMIC_RADIUS_BOOK: readonly BookRadius[] = ROWS.flatMap((row, i) =>
  row.map(([Z, symbol, r, c], g) => ({ Z, symbol, period: i + 2, group: g + 1, r, book: c === 'b' ? 'blue' : 'red' }) as BookRadius),
);

/** Tra theo kí hiệu. */
export function bookRadius(symbol: string): BookRadius | undefined {
  return ATOMIC_RADIUS_BOOK.find((d) => d.symbol === symbol);
}
