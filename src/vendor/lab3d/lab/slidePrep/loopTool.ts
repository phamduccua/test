import * as THREE from 'three';
import {
  addPickProxy, createGrabbable, createRubGesture, pointerHub, type DropZone, type DropZones, type Grabbable, type InteractCtx, type Pose,
  type RubGesture,
} from '../../interact/index';
import { mm } from '../units';
import { labText } from '../../text';

export interface LoopToolOptions {
  /** Que cấy (gốc ở tâm vòng, cán theo +x – createInoculatingLoop / createHotLoop().group). */
  object: THREE.Object3D;
  /** Nung đỏ 0…1 (createInoculatingLoop.setGlow) – bỏ trống nếu que tự tính nhiệt (HotLoop). */
  glow?(t: number): void;
  /** Que vào / ra khỏi lửa (HotLoop.setInFlame). */
  inFlame?(on: boolean): void;
  zones: DropZones;
  home: Pose;
  /** Vùng thả: giọt trên lam (dàn) và ngọn lửa (nung). */
  smearZone?: string;
  flameZone?: string;
  /** Tư thế vòng que chạm giọt (hệ cha của que) – gốc để kéo qua lại. */
  smearPose(): Pose;
  /** Đèn đang cháy (que trong vùng lửa mới nóng lên). */
  lit(): boolean;
  heldRot?: THREE.Euler;
  hint?(): string;
  blocked?(): string | null;
  /** Số lượt kéo qua lại để dàn đủ (mặc định 6). */
  strokes?: number;
  /** Giây trong lửa tới khi nóng đỏ – khử trùng xong (mặc định 2). */
  hotAfter?: number;
  onPlace?(zone: DropZone | null): void;
  /** Tiến độ dàn 0…1 (mỗi lần tăng). */
  onSpread?(k: number): void;
  onSpreadDone?(): void;
  onStroke?(): void;
  /** Vừa vào lửa (âm xèo) / đã nung đủ. */
  onFlame?(): void;
  onHot?(): void;
}

export interface LoopTool {
  grab: Grabbable;
  spread: RubGesture;
  /** Que đang ở: trên bàn / trên giọt / trong lửa / vùng khác (id). */
  readonly at: string;
  /** Độ nóng đỏ 0…1 (que kit không tự tính nhiệt). */
  readonly glow: number;
  /** Mỗi frame (thời gian mô phỏng). */
  update(dt: number): void;
  /** Làm lại / hoàn tác: que về chỗ, nguội; `spread` = vết bôi đã dàn xong. */
  reset(spread: boolean): void;
  /** Cho dàn thêm một lần nữa (lấy mẫu thứ hai) – không dời que. */
  rearm(): void;
}

/**
 * Que cấy bằng tay: cầm – thả vào giọt trên lam rồi KÉO QUA LẠI để dàn mỏng (createRubGesture), thả vào ngọn lửa để nung đỏ (khử trùng),
 * thả vào miệng ống (vùng của sim) để lấy mẫu. Chung cho TN-061-01, TN-119-01, TN-119-02.
 */
export function createLoopTool(ctx: InteractCtx, o: LoopToolOptions): LoopTool {
  const hub = pointerHub(ctx);
  const smearId = o.smearZone ?? 'smear';
  const flameId = o.flameZone ?? 'flame';
  const handle = addPickProxy((x) => ctx.track(x), o.object, new THREE.Vector3(0.26, 0.06, 0.06), new THREE.Vector3(0.12, 0, 0));
  let at = 'home';
  let glow = 0;
  let hot = 0;
  let k0 = 0;
  const grab: Grabbable = createGrabbable(ctx, {
    object: o.object, item: 'loop', zones: o.zones, handle, heldRot: o.heldRot ?? new THREE.Euler(0, 0, 0.35), lift: 0.15, home: o.home,
    hint: o.hint, blocked: o.blocked,
    enabled: () => at !== smearId,
    onPlace(z) {
      at = z?.id ?? 'home';
      if (at === flameId) {
        hot = 0;
        o.onFlame?.();
      }
      o.inFlame?.(at === flameId && o.lit());
      o.onPlace?.(z);
    },
  });
  ctx.track(hub.busy(() => at === flameId && hot < (o.hotAfter ?? 2)));
  const spread = createRubGesture(ctx, {
    object: o.object, handle, axis: 'x', strokes: o.strokes ?? 6, minStroke: 14, range: 60, priority: 2,
    enabled: () => at === smearId,
    hint: labText('t_509454800040'),
    onMove(off, k) {
      // Đã dàn xong (que đang về chỗ) – các lượt kéo thừa trong cùng phiên không kéo que lại lam.
      if (at !== smearId) return;
      o.object.position.copy(o.smearPose().pos).add(new THREE.Vector3(off * mm(9), 0, Math.sin(off * 3) * mm(2)));
      if (k > k0) o.onSpread?.((k0 = k));
    },
    onStroke: () => o.onStroke?.(),
    onDone() {
      at = 'home';
      grab.returnHome(() => o.onSpreadDone?.());
    },
  });
  return {
    grab, spread,
    get at() {
      return at;
    },
    get glow() {
      return glow;
    },
    update(dt) {
      const inFlame = at === flameId && o.lit();
      glow = Math.max(0, Math.min(1, glow + (inFlame ? dt / 0.6 : -dt / 1.4)));
      o.glow?.(glow);
      if (!inFlame) return;
      const need = o.hotAfter ?? 2;
      if (hot < need && (hot += dt) >= need) o.onHot?.();
    },
    rearm() {
      k0 = 0;
      spread.reset(0);
    },
    reset(done) {
      k0 = done ? 1 : 0;
      spread.reset(done ? 1 : 0);
      at = 'home';
      glow = hot = 0;
      o.glow?.(0);
      o.inFlame?.(false);
      grab.reset(o.home);
    },
  };
}
