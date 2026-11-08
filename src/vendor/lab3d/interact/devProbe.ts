import * as THREE from 'three';
import { measureOverlaps } from '../lab/geometry/overlapProbe';
import { pointerHub } from './pointer';
import type { InteractCtx } from './types';

type ProbePoint = THREE.Object3D | THREE.Vector3 | ((...args: number[]) => THREE.Vector3 | THREE.Object3D | null);

/**
 * CHỈ DEV: `window.__ix = { screen(key, ...args) → {x, y} (px trang), keys, state(), idle() }` (điểm là hàm thì nhận args, vd. góc) để script Playwright kéo–thả chuột thật
 * (scripts/interact-check.mjs) mà không đoán toạ độ. `state` = hàm trạng thái riêng của sim (bước quy trình, vị trí…); `overlaps()` = cặp vật chứa đang xuyên.
 */
export function exposeProbe(ctx: InteractCtx, points: Record<string, ProbePoint>, state?: () => unknown): void {
  if (!import.meta.env.DEV) return;
  const hub = pointerHub(ctx);
  const v = new THREE.Vector3();
  const api = {
    keys: Object.keys(points),
    screen(key: string, ...args: number[]) {
      const p0 = points[key];
      const p = typeof p0 === 'function' ? p0(...args) : p0;
      if (!p) return null;
      if ((p as THREE.Object3D).isObject3D) (p as THREE.Object3D).getWorldPosition(v);
      else v.copy(p as THREE.Vector3);
      v.project(ctx.camera);
      const r = ctx.renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, behind: v.z > 1 };
    },
    /** Target trúng tại toạ độ trang (px) → tên vật bắt. */
    hit(x: number, y: number) {
      const r = ctx.renderer.domElement.getBoundingClientRect();
      const h = hub.pickAt(x - r.left, y - r.top);
      return h ? `${h.target.object.name || h.target.object.type}/${h.object.name || h.object.type}` : null;
    },
    state: () => ({ dragging: hub.active, hovered: hub.hovered?.object.name ?? null, ...((state?.() as object) ?? {}) }),
    /** Không kéo và không hoạt cảnh nào của kit đang chạy (cầm–đặt, tay kéo/núm/thanh tua demo, ống hút, rót, thẻ bay, quy trình demo). */
    idle: () => hub.idle,
    /** Cặp vật chứa đang xuyên nhau (mm, lớn trước): `{ a, b, kind: 'pour' | 'body', depth }[]` – xem lab/geometry/overlapProbe. */
    overlaps: (min?: number) => measureOverlaps(ctx.scene, min),
  };
  const w = window as unknown as { __ix?: unknown };
  w.__ix = api;
  ctx.track(() => {
    if (w.__ix === api) delete w.__ix;
  });
}
