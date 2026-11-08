import type { Psi } from './hydrogen';

/**
 * Hệ trục hiển thị (thuần). three dùng Y hướng lên; sách vẽ z hướng lên, x sang phải, y chéo về phía người xem
 * (Hình 3.3). Quy ước "book": cảnh (X, Y, Z) ↔ hoá học (x = X, y = Z, z = Y).
 */
export type Vec3 = [number, number, number];

export interface AxisFrame {
  /** Toạ độ hoá học → toạ độ cảnh. */
  toScene(c: Vec3): Vec3;
  /** Toạ độ cảnh → toạ độ hoá học. */
  toChem(s: Vec3): Vec3;
}

export const BOOK_FRAME: AxisFrame = {
  toScene: ([x, y, z]) => [x, z, y],
  toChem: ([X, Y, Z]) => [X, Z, Y],
};

/** Hệ thuận chuẩn của three (x, y, z trùng X, Y, Z). */
export const IDENTITY_FRAME: AxisFrame = {
  toScene: (c) => [c[0], c[1], c[2]],
  toChem: (s) => [s[0], s[1], s[2]],
};

/** Bọc ψ(hoá học) thành hàm theo toạ độ cảnh, có hệ số tỉ lệ (đv cảnh → a₀: chia `unitsPerA0`). */
export function psiInScene(psi: Psi, frame: AxisFrame = BOOK_FRAME, unitsPerA0 = 1): Psi {
  const s = 1 / unitsPerA0;
  return (X, Y, Z) => {
    const [x, y, z] = frame.toChem([X * s, Y * s, Z * s]);
    return psi(x, y, z);
  };
}

/** Hướng trục hoá học (đơn vị) trong cảnh. */
export function axisDir(frame: AxisFrame, axis: 'x' | 'y' | 'z'): Vec3 {
  return frame.toScene(axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]);
}
