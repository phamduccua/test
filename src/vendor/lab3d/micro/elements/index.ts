import { shellCounts } from './config';
import { ELEMENT_ROWS } from './table';
import { labText } from '../../text';

export { subshells, shellCounts, configString, type Subshell } from './config';

export interface ElementInfo {
  Z: number;
  symbol: string;
  /** Tên theo SGK (IUPAC tiếng Anh). */
  name: string;
  /** Tên tiếng Việt quen dùng. */
  nameVi: string;
  mass: number;
  /** Màu CPK (Jmol), dạng số 0xRRGGBB. */
  color: number;
  /** Bán kính cộng hoá trị (Å). */
  covalent: number;
  /** Bán kính van der Waals (Å). */
  vdw: number;
  /** Số electron mỗi lớp. */
  shells: number[];
}

export const ELEMENTS: readonly ElementInfo[] = ELEMENT_ROWS.map(([symbol, name, nameVi, mass, color, cov, vdw], i) => ({
  Z: i + 1,
  symbol,
  name,
  nameVi,
  mass,
  color,
  covalent: cov / 100,
  vdw: vdw / 100,
  shells: shellCounts(i + 1),
}));

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol.toLowerCase(), e]));

/** Tra nguyên tố theo kí hiệu ("Na") hoặc số hiệu (11). Ném lỗi nếu không có. */
export function element(key: string | number): ElementInfo {
  const e = typeof key === 'number' ? ELEMENTS[key - 1] : BY_SYMBOL.get(key.toLowerCase());
  if (!e) throw new Error(`${labText('t_4805f71c8df3')}${key}`);
  return e;
}

/** Số khối A gần đúng (làm tròn nguyên tử khối). */
export function massNumber(Z: number): number {
  return Math.round(element(Z).mass);
}

/** Bán kính ion (Å, Shannon, số phối trí 6) cho các ion hay dùng trong SGK. */
export const IONIC_RADII: Record<string, number> = {
  'Li+': 0.76, 'Na+': 1.02, 'K+': 1.38, 'Mg2+': 0.72, 'Ca2+': 1.0, 'Al3+': 0.535,
  'F-': 1.33, 'Cl-': 1.81, 'Br-': 1.96, 'I-': 2.2, 'O2-': 1.4, 'S2-': 1.84,
};
