/** Mạch điện nối tiếp (thuần, không three): định luật Ohm, điện trở cặp điện cực, độ sáng bóng đèn. */

export interface SeriesCircuit {
  /** Suất điện động nguồn (V). */
  emf: number;
  /** Điện trở trong của nguồn (Ω). */
  rInternal?: number;
  /** Điện trở các phần tử nối tiếp (Ω); Infinity = hở mạch. */
  loads: number[];
  /** Suất phản điện (V): điện áp phân cực/phân huỷ ở điện cực khi điện phân. */
  backEmf?: number;
  /** Độ mềm (V) của ngưỡng backEmf – tránh gãy khúc. 0 = ngưỡng cứng. */
  soft?: number;
}

/** I = (E − E_phản)/(r + ΣR) (A); không âm, mềm quanh ngưỡng. */
export function seriesCurrent(c: SeriesCircuit): number {
  const r = (c.rInternal ?? 0) + c.loads.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(r) || r <= 0) return 0;
  const x = c.emf - (c.backEmf ?? 0);
  const s = c.soft ?? 0.05;
  const drive = s > 0 ? s * Math.log1p(Math.exp(Math.min(60, x / s))) : Math.max(0, x);
  return drive / r;
}

/**
 * Điện trở giữa hai điện cực trụ song song nhúng trong dung dịch (Ω):
 * R = arccosh(d / 2a) / (π κ L) — d: khoảng cách tâm (m), a: bán kính (m), L: chiều dài ngập (m), κ (S/m).
 */
export function rodPairResistance(kappa: number, gap: number, radius: number, depth: number): number {
  if (kappa <= 0 || depth <= 0) return Infinity;
  const k = Math.max(1.0001, gap / (2 * radius));
  return Math.acosh(k) / (Math.PI * kappa * depth);
}

export interface BulbSpec {
  /** Điện áp định mức (V). */
  ratedV: number;
  /** Dòng định mức (A). */
  ratedI: number;
}

/** Bóng đèn pin nhỏ 2,5 V – 0,3 A. */
export const FLASHLIGHT_BULB: BulbSpec = { ratedV: 2.5, ratedI: 0.3 };

export const bulbResistance = (b: BulbSpec): number => b.ratedV / b.ratedI;

/** Độ sáng cảm nhận 0…1 theo dòng: ∝ (P/P định mức)^0,6; dưới ~6% dòng định mức dây tóc không đỏ. */
export function bulbGlow(current: number, b: BulbSpec): number {
  const x = current / b.ratedI;
  if (x <= 0.06) return 0;
  const p = Math.min(1.6, x * x);
  const g = Math.pow(p, 0.6);
  const onset = Math.min(1, (x - 0.06) / 0.08);
  return Math.min(1, g * onset);
}

/** Nhiệt độ màu dây tóc (K) theo độ sáng: đỏ thẫm ~1000 K → trắng ấm ~2800 K. */
export function filamentKelvin(glow: number): number {
  return 1000 + 1800 * Math.sqrt(Math.max(0, Math.min(1, glow)));
}
