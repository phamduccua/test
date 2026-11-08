/** Độ dẫn điện riêng κ (S/m) của các mẫu thường gặp (thuần, số liệu gần đúng ở ~25 °C). */

export const NACL_MOLAR_MASS = 58.44;
/** Độ dẫn điện mol giới hạn của NaCl (S·m²/mol) = 126,45 S·cm²/mol. */
export const NACL_LAMBDA0 = 126.45e-4;

/** g NaCl hoà trong 100 mL nước → nồng độ mol (mol/L); thể tích dung dịch tăng ~0,35 mL/g. */
export function gPer100mLToMolar(g: number): number {
  if (g <= 0) return 0;
  return g / NACL_MOLAR_MASS / ((100 + 0.35 * g) / 1000);
}

/**
 * κ của dung dịch NaCl (S/m) theo nồng độ mol: Λ = Λ₀ / (1 + 0,75√c) (khớp ~0,1 M: 10,7 mS/cm; bão hoà ~5,4 M: ~25 S/m).
 * Cộng thêm nền nước cất.
 */
export function naclAqConductivity(molar: number): number {
  const c = Math.max(0, molar);
  const lam = NACL_LAMBDA0 / (1 + 0.75 * Math.sqrt(c));
  return c * 1000 * lam + KAPPA.distilledWater;
}

/** κ tham khảo (S/m). */
export const KAPPA = {
  /** Nước cất để lâu ngoài không khí (CO₂ hoà tan): ~5 µS/cm. */
  distilledWater: 5e-4,
  /** Nước máy. */
  tapWater: 0.05,
  /** Dung dịch saccharose pha bằng nước cất – phân tử trung hoà, không phân li. */
  sugarSolution: 8e-4,
  /** NaCl rắn khan ở nhiệt độ phòng – ion bị giữ ở nút mạng. */
  solidNaCl: 1e-10,
  /** NaCl nóng chảy (~850 °C): ~3,6 S/cm. */
  moltenNaCl: 360,
  /** Đồng kim loại (để so sánh). */
  copper: 5.96e7,
} as const;
