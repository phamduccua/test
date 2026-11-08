import * as THREE from 'three';
import { addPickProxy, createHoverFx, pointerHub, type InteractCtx, type PointerTarget } from '../../interact/index';
import type { StopwatchView } from './stopwatch';
import { mm } from '../units';
import { labText } from '../../text';

export interface StopwatchButtonOptions {
  /** Tooltip khi rê chuột (chuỗi hoặc hàm). */
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  priority?: number;
  /** Bấm nút (chuột/chạm) – trả gì cũng được; demo gọi `press()` để chạy cùng đường. */
  onPress(): void;
}

export interface StopwatchButton {
  /** Bấm (hoạt cảnh nút lún xuống) + gọi onPress – dùng cho demo / phím tắt. */
  press(): void;
  /** Vùng bắt (để mũi tên gợi ý / kịch bản kiểm tra trỏ vào). */
  proxy: THREE.Mesh;
}

/**
 * Đồng hồ bấm giờ BẤM ĐƯỢC (createStopwatch của @lab): bấm vào đồng hồ = nhấn nút trên đỉnh (nút lún xuống rồi bật lên).
 * Vùng bắt rộng hơn thân đồng hồ (dễ bấm cả khi nhìn từ trên xuống), viền sáng khi rê chuột.
 */
export function createStopwatchButton(ctx: InteractCtx, watch: StopwatchView, o: StopwatchButtonOptions): StopwatchButton {
  const hub = pointerHub(ctx);
  const face = watch.group.children[0];
  // Nút trên đỉnh: hình trụ con của mặt đồng hồ nằm cao nhất.
  const top = face.children.filter((c) => (c as THREE.Mesh).isMesh).reduce((a, b) => (b.position.y > a.position.y ? b : a));
  const y0 = top.position.y;
  const proxy = addPickProxy((x) => ctx.track(x), face, new THREE.Vector3(mm(80), mm(80), mm(40)), new THREE.Vector3(0, mm(4), 0));
  let t = 0;
  const press = () => {
    t = 0.18;
    o.onPress();
  };
  ctx.track(
    hub.add({
      object: watch.group,
      priority: o.priority ?? 0,
      cursor: 'pointer',
      hint: o.hint ?? labText('t_50a22daa9c1e'),
      enabled: o.enabled,
      onHover: createHoverFx(ctx, watch.group, { pop: 1.06 }),
      onTap: press,
    }),
  );
  ctx.track(
    hub.onFrame((dt) => {
      t = Math.max(0, t - dt);
      top.position.y = y0 - (t > 0 ? mm(2.5) : 0);
    }),
  );
  return { press, proxy };
}
