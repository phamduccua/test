import { labText } from '../../text';
/**
 * Sinh trưởng vi khuẩn trên thạch (thuần, không three).
 * µ(T): mô hình nhiệt độ cardinal CTMI (Rosso và cs. 1993, J. Theor. Biol. 162:447).
 * Khuẩn lạc: pha mũ khi còn là vi khuẩn lạc, rồi bán kính tăng tuyến tính (Pirt 1967, J. Gen. Microbiol. 47:181).
 */
export interface Strain {
  name: string;
  /** Nhiệt độ tối thiểu / tối ưu / tối đa (°C). */
  tMin: number;
  tOpt: number;
  tMax: number;
  /** Tốc độ sinh trưởng riêng ở Topt (h⁻¹). */
  muOpt: number;
  /** Pha tiềm phát ở Topt (giờ); dài ra tỉ lệ nghịch µ. */
  lag: number;
  /** Tốc độ tăng bán kính khuẩn lạc pha tuyến tính ở Topt (mm/h). */
  kr: number;
  /** Bán kính tối đa của khuẩn lạc riêng rẽ (mm). */
  rMax: number;
  /** Màu khuẩn lạc (hex) để vẽ. */
  color: string;
}

/** Vi khuẩn ưa ấm kiểu E. coli: 5 / 39 / 47 °C, µopt 1,8 h⁻¹ (thế hệ ≈ 23 phút), Kr ≈ 70 µm/h. */
export const MESOPHILE: Strain = { name: labText('t_2375bb5659ca'), tMin: 5, tOpt: 39, tMax: 47, muOpt: 1.8, lag: 1.5, kr: 0.07, rMax: 1.6, color: '#f4efe2' };
/** Ưa lạnh (Pseudomonas fluorescens-type): −5 / 25 / 32 °C. */
export const PSYCHROPHILE: Strain = { name: labText('t_feb69683e588'), tMin: -5, tOpt: 25, tMax: 32, muOpt: 0.9, lag: 2.5, kr: 0.04, rMax: 1.4, color: '#efe6c8' };
/** Ưa nhiệt (Geobacillus-type): 40 / 62 / 72 °C. */
export const THERMOPHILE: Strain = { name: labText('t_e63f1c1aeb38'), tMin: 40, tOpt: 62, tMax: 72, muOpt: 2.4, lag: 1.2, kr: 0.09, rMax: 2, color: '#f3ecd8' };

/** Diện tích một tế bào nằm trên mặt thạch (µm²) – trực khuẩn 2 × 1 µm. */
export const CELL_AREA_UM2 = 2;
/** Bán kính vi khuẩn lạc chuyển sang tăng tuyến tính (mm). */
export const LINEAR_FROM = 0.05;
/** Cỡ nhìn thấy bằng mắt thường (bán kính, mm). */
export const VISIBLE_R = 0.1;

/** µ(T) theo CTMI (h⁻¹); 0 ngoài khoảng (Tmin, Tmax). */
export function growthRate(s: Strain, T: number): number {
  const { tMin: a, tOpt: o, tMax: b } = s;
  if (T <= a || T >= b) return 0;
  const num = (T - b) * (T - a) ** 2;
  const den = (o - a) * ((o - a) * (T - o) - (o - b) * (o + a - 2 * T));
  return Math.max(0, (s.muOpt * num) / den);
}

/** Thời gian thế hệ (phút) ở T; Infinity khi không mọc. */
export function generationMin(s: Strain, T: number): number {
  const mu = growthRate(s, T);
  return mu > 0 ? (60 * Math.LN2) / mu : Infinity;
}

/**
 * "Tuổi sinh lí" tích luỹ được cập nhật theo bước: mỗi giờ ở T cộng µ(T)/µopt giờ-chuẩn.
 * Tiềm phát cũng tính theo giờ-chuẩn (λ ở Topt) nên lạnh thì cả tiềm phát lẫn mọc đều chậm.
 */
export function advanceAge(age: number, s: Strain, T: number, hours: number): number {
  return age + (hours * growthRate(s, T)) / s.muOpt;
}

/** Số tế bào của một vi khuẩn lạc sinh ra từ 1 tế bào sau `age` giờ-chuẩn (lag riêng cộng thêm `lagJitter`). */
export function cellsAt(s: Strain, age: number, lagJitter = 0): number {
  const t = age - s.lag - lagJitter;
  return t <= 0 ? 1 : Math.exp(s.muOpt * t);
}

/** Bán kính khuẩn lạc (mm) sau `age` giờ-chuẩn: √(N·a/π) tới LINEAR_FROM, rồi + Kr·t, chặn rMax. */
export function colonyRadius(s: Strain, age: number, lagJitter = 0): number {
  const n = cellsAt(s, age, lagJitter);
  const r = Math.sqrt((n * CELL_AREA_UM2) / Math.PI) / 1000;
  if (r <= LINEAR_FROM) return r;
  // Thời điểm vi khuẩn lạc đạt LINEAR_FROM (pha mũ), sau đó tuyến tính.
  const nLin = (Math.PI * (LINEAR_FROM * 1000) ** 2) / CELL_AREA_UM2;
  const tLin = s.lag + lagJitter + Math.log(nLin) / s.muOpt;
  return Math.min(s.rMax, LINEAR_FROM + s.kr * (age - tLin));
}

/**
 * Số tế bào trong khuẩn lạc: pha mũ khi còn một lớp; khi bán kính tăng tuyến tính thì khuẩn lạc dày dần
 * (cao h ≈ 1 µm + 0,2·(r − 50 µm)), N = π r² h / 2 µm³ → ≈ 10⁸–10⁹ tế bào khi Ø 2–3 mm.
 */
export function colonyCells(s: Strain, age: number, lagJitter = 0): number {
  const n = cellsAt(s, age, lagJitter);
  const r = colonyRadius(s, age, lagJitter) * 1000;
  if (r <= LINEAR_FROM * 1000) return n;
  const h = 1 + 0.2 * (r - LINEAR_FROM * 1000);
  return (Math.PI * r * r * h) / CELL_AREA_UM2;
}

/** Mật độ phủ (0…1) của thảm vi khuẩn mọc từ `density` tế bào/mm² sau `age` giờ-chuẩn. */
export function lawnCover(s: Strain, age: number, density: number): number {
  if (density <= 0) return 0;
  const r = colonyRadius(s, age);
  return 1 - Math.exp(-density * Math.PI * r * r);
}
