import type { SimContext } from '../sim/types';

/** Chỉ cần `track` để đăng ký dispose – kit dùng được cả ngoài mô phỏng. */
export type Tracker = Pick<SimContext, 'track'>;

/** Điểm profile 2D (r = bán kính, y = độ cao) dùng cho LatheGeometry. */
export interface P2 {
  r: number;
  y: number;
}

/** Đối tượng có cập nhật theo thời gian (bọt, hạt, lửa…). */
export interface Updatable {
  update(dt: number, elapsed?: number): void;
}
