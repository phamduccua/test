/**
 * Toán thuần của kit tương tác (không import three) – kẹp, làm tròn theo bước, giảm chấn, góc, lưu lượng rót.
 * Dùng được trong `model.ts` của sim và test node.
 */
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Nghịch đảo lerp (0…1 khi v trong [a, b]; không kẹp). */
export const invLerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));

/** Làm tròn `v` về lưới bước `step` (gốc `origin`); step ≤ 0 → giữ nguyên. */
export function snapStep(v: number, step = 0, origin = 0): number {
  if (!(step > 0)) return v;
  return origin + Math.round((v - origin) / step) * step;
}

/** Ánh xạ tuyến tính kèm kẹp: v ∈ [a0, a1] → [b0, b1]. */
export function remap(v: number, a0: number, a1: number, b0: number, b1: number): number {
  return lerp(b0, b1, clamp(invLerp(a0, a1, v), 0, 1));
}

/** Giảm chấn mũ không phụ thuộc fps: tiến `cur` → `target` với hằng số λ (1/s); λ ≤ 0 → nhảy thẳng tới đích. */
export function damp(cur: number, target: number, lambda: number, dt: number): number {
  if (!(lambda > 0)) return target;
  return lerp(cur, target, 1 - Math.exp(-lambda * dt));
}

/** Hệ số nội suy cho damp vector (dùng `v.lerp(target, dampFactor(λ, dt))`). */
export const dampFactor = (lambda: number, dt: number): number => (lambda > 0 ? 1 - Math.exp(-lambda * dt) : 1);

/** Góc về (−π, π]. */
export function wrapAngle(a: number): number {
  const t = (((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return t - Math.PI === -Math.PI ? Math.PI : t - Math.PI;
}

/** Hiệu góc ngắn nhất b − a (−π, π]. */
export const angleDelta = (a: number, b: number): number => wrapAngle(b - a);

/**
 * Lưu lượng rót 0…1 theo góc nghiêng: 0 khi |góc| < `start` (mặt thoáng chưa tới miệng), tăng mượt tới 1 ở `full`.
 * `fill` (0…1, mức chất lỏng còn lại) làm góc bắt đầu chảy lớn dần khi bình vơi.
 */
export function flowFromTilt(angle: number, start: number, full: number, fill = 1): number {
  const s = start + (full - start) * 0.6 * (1 - clamp(fill, 0, 1));
  const k = clamp(invLerp(s, Math.max(full, s + 1e-3), Math.abs(angle)), 0, 1);
  return fill <= 0 ? 0 : k * k * (3 - 2 * k);
}

/** smoothstep 0…1. */
export const smooth = (t: number): number => {
  const k = clamp(t, 0, 1);
  return k * k * (3 - 2 * k);
};

/** Ease in-out bậc hai (hoạt cảnh cầm–đặt). */
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Khoảng cách px giữa hai điểm màn hình – phân biệt bấm (tap) với kéo. */
export const TAP_SLOP_PX = 6;
export const movedBeyond = (dx: number, dy: number, slop = TAP_SLOP_PX): boolean => dx * dx + dy * dy > slop * slop;
