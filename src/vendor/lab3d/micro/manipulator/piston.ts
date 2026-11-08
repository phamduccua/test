import type * as THREE from 'three';
import { createHandle, type Binding, type Handle, type InteractCtx, type PointerTarget } from '../../interact/index';
import { labText } from '../../text';

type Vec = THREE.Vector3 | (() => THREE.Vector3);

export interface PistonOptions {
  /** Cần piston / núm đẩy (được dời dọc hành trình) – vị trí theo hệ cha. */
  object: THREE.Object3D;
  /** Vùng bắt (mặc định object). */
  handle?: THREE.Object3D;
  /**
   * Hành trình (hệ cha): `from` = đẩy hết vào (min), `to` = kéo hết ra (max). Gốc của `object` nên nằm ở CHỖ NẮM (núm đẩy): tia con trỏ
   * chiếu lên đoạn from → to, nắm lệch xa gốc dọc trục thì ra ngoài đoạn và bị kẹp.
   */
  from: Vec;
  to: Vec;
  /** Thể tích ở hai đầu hành trình (mặc định 0…1). */
  min?: number;
  max?: number;
  step?: number;
  /** Thể tích đang hút (hai chiều với tham số / GUI – bindParam, binding). */
  value: Binding<number>;
  priority?: number;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  blocked?(): string | null | undefined;
  /** Piston dời: dv > 0 = kéo ra (hút vào ống), dv < 0 = đẩy vào (bơm ra) – cả tay lẫn demo. */
  onFlow?(dv: number, v: number): void;
  /** Nhả piston (sau lần đổi cuối) – v = thể tích, moved = tổng độ dời của lần kéo (có dấu). */
  onEnd?(v: number, moved: number): void;
}

export interface Piston {
  readonly value: number;
  readonly dragging: boolean;
  readonly handle: Handle;
  /** Demo / phím tắt: kéo (dv > 0, hút) hoặc đẩy (dv < 0, bơm) một lượng trong `s` giây – qua cùng onFlow như tay. */
  draw(dv: number, s?: number, onDone?: () => void): void;
  /** Đặt ngay (làm lại / hoàn tác) – không gọi onFlow. */
  reset(v?: number): void;
}

/**
 * PISTON HÚT / BƠM (bơm vi tiêm, xi lanh, pipet, ống giữ): kéo cần piston ra = hút, đẩy vào = bơm. Lưu lượng = độ dời của piston
 * (`onFlow(dv)`), đồng bộ hai chiều với tham số qua `value` (createHandle). Dùng cho cả vật vĩ mô (pipet, xi lanh trên bàn) lẫn gadget
 * neo trong thị trường vi mô (`createSyringeGadget` + `anchorToView`).
 */
export function createPiston(ctx: InteractCtx, o: PistonOptions): Piston {
  const min = o.min ?? 0;
  const max = o.max ?? 1;
  let last = o.value.get();
  let start = last;
  let quiet = false;
  const flow = (v: number) => {
    const dv = v - last;
    last = v;
    if (!quiet && Math.abs(dv) > 1e-9) o.onFlow?.(dv, v);
  };
  const handle = createHandle(ctx, {
    object: o.object,
    handle: o.handle,
    from: o.from,
    to: o.to,
    min,
    max,
    step: o.step,
    value: o.value,
    keepOffset: true,
    priority: o.priority ?? 3,
    cursor: 'ew-resize',
    hint: o.hint ?? labText('t_e17ba7fd8ff3'),
    enabled: o.enabled,
    blocked: o.blocked,
    onStart: () => {
      last = start = o.value.get();
    },
    onChange: (v) => flow(v),
    onEnd: (v) => o.onEnd?.(v, v - start),
  });
  return {
    get value() {
      return o.value.get();
    },
    get dragging() {
      return handle.dragging;
    },
    handle,
    draw(dv, s = 1, onDone) {
      last = start = o.value.get();
      const to = Math.min(max, Math.max(min, last + dv));
      handle.animateTo(to, s, () => {
        o.onEnd?.(to, to - start);
        onDone?.();
      });
    },
    reset(v = min) {
      handle.stop();
      quiet = true;
      handle.set(v, true);
      last = v;
      quiet = false;
    },
  };
}
