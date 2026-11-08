import * as THREE from 'three';
import { pointerHub } from './pointer';
import type { InteractCtx, Pose } from './types';
import { createZoneRing, type ZoneRing } from './zoneRing';
import { labText } from '../text';

export interface DropZone {
  id: string;
  /** Tâm vùng (thế giới): vật, điểm cố định hoặc hàm. */
  anchor: THREE.Object3D | THREE.Vector3 | (() => THREE.Vector3);
  /** Bán kính hút (thế giới). Hình 'column' đo ngang xz, 'sphere' đo 3D. */
  radius: number;
  shape?: 'column' | 'sphere';
  /** Cột: chỉ tính khi y ∈ [tâm − below, tâm + height] (mặc định 0,3 r … ∞). */
  height?: number;
  below?: number;
  /** Vật `item` có liên quan/được thả vào đây không: true = được; chuỗi = sai (thông báo lí do); false = bỏ qua vùng. */
  accepts?(item: string): boolean | string;
  /** Vật nằm trong vùng phải được nhấc theo trục vùng lên quá độ cao này (thế giới) rồi mới đi ngang (rút khỏi ống nghiệm). */
  exitY?: number | (() => number);
  /** Tư thế đặt vật (hệ cha của vật được kéo); mảng = lộ trình (vd. trên miệng ống → đáy). */
  snap?(item: string): Pose | Pose[] | null;
  onEnter?(item: string): void;
  onLeave?(item: string): void;
  onDrop?(item: string): void;
  /**
   * Vòng sáng gợi ý (mặc định bán kính vùng, nằm ngang); false = không vẽ. `normal`: hướng cố định, `'camera'` = luôn quay về người
   * xem (vùng cầu quanh ion, hạt nhân…), hàm = tính mỗi frame (vd. pháp tuyến mặt địa cầu tại tâm vùng).
   */
  ring?: { radius?: number; normal?: THREE.Vector3 | 'camera' | (() => THREE.Vector3); offset?: THREE.Vector3 } | false;
  enabled?(): boolean;
}

export interface DropResult {
  zone: DropZone | null;
  ok: boolean;
  /** Lí do sai (đã hiện toast). */
  reason?: string;
}

export interface DropZones {
  add(z: DropZone): () => void;
  get(id: string): DropZone | undefined;
  /** Bắt đầu kéo `item`: sáng các vùng liên quan. */
  begin(item: string): void;
  /** Vật đang ở `world`: vùng đang trỏ vào (đã gọi onEnter/onLeave, đổi màu vòng). */
  over(item: string, world: THREE.Vector3): DropZone | null;
  /** Thả tại `world`: kiểm tra hợp lệ, onDrop hoặc phản hồi sai; tắt gợi ý. */
  end(item: string, world: THREE.Vector3): DropResult;
  /** Thả thẳng vào vùng `id` (demo) – cùng luồng kiểm tra như `end`. */
  dropInto(item: string, id: string): DropResult;
  cancel(): void;
  /** Tâm vùng (thế giới). */
  center(z: DropZone, out?: THREE.Vector3): THREE.Vector3;
}

/** Ô thả có vùng hút + vòng sáng gợi ý khi đang kéo vật phù hợp; thả sai → vòng đỏ + toast lí do. */
export function createDropZones(ctx: InteractCtx, o: { parent?: THREE.Object3D } = {}): DropZones {
  const hub = pointerHub(ctx);
  const parent = o.parent ?? ctx.scene;
  const list: { z: DropZone; ring: ZoneRing | null }[] = [];
  let dragging: string | null = null;
  let inside: DropZone | null = null;
  let time = 0;
  const center = (z: DropZone, out = new THREE.Vector3()) => {
    const a = z.anchor;
    if (typeof a === 'function') return out.copy(a());
    return (a as THREE.Object3D).isObject3D ? (a as THREE.Object3D).getWorldPosition(out) : out.copy(a as THREE.Vector3);
  };
  const live = (z: DropZone) => z.enabled?.() ?? true;
  const verdict = (z: DropZone, item: string) => (z.accepts ? z.accepts(item) : true);
  // Cột: đo theo TIA NHÌN – chiếu điểm dò dọc tia camera xuống mặt ngang của vùng (cái người dùng thấy là "ở trên miệng ống"),
  // không đo xz thô (vật mang cao hơn miệng sẽ lệch về phía camera do thị sai).
  const cam = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  /** Khoảng cách tới tâm vùng (Infinity = ngoài vùng). */
  const gap = (z: DropZone, w: THREE.Vector3): number => {
    const c = center(z);
    if (z.shape === 'sphere') return c.distanceTo(w) <= z.radius ? c.distanceTo(w) : Infinity;
    const dy = w.y - c.y;
    if (dy < -(z.below ?? z.radius) || dy > (z.height ?? Infinity)) return Infinity;
    ctx.camera.getWorldPosition(cam);
    const k = Math.abs(w.y - cam.y) > 1e-3 ? (c.y - cam.y) / (w.y - cam.y) : 1;
    const px = cam.x + (w.x - cam.x) * k, pz = cam.z + (w.z - cam.z) * k;
    const d = Math.hypot(px - c.x, pz - c.z);
    return d <= z.radius ? d : Infinity;
  };
  const paint = () => {
    for (const { z, ring } of list) {
      if (!ring) continue;
      const v = dragging && live(z) ? verdict(z, dragging) : false;
      ring.set(v !== false, inside === z ? (v === true ? 'hot' : 'bad') : 'idle');
    }
  };
  const leave = () => {
    if (inside && dragging) inside.onLeave?.(dragging);
    inside = null;
  };
  const finish = (item: string, z: DropZone | null): DropResult => {
    leave();
    dragging = null;
    paint();
    if (!z) return { zone: null, ok: false };
    const v = verdict(z, item);
    const ring = list.find((e) => e.z === z)?.ring;
    if (v === true) {
      ring?.flash('hot', 0.5);
      z.onDrop?.(item);
      return { zone: z, ok: true };
    }
    const reason = typeof v === 'string' ? v : labText('t_2fd0ea089eca');
    ring?.flash('bad', 0.9);
    hub.toast.show(reason);
    return { zone: z, ok: false, reason };
  };
  const off = hub.onFrame((dt) => {
    time += dt;
    for (const { z, ring } of list) {
      if (!ring) continue;
      center(z, ring.mesh.position);
      const r = z.ring || {};
      if (r.offset) ring.mesh.position.add(r.offset);
      if (r.normal === 'camera') ring.face(ctx.camera.getWorldDirection(nrm).negate());
      else if (typeof r.normal === 'function') ring.face(r.normal());
      ring.pulse(time, dt);
    }
  });
  ctx.track(off);
  const api: DropZones = {
    add(z) {
      const n = z.ring ? z.ring.normal : undefined;
      const ring = z.ring === false ? null : createZoneRing(ctx, z.ring?.radius ?? z.radius, n instanceof THREE.Vector3 ? n : undefined);
      if (ring) parent.add(ring.mesh);
      const e = { z, ring };
      list.push(e);
      return () => {
        list.splice(list.indexOf(e), 1);
        ring?.mesh.removeFromParent();
      };
    },
    get: (id) => list.find((e) => e.z.id === id)?.z,
    begin(item) {
      dragging = item;
      inside = null;
      paint();
    },
    over(item, w) {
      dragging = item;
      // Vùng gần nhất trong các vùng chứa điểm (ống nghiệm sát nhau trên giá).
      let z: DropZone | null = null;
      let best = Infinity;
      for (const { z: q } of list) {
        const d = live(q) && verdict(q, item) !== false ? gap(q, w) : Infinity;
        if (d < best) [best, z] = [d, q];
      }
      if (z !== inside) {
        leave();
        inside = z;
        z?.onEnter?.(item);
      }
      paint();
      return z;
    },
    end(item, w) {
      return finish(item, api.over(item, w));
    },
    dropInto(item, id) {
      return finish(item, api.get(id) ?? null);
    },
    cancel() {
      leave();
      dragging = null;
      paint();
    },
    center,
  };
  return api;
}
