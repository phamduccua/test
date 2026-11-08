import type * as THREE from 'three';
import type { PourStream } from '../lab/effects/pour';
import type { VesselProfile } from '../lab/glassware/profile';
import type { DropZones } from './dropZones';
import type { Grabbable } from './grabTypes';
import type { TiltPour } from './pour';
import type { StartVerdict } from './types';

export interface CarryPourTarget {
  id: string;
  /** Miệng dụng cụ nhận (vd. `vessel.mouth`). */
  mouth: THREE.Object3D;
  /** Bán kính miệng nhận (thế giới, mặc định 0,15). */
  radius?: number;
  /** Mặt chất lỏng nhận (thế giới) – dòng chảy rơi tới đây; mặc định miệng. */
  surface?(): THREE.Vector3;
  /** true = rót được; chuỗi = lí do sai (toast, ống đong về chỗ); false = bỏ qua vùng. */
  accepts?(): boolean | string;
  /** Hướng ngả thân khi rót vào dụng cụ này (rad, ghi đè `yaw` chung) – vd. ngả vào giữa bàn. */
  yaw?: number;
  /** Nhận `ml` mỗi frame đang chảy vào. */
  onPour(ml: number): void;
}

/** Dụng cụ rót: Vessel của @lab (ống đong, cốc…) hoặc vật bất kì (thìa…) kèm `lip`. */
export interface PourVessel {
  group: THREE.Object3D;
  mouthY?: number;
  profile?: VesselProfile;
}

/** Thứ được rót: `Liquid` của @lab hoặc lượng tuỳ ý (bột trên thìa: 1 = đầy thìa). */
export interface PourContent {
  readonly volumeML: number;
  setVolume(v: number): void;
}

export interface CarryPourOptions {
  /** Tên vật cho vùng thả (mỗi ống đong một tên). */
  item: string;
  /** Dụng cụ rót (ống đong, cốc…) – gốc ở đáy, đứng thẳng; được bọc vào khớp xoay đặt ở mép rót. */
  vessel: PourVessel;
  liquid: PourContent;
  /** Mép rót (toạ độ dụng cụ) – mặc định mép miệng phía chúc xuống tính từ `profile` + `mouthY`. */
  lip?: THREE.Vector3;
  /** Điểm giữa thân (toạ độ dụng cụ) cho mũi tên gợi ý – mặc định giữa chiều cao. */
  bodyAt?: THREE.Vector3;
  /** Bán kính dòng chảy (mặc định 2,2 mm); false = không vẽ dòng (bột – sim tự vẽ hạt rơi). */
  streamRadius?: number | false;
  /** Dung tích (mL) – mức đầy để tính góc bắt đầu chảy. */
  capacity: number;
  /**
   * Mức đầy 0…1 tính góc bắt đầu chảy (mặc định `liquid.volumeML / capacity`). Rót theo PHẦN (`pourPortion`) từ chai còn nhiều: trả mức
   * thật của chai (0 khi rót đủ phần) để góc chảy không tăng dần theo phần còn lại.
   */
  fill?(): number;
  /** Cha (mặt bàn) + chỗ đứng (đáy dụng cụ, hệ cha). */
  root: THREE.Object3D;
  home: THREE.Vector3;
  zones: DropZones;
  targets: CarryPourTarget[];
  /** Trục nghiêng: 'x' = miệng chúc về +z (thân ngả ra sau, nhìn từ trước thấy dòng chảy); 'z' = miệng chúc về −x. */
  axis?: 'x' | 'z';
  /** Lưu lượng khi nghiêng hết (mL/s, mặc định 15). */
  rate?: number;
  /** Góc nghiêng sẵn khi đặt vào tư thế rót (rad, mặc định 0,85) + thêm tối đa khi kéo (mặc định 1,3). */
  preTilt?: number;
  maxTilt?: number;
  /** Góc nghiêng khi rót tự động (`pourInto` – demo / phím tắt), mặc định `maxTilt` × 0,92 (rót mạnh). Nhỏ hơn = demo rót chậm. */
  pourTilt?: number;
  /** Xoay hướng nghiêng quanh trục đứng (rad): vd. −π/4 với 'x' → thân ngả về sau-phải, nhìn từ trước thấy dáng rót nghiêng. */
  yaw?: number;
  /** Mép rót cao hơn miệng nhận: tư thế cũ (không proxy / `fit: false`) mặc định 0,22 trên tâm miệng; có `fit` = độ nhấc TỐI THIỂU. */
  lift?: number;
  /**
   * Tư thế rót tự tính KHÔNG XUYÊN (mặc định bật khi dụng cụ rót + nhận có proxy va chạm – mọi vật dựng bằng createVessel, hoặc
   * setClearance): môi rót ngay trên mép miệng nhận, lùi vào trong `inset` (mặc định bán kính dòng + 3 mm), nhấc vừa đủ để thân không lọt
   * vào vật nhận / vật chứa lân cận ở mọi góc 0…maxTilt, khe hở `gap` (mặc định 2 mm); dòng rơi thẳng vào lòng. Thân vật rót ngả qua
   * vật cao bên cạnh thì thử ngả lệch ±45° / ±90° quanh `yaw` để môi rót không phải nhấc cao (`turn: false` = giữ hướng). false = tư thế cũ.
   */
  fit?: false | { gap?: number; inset?: number; turn?: boolean };
  /** Nhấc cao khi mang (mặc định 1,5 – đáy ống đong lướt trên miệng các bình khác); hạ xuống từ cao bao nhiêu (mặc định 1,5);
   *  rót xong nhấc thẳng lên bao nhiêu (mặc định 2,1). */
  carryLift?: number;
  approach?: number;
  leaveUp?: number;
  color?: THREE.ColorRepresentation;
  /** Ưu tiên bắt con trỏ (mặc định 3 – thắng vật nằm dưới thân ống khi đang nghiêng). */
  priority?: number;
  hint?: string;
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, nhấn chỉ báo lí do, camera không xoay); null = không. */
  blocked?(): string | null | undefined;
  onPick?(): StartVerdict;
  /** Dòng bắt đầu chảy vào `id` (lần đầu mỗi lượt rót). */
  onStart?(id: string): void;
  /** Đã rót hết vào `id` (trước khi ống đong về chỗ). */
  onEmpty?(id: string): void;
  /** Đã về chỗ đứng sau khi rót hết. */
  onHome?(id: string): void;
  /** Được đặt vào vùng thả KHÁC (không phải dụng cụ nhận) – vd. thìa nhúng vào lọ bột để xúc; null = bàn / về chỗ. */
  onPlace?(zoneId: string | null): void;
}

export interface CarryPour {
  /** Khớp xoay ở mép rót (vật được cầm). */
  pivot: THREE.Group;
  /** Điểm giữa thân dụng cụ (mũi tên gợi ý, điểm cầm cho kịch bản kiểm tra). */
  body: THREE.Object3D;
  grab: Grabbable;
  tilt: TiltPour;
  stream: PourStream;
  /** Đang đứng ở tư thế rót trên dụng cụ `id` (null = trên bàn / đang mang). */
  readonly at: string | null;
  readonly busy: boolean;
  /** Id vùng thả trên dụng cụ nhận `id` (cho demo / kịch bản). */
  zoneId(id: string): string;
  /** Demo: mang tới `id`, nghiêng rót hết, về chỗ – cùng đường đi như thao tác tay. */
  pourInto(id: string, onDone?: () => void): void;
  /** Đặt ngay về chỗ đứng (không hoạt cảnh). */
  reset(): void;
}
