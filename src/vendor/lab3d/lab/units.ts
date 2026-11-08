/**
 * Thang đo dùng chung cho kit phòng thí nghiệm: **1 đơn vị cảnh = 1 dm = 10 cm**.
 * Mặt bàn ở y = 0 (xem room/stage.ts). 1 mL = 1 cm³ = 0,001 đơn vị³.
 */
export const UNIT_MM = 100;

/** mm → đơn vị cảnh. */
export const mm = (v: number): number => v / UNIT_MM;
/** cm → đơn vị cảnh. */
export const cm = (v: number): number => v / 10;
/** Thể tích (đơn vị³) → mL. */
export const toML = (v: number): number => v * 1000;
/** mL → thể tích (đơn vị³). */
export const fromML = (ml: number): number => ml / 1000;
