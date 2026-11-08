import * as THREE from 'three';
import type { SimContext } from '../../sim/types';

export interface PickerHandlers<T> {
  onHover?(item: T | null, hit: THREE.Intersection | null): void;
  onClick?(item: T, hit: THREE.Intersection): void;
}

export interface Picker {
  /** Bật/tắt (vd. khi đang chạy kịch bản). */
  enabled: boolean;
  dispose(): void;
}

/**
 * Chọn đối tượng bằng raycaster trên canvas. `items` = danh sách {object, ...}; trúng con cháu cũng tính.
 * Click chỉ kích hoạt khi con trỏ không bị kéo (phân biệt với xoay camera). Tự gỡ sự kiện qua ctx.track.
 */
export function createPicker<T extends { object: THREE.Object3D }>(
  ctx: SimContext,
  items: T[],
  h: PickerHandlers<T>,
): Picker {
  // OrbitControls bắt con trỏ (pointer capture) trên phần tử của nó → nghe sự kiện ở đó.
  const el = (ctx.controls.domElement as HTMLElement | null) ?? ctx.renderer.domElement;
  const canvas = ctx.renderer.domElement;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const roots = items.map((i) => i.object);
  let hovered: T | null = null;
  let down: { x: number; y: number } | null = null;
  const picker: Picker = { enabled: true, dispose };

  const pick = (e: PointerEvent): { item: T; hit: THREE.Intersection } | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    const hits = ray.intersectObjects(roots, true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      if (!o.visible || o.userData.outlineShell) continue;
      while (o) {
        const idx = roots.indexOf(o);
        if (idx >= 0) return { item: items[idx], hit };
        o = o.parent;
      }
    }
    return null;
  };
  const onMove = (e: PointerEvent) => {
    if (!picker.enabled || e.buttons) return;
    const p = pick(e);
    const item = p?.item ?? null;
    if (item !== hovered) {
      hovered = item;
      el.style.cursor = item ? 'pointer' : '';
      h.onHover?.(item, p?.hit ?? null);
    }
  };
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (!picker.enabled || !down || e.button !== 0) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 5) return;
    const p = pick(e);
    if (p) h.onClick?.(p.item, p.hit);
  };
  const onLeave = () => {
    if (hovered) {
      hovered = null;
      el.style.cursor = '';
      h.onHover?.(null, null);
    }
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointerleave', onLeave);
  function dispose() {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointerleave', onLeave);
    el.style.cursor = '';
  }
  ctx.track(dispose);
  return picker;
}
