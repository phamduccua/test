import * as THREE from 'three';
import { axisConstraint } from './constraints';
import { createDraggable } from './drag';
import type { HoverFxOptions } from './hover';
import { clamp, invLerp, lerp, snapStep } from './math';
import { pointerHub } from './pointer';
import type { Binding, InteractCtx, PointerInfo, PointerTarget, StartVerdict } from './types';
import { labText } from '../text';

type Num = number | (() => number);
type Vec = THREE.Vector3 | (() => THREE.Vector3);

export interface HandleOptions {
  /** Tay kéo (được di chuyển) – vị trí theo hệ cha. */
  object: THREE.Object3D;
  handle?: THREE.Object3D;
  /** Hai đầu ray trượt (hệ cha của object) ứng với min / max; hàm → ray đổi theo cảnh (vd. đỉnh núi dời). */
  from: Vec;
  to: Vec;
  /** Giá trị ở hai đầu ray (số hoặc hàm – vd. khoảng đổi theo phân tử đang chọn). */
  min: Num;
  max: Num;
  step?: number;
  value: Binding<number>;
  /** Gọi `value.set` khi đang kéo tối đa mỗi `liveEvery` giây (0 = mọi lần; việc nặng như dựng lại địa hình: 0,2). */
  liveEvery?: number;
  /** Giữ khoảng lệch giữa chỗ nắm và tay kéo (nắm chỗ nào cũng không nhảy giá trị) – mặc định false (tay kéo nhảy tới con trỏ). */
  keepOffset?: boolean;
  /** Tương đối: giá trị = giá trị lúc nhấn + độ dời dọc ray (ray không đi qua vật được kéo, vd. hộp nguồn trên đường ray riêng). */
  relative?: boolean;
  /** Không tự đặt vị trí vật theo giá trị (sim tự đặt – chỉ dùng ray để đọc giá trị). */
  place?: boolean;
  /**
   * Chiếu con trỏ lên trục SONG SONG ray đi qua điểm nắm (thay vì chính ray from → to): vật dài (vạch ranh giới hết khối) nắm ở đầu
   * vẫn bám con trỏ, cả khi lùi camera xa. Vị trí vật vẫn theo from → to. Mặc định false (như cũ).
   */
  grabAxis?: boolean;
  priority?: number;
  layer?: string;
  /** Đang tắt vẫn che tia (vạch/tay kéo đặt trong biểu đồ bấm được) – PointerTarget.opaque. */
  opaque?: boolean;
  cursor?: string;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, nhấn chỉ báo lí do, camera không xoay); null = không. */
  blocked?(): string | null | undefined;
  hover?: HoverFxOptions | false;
  /** Nhấn vào: false = không bắt (camera xoay); `'block'` / lí do = từ chối nhưng giữ phiên (camera không xoay) + toast. */
  onStart?(p: PointerInfo): StartVerdict;
  /** Nhả (sau `onChange(v, true)`). */
  onEnd?(v: number, cancelled: boolean): void;
  /** Mỗi lần giá trị đổi (kể cả xem trước khi kéo) – cập nhật nhãn số. */
  onChange?(v: number, final: boolean): void;
}

export interface Handle {
  readonly value: number;
  readonly dragging: boolean;
  set(v: number, final?: boolean): void;
  /** Demo: trượt mượt tới `v` trong `s` giây. */
  animateTo(v: number, s?: number, onDone?: () => void): void;
  /** Dừng hoạt cảnh demo. */
  stop(): void;
  dispose(): void;
}

const vec = (v: Vec) => (typeof v === 'function' ? v() : v);
const num = (v: Num) => (typeof v === 'function' ? v() : v);

/**
 * Tay kéo 3D trên ray thẳng (piston, mốc độ cao, thanh trượt trong cảnh – `createSlider3D` là bí danh):
 * kéo → giá trị ∈ [min, max] theo bước, đồng bộ hai chiều với tham số (bindParam) – GUI đổi thì tay kéo tự chạy theo.
 */
export function createHandle(ctx: InteractCtx, o: HandleOptions): Handle {
  const hub = pointerHub(ctx);
  const wFrom = new THREE.Vector3(), wTo = new THREE.Vector3();
  // trục chiếu = ray (thế giới) dời song song `gOff` tới điểm nắm (grabAxis); mặc định gOff = 0
  const pFrom = new THREE.Vector3(), pTo = new THREE.Vector3(), gOff = new THREE.Vector3(), dir = new THREE.Vector3();
  const axis = axisConstraint(pFrom, pTo);
  let preview = o.value.get();
  let lastLive = 0;
  let base = 0; // relative / keepOffset: lệch (theo giá trị) giữa chỗ nắm và giá trị lúc nhấn
  let anim: { a: number; b: number; t: number; s: number; done?: () => void } | null = null;
  const lo = () => num(o.min), hi = () => num(o.max);
  const place = (v: number) => {
    if (o.place === false) return;
    o.object.position.lerpVectors(vec(o.from), vec(o.to), clamp(invLerp(lo(), hi(), v), 0, 1));
  };
  const quant = (v: number) => clamp(snapStep(v, o.step, lo()), Math.min(lo(), hi()), Math.max(lo(), hi()));
  const set = (v: number, final = false) => {
    const q = quant(v);
    preview = q;
    if (final && o.value.commit) o.value.commit(q);
    else o.value.set(q);
    place(q);
    o.onChange?.(q, final);
  };
  const world = () => {
    const p = o.object.parent;
    wFrom.copy(vec(o.from));
    wTo.copy(vec(o.to));
    if (p) {
      p.localToWorld(wFrom);
      p.localToWorld(wTo);
    }
    pFrom.copy(wFrom).add(gOff);
    pTo.copy(wTo).add(gOff);
  };
  /** Phần vuông góc trục của (điểm nắm − from) – dời trục chiếu tới chỗ nắm. */
  const grabOffset = (grab: THREE.Vector3) => {
    gOff.set(0, 0, 0);
    world();
    if (!o.grabAxis) return;
    dir.subVectors(wTo, wFrom).normalize();
    gOff.subVectors(grab, wFrom);
    gOff.addScaledVector(dir, -gOff.dot(dir));
    world();
  };
  const tmp = new THREE.Vector3();
  const atRay = (ray: THREE.Ray) => (axis.project(ray, tmp), lerp(lo(), hi(), axis.t));
  const drag = createDraggable(ctx, {
    object: o.object,
    handle: o.handle,
    priority: o.priority,
    layer: o.layer,
    opaque: o.opaque,
    hint: o.hint ?? labText('t_7e72f6e9749d'),
    cursor: o.cursor ?? 'grab',
    enabled: o.enabled,
    blocked: o.blocked,
    hover: o.hover,
    keepOffset: false,
    constraint: (grab) => (grabOffset(grab), axis),
    apply: () => {},
    onStart: (_w, p) => {
      const v = o.onStart?.(p);
      if (v === false || typeof v === 'string') return v;
      anim = null;
      preview = o.value.get();
      base = o.relative || o.keepOffset ? preview - atRay(p.ray) : 0;
    },
    onMove: () => {
      const v = quant(lerp(lo(), hi(), axis.t) + base);
      if (v === preview) return;
      preview = v;
      place(v);
      const now = performance.now();
      if (!o.liveEvery || now - lastLive > o.liveEvery * 1000) {
        lastLive = now;
        o.value.set(v);
      }
      o.onChange?.(v, false);
    },
    onEnd: (_w, _p, cancelled) => {
      set(preview, true);
      o.onEnd?.(preview, cancelled);
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
    } else if (!drag.dragging) place(o.value.get()); // ray có thể dời theo cảnh
  });
  const unbusy = hub.busy(() => !!anim);
  const dispose = () => (drag.dispose(), off(), unbusy());
  ctx.track(dispose);
  place(o.value.get());
  return {
    get value() {
      return o.value.get();
    },
    get dragging() {
      return drag.dragging;
    },
    set,
    animateTo(v, s = 1, onDone) {
      anim = { a: o.value.get(), b: v, t: 0, s, done: onDone };
    },
    stop: () => void (anim = null),
    dispose,
  };
}

/** Bí danh: thanh trượt trong cảnh. */
export const createSlider3D = createHandle;
