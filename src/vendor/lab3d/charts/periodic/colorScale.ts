/** Thang màu (thuần): nội suy tuyến tính trong không gian sRGB giữa các mốc màu 0xRRGGBB. */

/** Lạnh → nóng, đủ sáng trên nền tối (xanh lam → ngọc → vàng → cam → đỏ san hô). */
export const SCALE_COOL_WARM: readonly number[] = [0x3b6fe0, 0x2fb5c9, 0xe8d25a, 0xf08a3c, 0xe2465a];

/** Màu theo sách (Hình 6.2): xanh lam / đỏ. */
export const BOOK_COLORS: Record<string, number> = { blue: 0x1c78d6, red: 0xe0303f };

const ch = (c: number, s: number) => (c >> s) & 0xff;

export function lerpColor(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  let out = 0;
  for (const s of [16, 8, 0]) out |= Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k) << s;
  return out;
}

/** Màu tại t ∈ [0, 1] trên dãy mốc. */
export function sampleStops(stops: readonly number[], t: number): number {
  if (stops.length === 1) return stops[0];
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return lerpColor(stops[i], stops[i + 1], x - i);
}

/** Màu cho giá trị v trong [min, max]. */
export function valueColor(v: number, min: number, max: number, stops: readonly number[] = SCALE_COOL_WARM): number {
  return sampleStops(stops, max > min ? (v - min) / (max - min) : 0.5);
}

/** Dải CSS linear-gradient để vẽ chú giải. */
export function cssGradient(stops: readonly number[] = SCALE_COOL_WARM): string {
  const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
  return `linear-gradient(90deg, ${stops.map(hex).join(', ')})`;
}
