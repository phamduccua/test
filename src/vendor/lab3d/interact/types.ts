import type * as THREE from 'three';
import type { SimContext } from '../sim/types';

/** Phần SimContext kit tương tác cần (sim nào cũng có). */
export type InteractCtx = Pick<SimContext, 'scene' | 'camera' | 'renderer' | 'controls' | 'overlay' | 'track' | 'viewInsets'>;

/** Trạng thái con trỏ tại một sự kiện (toạ độ khung canvas, NDC, tia thế giới). */
export interface PointerInfo {
  /** px trong khung canvas. */
  x: number;
  y: number;
  ndc: THREE.Vector2;
  ray: THREE.Ray;
  /** Dời (px) từ sự kiện trước / từ lúc nhấn. */
  dx: number;
  dy: number;
  totalX: number;
  totalY: number;
  pointerType: string;
  /** Sự kiện gốc (null khi dựng tổng hợp cho demo/test). */
  event: PointerEvent | null;
}

export interface PointerHit {
  target: PointerTarget;
  /** Mesh trúng tia (con cháu của target.object). */
  object: THREE.Object3D;
  point: THREE.Vector3;
  distance: number;
  /** Chỉ số instance khi trúng InstancedMesh (ion, phân tử…). */
  instanceId?: number;
}

/** Phiên kéo do target trả về từ onDown – nhận move/end tới khi nhả; OrbitControls tắt trong suốt phiên. */
export interface PointerSession {
  /** Con trỏ khi đang kéo (mặc định 'grabbing'). */
  cursor?: string;
  move?(p: PointerInfo): void;
  end?(p: PointerInfo, cancelled: boolean): void;
}

/** Từ chối giữ phiên: `'block'` (im lặng) hoặc lí do (toast đỏ). */
export type Refusal = 'block' | (string & {});

/** Kết quả `onStart` / `onPick`: true/void = cho kéo; false = không bắt (camera xoay như thường); `'block'` / lí do = giữ phiên, vật đứng yên. */
export type StartVerdict = boolean | void | Refusal;

/** 'off' | 'hover' (rê chuột lên) | 'drag' (đang kéo). */
export type HoverState = 'off' | 'hover' | 'drag';

/** Một vật nhận tương tác (raycast cả con cháu). */
export interface PointerTarget {
  object: THREE.Object3D;
  /** Ưu tiên khi nhiều vật trúng tia (lớn thắng, rồi gần hơn thắng). Mặc định 0. */
  priority?: number;
  /** Nhóm để bật/tắt hàng loạt (`hub.setLayer`). */
  layer?: string;
  /** Con trỏ khi rê lên (mặc định 'grab' nếu có onDown, 'pointer' nếu chỉ onTap). */
  cursor?: string;
  /** Tooltip nhỏ cạnh con trỏ ("Kéo để …"); hàm → đổi theo trạng thái, null = không hiện. */
  hint?: string | (() => string | null);
  enabled?(): boolean;
  /**
   * Đang bị chặn (sai bước, vật đang bị giữ chỗ…): trả lí do → rê lên thấy con trỏ cấm + lí do, nhấn/kéo chỉ hiện toast lí do,
   * GIỮ phiên con trỏ (camera không xoay), không gọi onDown. null = không chặn. Chỉ xét khi target đang bật.
   */
  blocked?(): string | null | undefined;
  onHover?(state: HoverState, hit: PointerHit | null): void;
  /**
   * Đang TẮT vẫn che tia: trúng vật này (gadget đặt trong một vật nhận tương tác khác – vạch đo trong biểu đồ bấm được) thì vật cha
   * KHÔNG nhận hộ. Mặc định false – hai cử chỉ trên cùng một vật (cầm ↔ nghiêng rót lồng nhau) vẫn chia vùng bắt.
   */
  opaque?: boolean;
  /** Khung phụ (ô lồng có camera riêng, `hub.addFrame`) – mặc định khung chính. */
  frame?: string;
  /**
   * Nhấn trúng: trả phiên kéo để bắt con trỏ; void → không bắt (camera vẫn xoay); false → bỏ qua cả tap;
   * `'block'` / chuỗi lí do → TỪ CHỐI nhưng vẫn GIỮ phiên con trỏ (camera không xoay, con trỏ cấm), chuỗi hiện toast lí do.
   */
  onDown?(hit: PointerHit, p: PointerInfo): PointerSession | void | false | Refusal;
  /** Bấm nhanh không kéo (≤ 6 px). */
  onTap?(hit: PointerHit, p: PointerInfo): void;
}

/** Tư thế một vật trong hệ toạ độ cha của nó. */
export interface Pose {
  pos: THREE.Vector3;
  rot: THREE.Euler | THREE.Quaternion;
}

/** Ràng buộc kéo: tia con trỏ → điểm thế giới (false = không có điểm hợp lệ, giữ chỗ cũ). */
export interface Constraint {
  project(ray: THREE.Ray, out: THREE.Vector3): boolean;
}

/** Liên kết hai chiều với một tham số (thường là lil-gui): đọc, đặt (khi kéo), chốt (khi nhả). */
export interface Binding<T = number> {
  get(): T;
  set(v: T): void;
  commit?(v: T): void;
}
