import * as THREE from 'three';
import type { PointerHit, PointerInfo, PointerTarget } from './types';

/** Vật và mọi tổ tiên đều visible (material.visible = false vẫn bắt được – dùng cho vùng bắt vô hình). */
export function visibleChain(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/** Raycast dùng chung: toạ độ khung → PointerInfo; tia → target trúng (ưu tiên cao thắng, cùng ưu tiên thì gần thắng). */
export function createRaycast(canvas: HTMLElement, camera: THREE.Camera, useRect = false) {
  const raycaster = new THREE.Raycaster();
  return {
    raycaster,
    info(x: number, y: number, prev: { x: number; y: number }, down: { x: number; y: number }, e: PointerEvent | null): PointerInfo {
      const r = useRect ? canvas.getBoundingClientRect() : null; // khung phụ (ô HTML có viền) → đo theo hộp hiển thị
      const w = r?.width ?? canvas.clientWidth, h = r?.height ?? canvas.clientHeight;
      const ndc = new THREE.Vector2((x / Math.max(1, w)) * 2 - 1, -(y / Math.max(1, h)) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return {
        x, y, ndc, ray: raycaster.ray.clone(), dx: x - prev.x, dy: y - prev.y, totalX: x - down.x, totalY: y - down.y,
        pointerType: e?.pointerType ?? 'mouse', event: e,
      };
    },
    /**
     * Target trúng tia trong `list` (đang bật). `off` = vật của các target `opaque` đang TẮT: tia trúng con cháu của chúng (trước khi
     * gặp target đang bật ở tổ tiên) bị bỏ qua – tắt một gadget con không làm vật cha "nhận hộ".
     */
    pick(ray: THREE.Ray, list: PointerTarget[], off?: Set<THREE.Object3D>): PointerHit | null {
      if (!list.length) return null;
      raycaster.ray.copy(ray);
      const roots = list.map((t) => t.object);
      let best: PointerHit | null = null;
      for (const h of raycaster.intersectObjects(roots, true)) {
        if (h.object.userData.outlineShell || !visibleChain(h.object)) continue;
        let o: THREE.Object3D | null = h.object;
        let i = -1;
        while (o && (i = roots.indexOf(o)) < 0 && !off?.has(o)) o = o.parent;
        if (i < 0) continue;
        const t = list[i];
        if (!best || (t.priority ?? 0) > (best.target.priority ?? 0))
          best = { target: t, object: h.object, point: h.point.clone(), distance: h.distance, instanceId: h.instanceId };
      }
      return best;
    },
  };
}

/**
 * Vùng bắt vô hình (cầu/hộp to hơn vật) cho vật nhỏ khó trúng chuột (đinh, panh, ghim). Gắn làm con của `parent`;
 * không vẽ, không đổ bóng, không viền. Trả mesh (dùng làm `handle`).
 */
export function addPickProxy(
  track: <T>(o: T) => T,
  parent: THREE.Object3D,
  size: THREE.Vector3 | number,
  offset: THREE.Vector3 = new THREE.Vector3(),
): THREE.Mesh {
  const s = typeof size === 'number' ? new THREE.Vector3(size, size, size) : size;
  const geo = track(new THREE.BoxGeometry(s.x, s.y, s.z));
  const mesh = new THREE.Mesh(geo, track(new THREE.MeshBasicMaterial({ visible: false })));
  mesh.position.copy(offset);
  mesh.name = 'pick-proxy';
  mesh.userData.noOutline = true;
  parent.add(mesh);
  return mesh;
}

/** Vòng frame thời gian thực (requestAnimationFrame) – chạy cả khi sim tạm dừng. */
export function createFrameLoop(onTick: (dt: number) => void) {
  const frames = new Set<(dt: number) => void>();
  let prev = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000));
    prev = now;
    onTick(dt);
    for (const f of [...frames]) f(dt);
  };
  raf = requestAnimationFrame(tick);
  return {
    add(cb: (dt: number) => void) {
      frames.add(cb);
      return () => void frames.delete(cb);
    },
    dispose() {
      cancelAnimationFrame(raf);
      frames.clear();
    },
  };
}
