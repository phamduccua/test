import type * as THREE from 'three';

/** Kiểu của ống hút nhỏ giọt chuẩn `createDripAction` (dripInto.ts). */
export interface DripTask {
  /** Miệng lọ nguồn (toạ độ của `parent`) – ống hút nhúng xuống đây để hút. Bỏ qua = không hút, bay thẳng tới `to`. */
  from?: THREE.Vector3;
  /** Điểm đầu ống hút lơ lửng phía trên miệng dụng cụ nhận (toạ độ của `parent`). */
  to: THREE.Vector3;
  drops: number;
  /** Giây giữa hai giọt (mặc định 0,35). */
  interval?: number;
  /** Độ cao mặt thoáng (toạ độ `parent`) nơi giọt chạm và biến mất – số hoặc hàm (mực thay đổi). */
  surfaceY: number | (() => number);
  color?: THREE.ColorRepresentation;
  /** Độ sâu nhúng vào lọ nguồn (mặc định 0,5). */
  dip?: number;
  /** Ống hút vừa tới trên dụng cụ nhận, bắt đầu nhỏ. */
  onArrive?(): void;
  /** Mỗi giọt chạm mặt thoáng: `i` = thứ tự giọt, `hit` = điểm chạm (toạ độ `parent`). */
  onDrop?(i: number, hit: THREE.Vector3): void;
  onDone?(): void;
}

export interface DripActionOptions {
  /** Ống hút: gốc ở đầu nhọn, trục +y (vd. createDropper). Được thêm vào `parent`. */
  tool: THREE.Object3D;
  parent: THREE.Object3D;
  /** Chỗ nghỉ của đầu nhọn (toạ độ `parent`). */
  rest: THREE.Vector3;
  /** Quả bóp (nên là pivot ở cổ) – bóp co theo y. */
  bulb?: THREE.Object3D;
  dropRadius?: number;
  /** Nhấc cao thêm so với điểm cao nhất của lộ trình (mặc định 0,9). */
  lift?: number;
  /** Độ cao tối thiểu khi di ngang (toạ độ `parent`). */
  travelY?: number;
  /** Tốc độ di chuyển (đv/s); bỏ qua = thời lượng cố định mỗi chặng. */
  speed?: number;
  /** Hệ số thời lượng các chặng cố định (bay, hút, bóp): 0,5 = nhanh gấp đôi – sim nhiều ống. Mặc định 1. */
  pace?: number;
  /** Gia tốc rơi của giọt (đv/s², mặc định 34,3 – chậm hơn thực để dễ nhìn). */
  gravity?: number;
  /** Giọt phồng dần ở đầu nhọn trước khi rơi (mặc định false). */
  hang?: boolean;
  dropColor?: THREE.ColorRepresentation;
}

export interface DripAction {
  readonly busy: boolean;
  /** Xếp hàng một lượt (hút –) nhỏ giọt. */
  run(task: DripTask): void;
  /** Huỷ mọi lượt, đưa ống hút về chỗ nghỉ, xoá giọt đang rơi. */
  cancel(): void;
  update(dt: number): void;
}
