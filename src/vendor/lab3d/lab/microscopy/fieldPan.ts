import * as THREE from 'three';
import { addPickProxy, createDraggable, horizontalConstraint, pointerHub } from '../../interact/index';
import type { SimContext } from '../../sim/types';

export interface FieldPanOptions {
  /** Nhóm mẫu ở chế độ vi mô (mặt thạch, tế bào…) – dịch ngang trên mặt phẳng của nó. */
  group: THREE.Object3D;
  /** Đơn vị cảnh / µm. */
  unitsPerUm: number;
  /** Giới hạn dịch (µm) mỗi chiều. */
  limitUm: number;
  /** Cỡ vùng bắt (đơn vị cảnh) – mặc định 3000 (cả thị trường). */
  pickSize?: number;
  hint?: string;
  enabled(): boolean;
  blocked?(): string | null;
  onMove?(): void;
  /** Nhả chuột (hoặc demo trượt xong) – sim kiểm thị trường đã đúng chỗ chưa. */
  onEnd?(): void;
}

export interface FieldPan {
  /** Điểm mẫu (µm, x / z của nhóm) đang ở giữa thị trường. */
  readonly um: { x: number; z: number };
  readonly dragging: boolean;
  /** Demo: trượt mẫu tới điểm (µm) trong `s` giây – cùng đường kéo tay (`moveTo`), xong gọi onEnd. */
  glide(x: number, z: number, s: number, done?: () => void): void;
  /** Đặt ngay (làm lại / hoàn tác). */
  place(x: number, z: number): void;
}

/**
 * Kéo thị trường kính hiển vi (vi mô) = dịch lam trên bàn kính: mẫu đi theo con trỏ trên mặt phẳng ngang, nhả → `onEnd`.
 * Dùng chung: TN-139-01 (tìm vùng nhiều vi khuẩn), TN-122-01 (đưa một tế bào đơn lẻ vào giữa thị trường).
 */
export function createFieldPan(ctx: SimContext, o: FieldPanOptions): FieldPan {
  const g = o.group;
  const k = o.unitsPerUm;
  const lim = o.limitUm * k;
  const um = { x: 0, z: 0 };
  const sync = () => {
    um.x = -g.position.x / k;
    um.z = -g.position.z / k;
  };
  const place = (x: number, z: number) => {
    g.position.set(-x * k, g.position.y, -z * k);
    sync();
  };
  const size = o.pickSize ?? 3000;
  const handle = addPickProxy((m) => ctx.track(m), g, new THREE.Vector3(size, 4, size));
  const toWorld = (p: THREE.Vector3) => (g.parent ? g.parent.localToWorld(p) : p);
  const drag = createDraggable(ctx, {
    object: g, handle, constraint: horizontalConstraint(() => g.getWorldPosition(new THREE.Vector3()).y), keepOffset: true, smoothing: 18,
    cursor: 'grab', hover: false, hint: o.hint, enabled: o.enabled, blocked: o.blocked,
    filter(w) {
      const p = g.parent ? g.parent.worldToLocal(w.clone()) : w.clone();
      p.x = THREE.MathUtils.clamp(p.x, -lim, lim);
      p.z = THREE.MathUtils.clamp(p.z, -lim, lim);
      w.copy(toWorld(p));
    },
    onMove: () => (sync(), o.onMove?.()),
    onEnd: () => (sync(), o.onEnd?.()),
  });
  const hub = pointerHub(ctx);
  sync();
  return {
    um,
    get dragging() {
      return drag.dragging;
    },
    glide(x, z, s, done) {
      const a = { ...um };
      hub.tween(s, (t) => {
        const e = t * t * (3 - 2 * t);
        drag.moveTo(toWorld(new THREE.Vector3(-(a.x + (x - a.x) * e) * k, g.position.y, -(a.z + (z - a.z) * e) * k)));
        sync();
        o.onMove?.();
      }, () => (sync(), o.onEnd?.(), done?.()));
    },
    place,
  };
}
