import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';
import { createDripAction } from './dripInto';
import { labText } from '../../text';

/**
 * LỚP TƯƠNG THÍCH (TN-115-04). Helper chuẩn là `createDripAction` (dripInto.ts) – dùng nó cho sim mới.
 * Một lượt nhỏ giọt vào một dụng cụ. Toạ độ theo hệ của `dropper.parent`.
 */
export interface DropJob {
  /** Vị trí đầu nhọn ống hút khi nhỏ (thường ở trên miệng dụng cụ ~1–2 cm). */
  at: THREE.Vector3;
  /** Độ cao mặt chất lỏng (giọt chạm thì gọi onDrop). Có thể là hàm (mực thay đổi). */
  surfaceY: number | (() => number);
  count: number;
  /** Giây giữa hai giọt (mặc định 0,7). */
  interval?: number;
  /** Mỗi giọt chạm mặt thoáng. `i` = số thứ tự giọt (0…), `hit` = điểm chạm. */
  onDrop?(i: number, hit: THREE.Vector3): void;
  onDone?(): void;
  /** Khi ống hút đã tới vị trí, bắt đầu nhỏ. */
  onArrive?(): void;
}

export interface DropperActionOptions {
  /** Ống hút (gốc ở đầu nhọn, dọc +y) – vd. `createDropper()`; PHẢI đã có parent. */
  dropper: THREE.Object3D;
  /** Quả bóp (co lại khi bóp). Mặc định: Mesh con cuối cùng của dropper. */
  bulb?: THREE.Object3D;
  /** Vị trí nghỉ của đầu nhọn. */
  home: THREE.Vector3;
  /** Độ cao an toàn khi di chuyển ngang (mặc định = home.y + 1,5 dm). */
  liftY?: number;
  /** Tốc độ di chuyển (đv/s, mặc định 2,2). */
  speed?: number;
  /** Gia tốc rơi của giọt (đv/s², mặc định 30). */
  gravity?: number;
  dropRadius?: number;
  dropColor?: THREE.ColorRepresentation;
}

export interface DropperAction {
  readonly busy: boolean;
  /** Xếp hàng một lượt nhỏ giọt (chạy lần lượt). */
  queue(job: DropJob): void;
  /** Huỷ mọi lượt, đưa ống hút về chỗ nghỉ ngay. */
  cancel(): void;
  update(dt: number): void;
}

/** Ống hút nhỏ giọt không hút từ lọ nguồn (bọc `createDripAction` với `hang`, `speed`, `travelY`). */
export function createDropperAction(ctx: Tracker, o: DropperActionOptions): DropperAction {
  const parent = o.dropper.parent;
  if (!parent) throw new Error(labText('t_8f890063aa6c'));
  const bulb = o.bulb ?? [...o.dropper.children].reverse().find((c) => (c as THREE.Mesh).isMesh);
  const drip = createDripAction(ctx, {
    tool: o.dropper,
    parent,
    rest: o.home,
    bulb,
    dropRadius: o.dropRadius ?? mm(1.6),
    lift: 0,
    travelY: o.liftY ?? o.home.y + 1.5,
    speed: o.speed ?? 2.2,
    gravity: o.gravity ?? 30,
    hang: true,
    dropColor: o.dropColor ?? 0xe6eef6,
  });
  return {
    get busy() {
      return drip.busy;
    },
    queue: (j) =>
      drip.run({ to: j.at, drops: j.count, interval: j.interval ?? 0.7, surfaceY: j.surfaceY, onDrop: j.onDrop, onDone: j.onDone, onArrive: j.onArrive }),
    cancel: () => drip.cancel(),
    update: (dt) => drip.update(dt),
  };
}
