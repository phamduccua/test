import * as THREE from 'three';
import { pointerHub } from '../../interact/index';
import type { SimContext } from '../../sim/types';

export interface DragSource<T> {
  /** Vật để bắt (raycast, kể cả con cháu). */
  object: THREE.Object3D;
  data: T;
}

export interface DragHandlers<T> {
  /** Bắt đầu kéo nguồn `src`; trả false để từ chối. */
  onGrab(src: DragSource<T>, world: THREE.Vector3): boolean | void;
  /** Con trỏ di chuyển khi đang kéo: điểm trên mặt phẳng kéo (toạ độ thế giới) + toạ độ chuẩn hoá. */
  onMove(src: DragSource<T>, world: THREE.Vector3, ndc: THREE.Vector2): void;
  onDrop(src: DragSource<T>, world: THREE.Vector3, ndc: THREE.Vector2): void;
  /** Rê chuột (không kéo) lên nguồn nào. */
  onHover?(src: DragSource<T> | null): void;
}

export interface ElectronDrag {
  enabled: boolean;
  readonly dragging: boolean;
  /** Raycast tại `ndc` lên `objects`, trả chỉ số vật trúng (gồm con cháu) hoặc −1. */
  pickAt(ndc: THREE.Vector2, objects: THREE.Object3D[]): number;
  dispose(): void;
}

/**
 * API CŨ (giữ cho TN-096-04 …) – nay là lớp bọc mỏng trên hub con trỏ dùng chung `kit/lab3d/interact` (`pointerHub`): mỗi nguồn là một
 * `PointerTarget`, kéo trên mặt phẳng `plane`; OrbitControls tự tắt khi kéo, bấm chỗ khác vẫn xoay. Sim mới: dùng thẳng
 * `createDraggable` + `planeConstraint` + `createDropZones` (xem TN-024-01/interact.ts). Hủy (pointercancel) → `world` = NaN.
 */
export function createDrag<T>(ctx: SimContext, sources: DragSource<T>[], plane: THREE.Plane, h: DragHandlers<T>): ElectronDrag {
  const hub = pointerHub(ctx);
  const ray = new THREE.Raycaster();
  const hitPoint = new THREE.Vector3();
  let active: DragSource<T> | null = null;
  const onPlane = (r: THREE.Ray) => r.intersectPlane(plane, hitPoint) ?? hitPoint;
  const offs = sources.map((s) =>
    hub.add({
      object: s.object,
      enabled: () => api.enabled,
      onHover: (st) => st !== 'drag' && h.onHover?.(st === 'hover' ? s : null),
      onDown(_hit, p) {
        if (h.onGrab(s, onPlane(p.ray).clone()) === false) return false;
        active = s;
        return {
          move: (q) => h.onMove(s, onPlane(q.ray), q.ndc),
          end(q, cancelled) {
            active = null;
            h.onDrop(s, cancelled ? new THREE.Vector3(NaN, NaN, NaN) : onPlane(q.ray).clone(), q.ndc.clone());
          },
        };
      },
    }),
  );
  const api: ElectronDrag = {
    enabled: true,
    get dragging() {
      return active !== null;
    },
    pickAt(p, objects) {
      ray.setFromCamera(p, ctx.camera);
      for (const hit of ray.intersectObjects(objects, true)) {
        let o: THREE.Object3D | null = hit.object;
        if (!o.visible) continue;
        while (o) {
          const i = objects.indexOf(o);
          if (i >= 0) return i;
          o = o.parent;
        }
      }
      return -1;
    },
    dispose: () => offs.forEach((off) => off()),
  };
  ctx.track(() => api.dispose());
  return api;
}
