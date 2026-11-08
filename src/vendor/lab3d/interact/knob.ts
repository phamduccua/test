import * as THREE from 'three';
import { createHoverFx, type HoverFxOptions } from './hover';
import { angleDelta, clamp, invLerp, lerp, snapStep } from './math';
import { pointerHub } from './pointer';
import type { Binding, InteractCtx, PointerInfo, PointerTarget } from './types';
import { labText } from '../text';

export interface KnobOptions {
  /** Vật xoay quanh trục cục bộ `axis`; rotation[axis] lúc tạo = mốc 0. */
  object: THREE.Object3D;
  handle?: THREE.Object3D;
  axis?: 'x' | 'y' | 'z';
  min: number;
  max: number;
  /** Góc (rad, cộng vào mốc) tại min / max. Mặc định [0, 1,5π]. */
  angles?: [number, number];
  step?: number;
  /** Giá trị vòng (hướng 0–360°…): quay quá max quay lại min. */
  wrap?: boolean;
  value: Binding<number>;
  priority?: number;
  layer?: string;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, nhấn chỉ báo lí do, camera không xoay); null = không. */
  blocked?(): string | null | undefined;
  hover?: HoverFxOptions | false;
  onChange?(v: number, final: boolean): void;
}

export interface Knob {
  readonly value: number;
  readonly dragging: boolean;
  /** Đặt giá trị bằng mã (cập nhật binding + hình). */
  set(v: number, final?: boolean): void;
  /** Demo: xoay mượt tới `v` trong `s` giây. */
  animateTo(v: number, s?: number, onDone?: () => void): void;
}

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/**
 * Núm vặn 3D (đèn cồn, van, la bàn hướng gió…): kéo vòng quanh trục như vặn thật (mặt phẳng vuông góc trục);
 * nhìn ngang trục → kéo ngang màn hình. Đồng bộ hai chiều với tham số qua `value` (bindParam).
 */
export function createKnob(ctx: InteractCtx, o: KnobOptions): Knob {
  const hub = pointerHub(ctx);
  const axis = o.axis ?? 'y';
  const [a0, a1] = o.angles ?? [0, Math.PI * 1.5];
  const base = o.object.rotation[axis];
  const range = o.max - o.min;
  let shown = NaN;
  let dragging = false;
  let anim: { from: number; to: number; t: number; s: number; done?: () => void } | null = null;
  const angleOf = (v: number) => lerp(a0, a1, invLerp(o.min, o.max, v));
  const norm = (v: number) => (o.wrap ? o.min + ((((v - o.min) % range) + range) % range) : clamp(v, o.min, o.max));
  const show = (v: number) => {
    shown = v;
    o.object.rotation[axis] = base + angleOf(v);
  };
  const set = (v: number, final = false) => {
    const q = norm(snapStep(v, o.step, o.min));
    if (final && o.value.commit) o.value.commit(q);
    else o.value.set(q);
    show(q);
    o.onChange?.(q, final);
  };
  // Góc con trỏ quanh trục, tính NGƯỢC từ hình chiếu màn hình của vòng quay (elip): đúng cả khi nhìn xiên gần như ngang trục.
  const c = new THREE.Vector3(), n = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3(), t = new THREE.Vector3();
  const grab = new THREE.Vector3();
  let along = 0; // vòng quay đi qua ĐIỂM NẮM thật trên núm (dời dọc trục từ gốc vật) – gốc vật thấp/cao hơn chỗ tay cầm vẫn đúng góc
  const screen = (v: THREE.Vector3) => {
    t.copy(v).project(ctx.camera);
    const el = ctx.renderer.domElement;
    return { x: ((t.x + 1) / 2) * el.clientWidth, y: ((1 - t.y) / 2) * el.clientHeight };
  };
  const planeAngle = (p: PointerInfo): number | null => {
    o.object.getWorldPosition(c);
    n.copy(AXES[axis]).transformDirection(o.object.parent?.matrixWorld ?? new THREE.Matrix4());
    c.addScaledVector(n, along);
    u.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0).cross(n).normalize();
    w.crossVectors(n, u);
    const C = screen(c);
    const U = screen(u.add(c)), W = screen(w.add(c));
    const ux = U.x - C.x, uy = U.y - C.y, wx = W.x - C.x, wy = W.y - C.y;
    const det = ux * wy - uy * wx;
    if (Math.abs(det) < 0.03 * Math.hypot(ux, uy) * Math.hypot(wx, wy)) return null; // nhìn đúng ngang trục
    const dx = p.x - C.x, dy = p.y - C.y;
    return Math.atan2((ux * dy - uy * dx) / det, (dx * wy - dy * wx) / det);
  };
  const perRad = range / ((a1 - a0) || 1);
  const target: PointerTarget = {
    object: o.handle ?? o.object,
    priority: o.priority,
    layer: o.layer,
    hint: o.hint ?? labText('t_10d19aee329d'),
    enabled: o.enabled,
    blocked: o.blocked,
    onHover: o.hover === false ? undefined : createHoverFx(ctx, o.object, o.hover ?? {}),
    onDown(hit, p) {
      anim = null;
      dragging = true;
      along = 0;
      o.object.getWorldPosition(c);
      n.copy(AXES[axis]).transformDirection(o.object.parent?.matrixWorld ?? new THREE.Matrix4());
      // Trúng vùng bắt vô hình (addPickProxy – hộp to hơn núm) thì điểm trúng không nằm trên núm → giữ mặt phẳng qua gốc vật.
      const mat = (hit.object as THREE.Mesh).material as THREE.Material | undefined;
      const real = hit.object.name !== 'pick-proxy' && (mat?.visible ?? true);
      along = real ? grab.copy(hit.point).sub(c).dot(n) : 0;
      let prev = planeAngle(p);
      let acc = o.value.get();
      return {
        move(q) {
          const a = planeAngle(q);
          if (a !== null && prev !== null) acc += angleDelta(prev, a) * perRad;
          else acc += (q.dx / 160) * range * 0.25;
          prev = a;
          if (!o.wrap) acc = clamp(acc, o.min, o.max);
          set(acc);
        },
        end() {
          dragging = false;
          set(acc, true);
        },
      };
    },
  };
  const remove = hub.add(target);
  const unbusy = hub.busy(() => !!anim);
  const off = hub.onFrame((dt) => {
    if (anim) {
      anim.t = Math.min(1, anim.t + dt / anim.s);
      const e = anim.t * anim.t * (3 - 2 * anim.t);
      const a = anim;
      set(lerp(a.from, a.to, e), a.t >= 1);
      if (a.t >= 1) {
        anim = null;
        a.done?.();
      }
    } else if (!dragging && o.value.get() !== shown) show(o.value.get());
  });
  ctx.track(() => (remove(), off(), unbusy()));
  show(o.value.get());
  return {
    get value() {
      return o.value.get();
    },
    get dragging() {
      return dragging;
    },
    set,
    animateTo(v, s = 1, onDone) {
      anim = { from: o.value.get(), to: v, t: 0, s, done: onDone };
    },
  };
}
