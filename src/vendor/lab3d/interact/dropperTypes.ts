import type * as THREE from 'three';
import type { PointerTarget, StartVerdict } from './types';

export interface DropperSpot {
  id: string;
  /** Tâm miệng (hệ `parent`). */
  mouth: THREE.Vector3;
  /** Bán kính bắt (hệ parent) – đo thẳng trên miệng hoặc theo tia nhìn. */
  radius: number;
  /** true | chuỗi lí do sai (toast). */
  accepts?(): boolean | string;
}
export interface DropperSource extends DropperSpot {
  /** Độ sâu nhúng dưới miệng khi hút (mặc định 0,4). */
  dip?: number;
  color?: THREE.ColorRepresentation;
}
export interface DropperTarget extends DropperSpot {
  /** Mặt thoáng nơi giọt chạm (hệ `parent`). */
  surfaceY: number | (() => number);
  /** Số giọt tối đa nhỏ vào đích này (kể cả giọt đang rơi, cả demo) – đủ thì thôi nhỏ; bấm thêm → toast `fullReason`. */
  maxDrops?: number | (() => number);
  fullReason?: string;
  onDrop?(i: number, hit: THREE.Vector3): void;
}

export interface DropperGestureOptions {
  /** Ống hút (gốc ở đầu nhọn, +y lên – createDropper), con của `parent`. */
  tool: THREE.Object3D;
  /** Vùng bắt (mặc định `tool`) – vd. addPickProxy quanh quả bóp. */
  handle?: THREE.Object3D;
  bulb?: THREE.Object3D;
  parent: THREE.Object3D;
  /** Chỗ nghỉ đầu nhọn (hệ parent). */
  rest: THREE.Vector3;
  /** Độ cao mang ngang (hệ parent). */
  carryY: number;
  sources: DropperSource[];
  targets: DropperTarget[];
  /** Số giọt tối đa ống hút chứa (mặc định 20); tốc độ hút (giọt/s, mặc định 14); giây giữa hai giọt khi giữ (0,35). */
  capacity?: number;
  drawRate?: number;
  interval?: number;
  /** Đầu nhọn cách miệng ống nhận khi nhỏ (mặc định 0,15). */
  above?: number;
  /** Ưu tiên bắt con trỏ (thìa/dụng cụ khác nằm trước ống hút). */
  priority?: number;
  /** Giữ khoảng lệch lúc nắm suốt khi kéo (mặc định false: lệch tan dần khi kéo đi – đầu nhọn về ngay dưới con trỏ). */
  keepOffset?: boolean;
  /**
   * Chọn chỗ dưới đầu nhọn khi lọ nguồn và đích cùng "ở dưới" (che nhau theo tia nhìn, hoặc ống vừa là nguồn vừa là đích):
   * 'source' (mặc định) = nguồn trước; 'nearest' = bỏ nguồn đang `accepts() === false`, chỗ gần đầu nhọn nhất thắng (hoà → nguồn).
   */
  pick?: 'source' | 'nearest';
  /**
   * Quãng kéo (thế giới, trên mặt mang ngang) để khoảng lệch lúc nắm tan hết (mặc định 0,45). Nhỏ hơn khi lọ nguồn thấp hơn nhiều so
   * với `carryY` (nắm ống hút trong lọ → lệch lớn theo tia nhìn; tan chậm thì tới ống nhận đầu nhọn vẫn còn lệch, không nhỏ được).
   */
  lead?: number;
  /** Nhả trên lọ/ống: đậu lại đó (mặc định true – bấm = nhỏ thêm giọt); false = luôn về chỗ nghỉ khi nhả. */
  park?: boolean;
  hint?: PointerTarget['hint'];
  /**
   * Toast khi định nhỏ mà ống hút còn rỗng – câu theo nguồn thật của sim (vd. "Hút dịch khuẩn ở ống 10⁻³ trước"); hàm = theo bước.
   * Mặc định câu chung "Ống hút chưa có dung dịch – nhúng vào lọ và giữ chuột để hút."
   */
  emptyReason?: string | (() => string);
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, nhấn chỉ báo lí do, camera không xoay); null = không. */
  blocked?(): string | null | undefined;
  /** Nhấn vào ống hút: false = không bắt; `'block'` / lí do = giữ phiên (camera không xoay) + toast. */
  onStart?(): StartVerdict;
  onLoad?(drops: number, sourceId: string | null): void;
}

export interface DropperGesture {
  /** Số giọt đang chứa. */
  readonly loaded: number;
  readonly busy: boolean;
  readonly dragging: boolean;
  /** Giọt đã nhỏ vào đích `id` (kể cả đang rơi). */
  given(id: string): number;
  /**
   * Demo: hoạt cảnh ống hút chuẩn (createDripAction) – hút ở `from`, nhỏ `drops` giọt vào `to`. `o.dip` = nhúng sâu bằng `dip` của nguồn
   * (mặc định 0,5 của createDripAction – giữ như cũ); `o.interval` = giây giữa hai giọt.
   */
  auto(from: string | null, to: string, drops: number, onDone?: () => void, o?: { dip?: boolean; interval?: number }): void;
  /** Dừng hoạt cảnh/giọt, ống hút về chỗ nghỉ (còn giữ dung dịch). */
  cancel(): void;
  /** Bỏ phần dung dịch còn trong ống hút. */
  unload(): void;
  /** Làm lại từ đầu: về chỗ, rỗng, xoá đếm giọt các đích. */
  reset(): void;
}
