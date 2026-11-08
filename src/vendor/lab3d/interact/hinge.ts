import * as THREE from 'three';
import { curveConstraint } from './constraints';
import { createDraggable } from './drag';
import type { HoverFxOptions } from './hover';
import { clamp, lerp } from './math';
import { pointerHub } from './pointer';
import type { Binding, InteractCtx, PointerTarget, StartVerdict } from './types';

export interface HingeOptions {
  /** Nắp / cửa quay quanh trục cục bộ `axis` (gốc vật = bản lề). */
  object: THREE.Object3D;
  axis?: 'x' | 'y' | 'z';
  /** Góc (rad, rotation[axis]) khi đóng (giá trị 0) và khi mở hết (giá trị 1). */
  closed: number;
  open: number;
  /** Điểm nắm (toạ độ cục bộ của vật – mép trước nắp): kéo điểm này theo cung quay. */
  grip: THREE.Vector3;
  /** Độ mở 0 (đóng) … 1 (mở) – thường `binding` vào trạng thái sim hoặc `bindParam`. */
  value: Binding<number>;
  /** Vùng bắt (mặc định chính vật). */
  handle?: THREE.Object3D;
  priority?: number;
  layer?: string;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, nhấn chỉ báo lí do, camera không xoay); null = không. */
  blocked?(): string | null | undefined;
  hover?: HoverFxOptions | false;
  onStart?(): StartVerdict;
  /** Mỗi lần độ mở đổi (kể cả khi đang kéo); `final` = nhả tay / hết hoạt cảnh. */
  onChange?(v: number, final: boolean): void;
  /** Số điểm mẫu của cung quay (mặc định 18). */
  samples?: number;
  /** Nhả tay giữa chừng → nắp tự đóng hẳn / mở hẳn theo phía gần hơn (như nắp có bản lề lò xo). Mặc định false. */
  snap?: boolean;
}

export interface Hinge {
  readonly value: number;
  readonly dragging: boolean;
  set(v: number, final?: boolean): void;
  /** Demo: đóng/mở mượt tới `v` trong `s` giây (cùng đường set/onChange như tay). */
  animateTo(v: number, s?: number, onDone?: () => void): void;
  /** Huỷ hoạt cảnh đang chạy (hoàn tác / làm lại) – giữ nguyên độ mở hiện tại, không gọi onDone. */
  stop(): void;
}

/**
 * Nắp / cửa có bản lề (nắp máy PCR, nắp bể điện di, cửa tủ ấm…): nhấn trên nắp, kéo – điểm nắm đi theo CUNG quay quanh bản lề
 * (tương đối: nắm chỗ nào cũng không nhảy, vẫn kéo tới hẳn hai đầu), giá trị 0 = đóng … 1 = mở. Đồng bộ hai chiều với `value` (đổi từ ngoài → nắp quay theo).
 */
export function createHinge(ctx: InteractCtx, o: HingeOptions): Hinge {
  const hub = pointerHub(ctx);
  const ax = o.axis ?? 'x';
  const n = Math.max(4, o.samples ?? 18);
  const angle = (v: number) => lerp(o.closed, o.open, clamp(v, 0, 1));
  let shown = NaN;
  let dragging = false;
  let v0 = 0;
  let t0 = 0;
  let cur = o.value.get();
  let anim: { a: number; b: number; t: number; s: number; done?: () => void } | null = null;
  const show = (v: number) => {
    shown = v;
    o.object.rotation[ax] = angle(v);
  };
  const set = (v: number, final = false) => {
    cur = clamp(v, 0, 1);
    if (final && o.value.commit) o.value.commit(cur);
    else o.value.set(cur);
    show(cur);
    o.onChange?.(cur, final);
  };
  /** Cung quay của điểm nắm (thế giới) – dựng lúc nhấn (bản lề không dời khi đang kéo). */
  const arc: THREE.Vector3[] = [];
  const buildArc = () => {
    const keep = o.object.rotation[ax];
    arc.length = 0;
    for (let i = 0; i <= n; i++) {
      o.object.rotation[ax] = angle(i / n);
      o.object.updateMatrixWorld(true);
      arc.push(o.object.localToWorld(o.grip.clone()));
    }
    o.object.rotation[ax] = keep;
    o.object.updateMatrixWorld(true);
  };
  const curve = curveConstraint(arc);
  const drag = createDraggable(ctx, {
    object: o.object,
    handle: o.handle,
    priority: o.priority,
    layer: o.layer,
    hint: o.hint,
    enabled: o.enabled,
    blocked: o.blocked,
    hover: o.hover,
    keepOffset: false,
    constraint: () => curve,
    apply: () => {},
    onStart: (_w, p) => {
      const r = o.onStart?.();
      if (r === false || typeof r === 'string') return r;
      anim = null;
      buildArc();
      curve.project(p.ray, new THREE.Vector3());
      t0 = curve.t;
      v0 = o.value.get();
      dragging = true;
    },
    // Không nhảy lúc nhấn, vẫn tới được hai đầu: dưới điểm nắm co giãn về 0, trên điểm nắm co giãn về 1.
    onMove: () => {
      const t = curve.t;
      set(t <= t0 ? (t0 > 1e-3 ? (v0 * t) / t0 : 0) : t0 < 1 - 1e-3 ? v0 + ((1 - v0) * (t - t0)) / (1 - t0) : 1);
    },
    onEnd: () => {
      dragging = false;
      if (o.snap && cur > 0.005 && cur < 0.995) anim = { a: cur, b: cur >= 0.5 ? 1 : 0, t: 0, s: 0.3 };
      else set(cur, true);
    },
  });
  const off = hub.onFrame((dt) => {
    if (anim) {
      anim.t = Math.min(1, anim.t + dt / anim.s);
      const a = anim;
      set(lerp(a.a, a.b, a.t * a.t * (3 - 2 * a.t)), a.t >= 1);
      if (a.t >= 1) {
        anim = null;
        a.done?.();
      }
    } else if (!dragging && o.value.get() !== shown) show((cur = o.value.get()));
  });
  const unbusy = hub.busy(() => !!anim);
  ctx.track(() => (drag.dispose(), off(), unbusy()));
  show(cur);
  return {
    get value() {
      return o.value.get();
    },
    get dragging() {
      return dragging;
    },
    set,
    animateTo(v, s = 0.8, onDone) {
      anim = { a: o.value.get(), b: v, t: 0, s, done: onDone };
    },
    stop: () => void (anim = null),
  };
}
