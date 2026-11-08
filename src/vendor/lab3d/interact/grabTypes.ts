import type * as THREE from 'three';
import type { DraggableOptions } from './drag';
import type { DropZone, DropZones } from './dropZones';
import type { Pose, StartVerdict } from './types';

export interface GrabOptions {
  /** Dụng cụ (ống nghiệm, lọ, thìa, panh, đinh…); tư thế theo hệ cha. */
  object: THREE.Object3D;
  /** Tên vật cho `zones.accepts(item)`. */
  item: string;
  zones?: DropZones;
  handle?: THREE.Object3D;
  /** Điểm dò vùng thả + điểm con trỏ dẫn (toạ độ cục bộ của vật – mũi đinh, miệng ống). Mặc định gốc. */
  probe?: THREE.Vector3;
  /** Nhấc tối thiểu khỏi chỗ nhặt khi cầm (đơn vị cảnh, mặc định 0,3) – không kéo xuyên mặt bàn. */
  lift?: number;
  /** Độ cao (thế giới) khi tự mang (demo / về chỗ / tới vùng) – mặc định cao nhất của đầu–cuối + lift. */
  travelY?: number;
  /** Tư thế xoay khi cầm (hệ cha, vd. dựng đứng); null = giữ hướng lúc nhặt. */
  heldRot?: THREE.Euler | THREE.Quaternion | null;
  /** Thả ngoài mọi vùng: đặt xuống mặt bàn tại chỗ thả (giữ độ cao/hướng chỗ nghỉ) = true; false = về chỗ nghỉ. */
  placeOnFloor?: boolean;
  /** Giới hạn (thế giới) khi mang; vật cản xz (nới `radius`); chỗ nghỉ (mặc định tư thế lúc tạo). */
  bounds?: THREE.Box3;
  colliders?: THREE.Box3[];
  radius?: number;
  home?: Pose;
  priority?: number;
  layer?: string;
  hint?: DraggableOptions['hint'];
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, nhấn chỉ báo lí do, camera không xoay); null = không. */
  blocked?(): string | null | undefined;
  /** Nhặt lên: false = không bắt (camera xoay như thường); `'block'` / lí do = không cho nhưng GIỮ phiên con trỏ (camera không xoay) + toast lí do. */
  onPick?(): StartVerdict;
  onMove?(probe: THREE.Vector3, zone: DropZone | null): void;
  /** Đã đặt xong (sau hoạt cảnh hạ xuống): vùng hợp lệ hoặc null (bàn/chỗ nghỉ). */
  onPlace?(zone: DropZone | null): void;
}

export type GrabState = 'rest' | 'held' | 'moving';

export interface Grabbable {
  readonly state: GrabState;
  /** Vùng đang đặt vào (id) – null = trên bàn/chỗ nghỉ. */
  readonly zone: string | null;
  /** Demo: nhấc → mang tới vùng `id` → hạ theo `snap` → thả (cùng luồng kiểm tra/onDrop/onPlace như tay); `onDone(ok)` – ok = đã vào vùng. */
  carryTo(id: string, onDone?: (ok: boolean) => void): void;
  /** Mang về chỗ nghỉ (hoặc tư thế `pose`). */
  returnHome(onDone?: () => void, pose?: Pose): void;
  setHome(p: Pose): void;
  /** Đặt ngay (không hoạt cảnh); `zone` = vùng đang nằm trong (để rút ra đúng trục). */
  reset(p?: Pose, zone?: string | null): void;
}
