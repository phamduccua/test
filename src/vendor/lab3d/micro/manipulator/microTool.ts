import * as THREE from 'three';
import { createDraggable, planeConstraint, axisConstraint, clamp, pointerHub, type InteractCtx, type PointerTarget, type StartVerdict } from '../../interact/index';
import { labText } from '../../text';

type Vec = THREE.Vector3 | (() => THREE.Vector3);
const vec = (v: Vec) => (typeof v === 'function' ? v() : v);

/** Một chỗ đầu dụng cụ chạm được (tế bào, vỏ trứng, khuẩn lạc…) – toạ độ hệ cha của dụng cụ. */
export interface MicroSite {
  id: string;
  at: Vec;
  /** Đầu dụng cụ cách tâm ≤ radius (đv hệ cha) là đang chạm. */
  radius: number;
  enabled?(): boolean;
}

export type MicroPath =
  /** Đầu dụng cụ trượt trên mặt phẳng tiêu ngang (y hệ cha giữ nguyên) trong hộp x/z [min, max] – như cần điều khiển của bộ vi thao tác. */
  | { plane: { min: THREE.Vector2; max: THREE.Vector2 } }
  /** Dọc trục from (rút ra) → to (đâm vào hết) – kim đâm vào trứng đúng hướng; `depth` 0…1. */
  | { from: Vec; to: Vec };

export interface MicroToolOptions {
  /** Dụng cụ thuỷ tinh: đầu nhọn ở GỐC của object (object.position = đầu, hệ cha). */
  object: THREE.Object3D;
  /** Vùng bắt dọc thân (addPickProxy) – mặc định object. */
  handle?: THREE.Object3D;
  path: MicroPath;
  /** Chỗ nghỉ (hệ cha) cho reset(); mặc định vị trí lúc tạo. */
  rest?: THREE.Vector3;
  sites?: MicroSite[];
  /** Quán tính nhẹ như bộ vi thao tác thật (λ, 1/s; mặc định 16; 0 = tức thì). */
  smoothing?: number;
  priority?: number;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  blocked?(): string | null | undefined;
  onStart?(): StartVerdict;
  /** Đầu dụng cụ vừa dời (tay hoặc demo) – toạ độ hệ cha, vùng đang chạm. */
  onMove?(tip: THREE.Vector3, site: string | null): void;
  /** Đổi vùng chạm (vào / rời). */
  onSite?(site: string | null, prev: string | null): void;
  /** Nhả chuột sau khi kéo (không gọi khi demo). */
  onEnd?(tip: THREE.Vector3, site: string | null): void;
}

export interface MicroTool {
  /** Đầu dụng cụ (hệ cha) – chỉ đọc. */
  readonly tip: THREE.Vector3;
  readonly site: string | null;
  readonly dragging: boolean;
  /** Đường trục: 0 = rút ra (from) … 1 = đâm vào hết (to); mặt phẳng: 0. */
  readonly depth: number;
  /** Demo / phím tắt: trượt mượt đầu dụng cụ tới điểm (hệ cha) hoặc tâm vùng `id` trong `s` giây – qua cùng onMove/onSite như tay. */
  glideTo(to: THREE.Vector3 | string, s?: number, done?: () => void): void;
  /** Đặt ngay (hoàn tác, làm lại): cập nhật vùng chạm, không gọi onSite. */
  place(p: THREE.Vector3): void;
  reset(): void;
  siteAt(id: string): THREE.Vector3 | null;
}

/**
 * KÉO DỤNG CỤ VI THAO TÁC (ống vi tiêm, ống giữ, kim, pipet hút khuẩn lạc) trong thị trường kính: nắm thân ống kéo → đầu ống đi theo
 * (trên mặt phẳng tiêu hoặc dọc trục đâm), có quán tính nhẹ, kẹp trong vùng làm việc; báo vùng đầu ống đang chạm (`sites`).
 * Hút/bơm dùng `createPiston`. Đầu ống ở gốc vật nên sim chỉ cần đọc `tip` (đồng bộ cụm trượt vĩ mô, biến dạng tế bào…).
 */
export function createMicroTool(ctx: InteractCtx, o: MicroToolOptions): MicroTool {
  const hub = pointerHub(ctx);
  const tip = o.object.position.clone();
  const rest = (o.rest ?? tip).clone();
  const sites = o.sites ?? [];
  const axisPath = 'from' in o.path ? o.path : null;
  const planePath = 'plane' in o.path ? o.path.plane : null;
  let site: string | null = null;
  let depth = 0;
  const local = new THREE.Vector3();
  const seg = new THREE.Vector3();
  /** Kẹp điểm (hệ cha) vào đường kéo; trục → cập nhật depth. */
  const clampLocal = (p: THREE.Vector3) => {
    if (planePath) {
      p.y = tip.y;
      p.x = clamp(p.x, planePath.min.x, planePath.max.x);
      p.z = clamp(p.z, planePath.min.y, planePath.max.y);
      return p;
    }
    const a = vec(axisPath!.from), b = vec(axisPath!.to);
    seg.subVectors(b, a);
    depth = clamp(local.subVectors(p, a).dot(seg) / Math.max(1e-9, seg.lengthSq()), 0, 1);
    return p.lerpVectors(a, b, depth);
  };
  const siteOf = (p: THREE.Vector3) => {
    let best: string | null = null;
    let bd = Infinity;
    for (const s of sites) {
      if (s.enabled && !s.enabled()) continue;
      const d = p.distanceTo(vec(s.at)) / s.radius;
      if (d <= 1 && d < bd) (bd = d), (best = s.id);
    }
    return best;
  };
  const set = (p: THREE.Vector3, events: boolean) => {
    clampLocal(tip.copy(p));
    o.object.position.copy(tip);
    const now = siteOf(tip);
    const prev = site;
    site = now;
    if (!events) return;
    o.onMove?.(tip, site);
    if (now !== prev) o.onSite?.(now, prev);
  };
  const toLocal = (w: THREE.Vector3) => (o.object.parent ? o.object.parent.worldToLocal(w.clone()) : w.clone());
  const toWorld = (p: THREE.Vector3) => (o.object.parent ? o.object.parent.localToWorld(p.clone()) : p.clone());
  const up = new THREE.Vector3();
  const drag = createDraggable(ctx, {
    object: o.object,
    handle: o.handle,
    priority: o.priority ?? 2,
    hint: o.hint ?? labText('t_b9deedc4a693'),
    enabled: o.enabled,
    blocked: o.blocked,
    smoothing: o.smoothing ?? 16,
    keepOffset: true,
    hover: { outline: '#7fd3ff' },
    constraint: () => {
      // Trục: kéo dài hai đầu (chỗ nắm trên thân nằm xa đầu ống, ngoài đoạn from → to) – filter kẹp đầu ống về đúng đoạn.
      if (axisPath) {
        const a = toWorld(vec(axisPath.from)), b = toWorld(vec(axisPath.to));
        const ext = b.clone().sub(a).multiplyScalar(3);
        return axisConstraint(a.sub(ext), b.add(ext));
      }
      // Mặt phẳng tiêu qua ĐẦU ống (không qua chỗ nắm trên thân): đầu ống đi đúng dưới con trỏ, không lệch thị sai.
      up.set(0, 1, 0).transformDirection(o.object.parent?.matrixWorld ?? new THREE.Matrix4());
      return planeConstraint(new THREE.Plane().setFromNormalAndCoplanarPoint(up, o.object.getWorldPosition(new THREE.Vector3())));
    },
    onStart: () => o.onStart?.(),
    // Kẹp cả điểm đích (không chỉ vị trí vẽ) – quán tính không đuổi mãi theo điểm ngoài vùng làm việc.
    filter: (w) => void w.copy(toWorld(clampLocal(toLocal(w)))),
    apply: (w) => set(toLocal(w), true),
    onEnd: () => o.onEnd?.(tip, site),
  });
  let stop: (() => void) | null = null;
  const api: MicroTool = {
    get tip() {
      return tip;
    },
    get site() {
      return site;
    },
    get dragging() {
      return drag.dragging;
    },
    get depth() {
      return depth;
    },
    glideTo(to, s = 1.2, done) {
      stop?.();
      // Vùng chạm có thể đang dời (trứng đang quay, tế bào đang trôi) → tính lại đích mỗi khung.
      const goal = () => (typeof to === 'string' ? api.siteAt(to) : to);
      if (!goal()) return done?.();
      const from = tip.clone();
      const p = new THREE.Vector3();
      stop = hub.tween(s, (k) => set(p.lerpVectors(from, goal() ?? from, k), true), () => ((stop = null), done?.()));
    },
    place(p) {
      stop?.();
      stop = null;
      set(p, false);
    },
    reset: () => api.place(rest),
    siteAt(id) {
      const s = sites.find((x) => x.id === id);
      return s ? vec(s.at).clone() : null;
    },
  };
  ctx.track(() => stop?.());
  set(tip, false);
  return api;
}
