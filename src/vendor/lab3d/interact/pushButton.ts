import * as THREE from 'three';
import { createHoverFx } from './hover';
import { pointerHub } from './pointer';
import { addPickProxy } from './raycast';
import type { InteractCtx, PointerTarget } from './types';
import { labText } from '../text';

export interface PushButtonOptions {
  /** Nút (mesh hoặc nhóm) – lún dọc `axis` (hệ cha của nút) khi bấm. */
  object: THREE.Object3D;
  /** Hướng lún (hệ cha, mặc định −z: mặt nút quay +z). */
  axis?: THREE.Vector3;
  /** Độ lún (đv, mặc định 0,02). */
  travel?: number;
  /** Vùng bắt vô hình quanh nút (đv, mặc định 0,2) – nút nhỏ vẫn dễ bấm. */
  proxy?: number;
  priority?: number;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, bấm chỉ báo lí do). */
  blocked?(): string | null | undefined;
  /** Bấm nút (chuột/chạm hoặc `press()` của demo). */
  onPress(): void;
}

export interface PushButton {
  /** Demo / phím tắt: bấm (nút lún + onPress) – cùng đường với bấm tay. */
  press(): void;
  /** Vùng bắt (mũi tên gợi ý / kịch bản kiểm tra). */
  proxy: THREE.Mesh;
}

/**
 * NÚT BẤM trên máy (nút phát xung, công tắc nguồn, nút khởi động máy li tâm…): bấm = nút lún xuống rồi bật lên + `onPress`.
 * Vùng bắt rộng hơn nút, viền sáng khi rê; bị chặn → con trỏ cấm + lí do (giữ phiên, camera không xoay). Tổng quát hoá nút đồng hồ bấm giờ.
 */
export function createPushButton(ctx: InteractCtx, o: PushButtonOptions): PushButton {
  const hub = pointerHub(ctx);
  const proxy = addPickProxy((x) => ctx.track(x), o.object, o.proxy ?? 0.2);
  const home = o.object.position.clone();
  const axis = (o.axis ?? new THREE.Vector3(0, 0, -1)).clone().normalize();
  let t = 0;
  const press = () => {
    t = 0.2;
    o.onPress();
  };
  ctx.track(
    hub.add({
      object: o.object,
      priority: o.priority ?? 3,
      cursor: 'pointer',
      hint: o.hint ?? labText('t_a9d41a337ab5'),
      enabled: o.enabled,
      blocked: o.blocked,
      onHover: createHoverFx(ctx, o.object, { pop: 1.08 }),
      onTap: press,
    }),
  );
  ctx.track(
    hub.onFrame((dt) => {
      if (t <= 0 && o.object.position.equals(home)) return;
      t = Math.max(0, t - dt);
      o.object.position.copy(home).addScaledVector(axis, t > 0 ? (o.travel ?? 0.02) : 0);
    }),
  );
  return { press, proxy };
}
