import type * as THREE from 'three';
import type { DropResult, DropZones } from './dropZones';
import type { HtmlTargetOptions } from './cardTarget';
import type { Constraint } from './types';

export interface CardDropOptions {
  /** Phần tử chứa các thẻ (bắt sự kiện kiểu uỷ quyền – thẻ có thể dựng lại bằng innerHTML). */
  root: HTMLElement;
  /** Bộ chọn CSS của thẻ kéo được (vd. '[data-card]'). */
  selector: string;
  /** Mã vật của thẻ (truyền cho DropZone.accepts / onDrop). */
  item(el: HTMLElement): string;
  /** Phần tử con của thẻ KHÔNG bắt đầu kéo (vd. 'button' – nút ⋯ / × trên thẻ vẫn bấm được). Mặc định: không có. */
  ignore?: string;
  /** Vùng 3D + tia con trỏ → điểm trên bề mặt cảnh (sphereConstraint địa cầu, mặt phẳng mặt cắt…). Bỏ cả hai = chỉ đích HTML (`html`). */
  zones?: DropZones;
  surface?: Constraint;
  /** Tự cuộn khung chứa đích HTML khi kéo gần mép trên/dưới (mặc định true). */
  autoScroll?: boolean;
  enabled?(): boolean;
  /** Mỗi lần con trỏ di chuyển khi đang kéo (world = null khi ra ngoài bề mặt). */
  onMove?(item: string, world: THREE.Vector3 | null): void;
  /** Nhả thẻ: kết quả vùng (null = thả ngoài mọi vùng; vùng đúng đã gọi onDrop, sai đã toast lí do). */
  onDrop?(item: string, result: DropResult | null): void;
  /** Đích HTML (tuỳ chọn): phần tử khớp `selector` dưới con trỏ nhận thẻ thay cho cảnh 3D (cardTarget.ts). */
  html?: HtmlTargetOptions;
}

export interface CardDrop {
  readonly dragging: string | null;
  /** Demo: thẻ `item` bay tới vùng `zoneId` rồi thả bằng CÙNG luồng `zones.dropInto` → onDrop. */
  carryTo(item: string, zoneId: string, done?: () => void): void;
  /** Demo cho đích HTML: thẻ bay tới phần tử `target` rồi thả bằng cùng luồng `html.accepts` → `html.onDrop`. */
  carryToEl(item: string, target: HTMLElement, done?: () => void): void;
}
