import type * as THREE from 'three';
import type { Toast } from './tooltip';
import type { PointerHit, PointerInfo, PointerTarget } from './types';

/** Khung phụ: ô lồng có camera riêng (vd. "Ở nơi quan sát") – target có `frame: name` raycast theo camera + phần tử này. */
export interface PointerFrame {
  element: HTMLElement;
  camera: THREE.Camera;
}

export interface PointerHub {
  /** Đăng kí vật nhận tương tác; trả hàm gỡ. */
  add(t: PointerTarget): () => void;
  /** Bật/tắt mọi target thuộc nhóm. */
  setLayer(name: string, on: boolean): void;
  /** Thêm khung phụ `name` (target `frame: name`); trả hàm gỡ. */
  addFrame(name: string, f: PointerFrame): () => void;
  /** Tắt toàn bộ (vd. khi đang chạy demo). */
  enabled: boolean;
  /** Đang có phiên kéo. */
  readonly active: boolean;
  readonly hovered: PointerTarget | null;
  /** Không kéo, không hoạt cảnh nào của kit đang chạy (`busy`) – cho Playwright (`__ix.idle()`). */
  readonly idle: boolean;
  /** Dựng PointerInfo tại toạ độ khung (px) – cho demo/test hoặc raycast tự do. */
  info(x: number, y: number): PointerInfo;
  /** Target trúng tại toạ độ khung (px) – kiểm tra/gỡ lỗi. */
  pickAt(x: number, y: number): PointerHit | null;
  /** Gọi mỗi frame theo thời gian THỰC (kể cả khi sim tạm dừng); trả hàm gỡ. */
  onFrame(cb: (dt: number) => void): () => void;
  /** Hoạt cảnh thời gian thực: `step(k)` (k = 0…1 làm mượt hai đầu) trong `seconds` giây rồi `done()`; trả hàm huỷ (không gọi done). */
  tween(seconds: number, step: (k: number) => void, done?: () => void): () => void;
  /** Đăng kí "đang bận" (hoạt cảnh, demo…) cho `idle`; trả hàm gỡ. */
  busy(fn: () => boolean): () => void;
  /** Đặt chỗ hiện toast (px khung chính) – vd. đang kéo thẻ HTML. */
  anchor(x: number, y: number): void;
  /** Thông báo nhanh cạnh chỗ thao tác cuối (sai thao tác, xong bước). */
  toast: Toast;
}
