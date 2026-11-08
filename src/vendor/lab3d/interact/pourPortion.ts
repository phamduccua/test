/**
 * Lượng rót theo PHẦN cho `createCarryPour` (chai/ống đong lớn rót mỗi lượt một lượng định trước – 5 mL cồn, 20 mL nước muối…):
 * `left()` = phần còn phải rót lượt này (0 → dụng cụ dựng lại, về chỗ), `take(ml)` = vừa chảy ra `ml` (cập nhật mức trong chai, đích…).
 */
export function pourPortion(left: () => number, take: (ml: number) => void): { readonly volumeML: number; setVolume(v: number): void } {
  return {
    get volumeML() {
      return Math.max(0, left());
    },
    setVolume(v: number) {
      const d = Math.max(0, left()) - v;
      if (d > 1e-9) take(d);
    },
  };
}
