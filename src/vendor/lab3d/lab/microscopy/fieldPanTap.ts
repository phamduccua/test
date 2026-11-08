import * as THREE from 'three';
import { addPickProxy, pointerHub, type PointerInfo } from '../../interact/index';
import type { SimContext } from '../../sim/types';

export interface FieldPanTapOptions {
  /** Nhóm mẫu ở chế độ vi mô – vùng bắt phẳng vô hình đặt trong nhóm, mặt phẳng ngang qua gốc nhóm. */
  group: THREE.Object3D;
  /** Cỡ vùng bắt (hệ nhóm) và lệch tâm. */
  size: THREE.Vector3;
  offset?: THREE.Vector3;
  enabled(): boolean;
  hint?: string | (() => string);
  /** Khung giới hạn tâm nhìn (thế giới, chỉ x / z) – null = không giới hạn. */
  bounds?(): THREE.Box3 | null;
  /** Bấm (không kéo, ≤ 6 px): điểm trên mặt mẫu (thế giới) + toạ độ khung. */
  tap(world: THREE.Vector3, p: PointerInfo): void;
  /** Vừa dời thị trường. */
  moved?(): void;
}

export interface FieldPanTap {
  /** Dời tâm khung nhìn (target + camera) tới điểm `world` (x / z) – demo / hook. */
  panTo(world: THREE.Vector3): void;
}

/**
 * Vi mô: KÉO mẫu để dời thị trường (như vặn ốc di chuyển bàn kính – điểm nắm luôn dưới con trỏ), BẤM để chọn tế bào. Một vùng bắt
 * phẳng qua hub `kit/lab3d/interact` (camera không xoay khi kéo). Rút từ TN-109-01 (microPan) – dùng chung TN-109-01, TN-109-02.
 */
export function createFieldPanTap(ctx: SimContext, o: FieldPanTapOptions): FieldPanTap {
  const hub = pointerHub(ctx);
  const proxy = addPickProxy((m) => ctx.track(m), o.group, o.size, o.offset);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const grab = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const shift = (d: THREE.Vector3) => {
    const t = ctx.controls.target;
    const to = t.clone().add(d);
    const b = o.bounds?.();
    if (b) {
      to.x = THREE.MathUtils.clamp(to.x, b.min.x, b.max.x);
      to.z = THREE.MathUtils.clamp(to.z, b.min.z, b.max.z);
    }
    d.copy(to).sub(t).setY(0);
    t.add(d);
    ctx.camera.position.add(d);
    ctx.controls.update();
    o.moved?.();
  };
  const onPlane = (ray: THREE.Ray, out: THREE.Vector3) => {
    plane.constant = -o.group.getWorldPosition(tmp).y;
    return ray.intersectPlane(plane, out);
  };
  ctx.track(
    hub.add({
      object: proxy, priority: -1, cursor: 'grab', hint: o.hint, enabled: o.enabled,
      onDown(_hit, p) {
        if (!onPlane(p.ray, grab)) return;
        return {
          cursor: 'grabbing',
          move(i) {
            if (onPlane(i.ray, hit)) shift(grab.clone().sub(hit));
          },
          end(i, cancelled) {
            if (cancelled || Math.hypot(i.totalX, i.totalY) > 6 || !onPlane(i.ray, hit)) return;
            o.tap(hit.clone(), i);
          },
        };
      },
    }),
  );
  return {
    panTo(world) {
      shift(world.clone().sub(ctx.controls.target).setY(0));
    },
  };
}
