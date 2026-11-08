import * as THREE from 'three';
import { toolSteel } from '../handTools/common';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface Spatula {
  /** Gốc ở giữa lòng thìa; cán theo +x cục bộ. */
  group: THREE.Group;
  /** Đống bột trên thìa (ẩn/hiện, đổi màu). */
  heap: THREE.Mesh;
  setLoad(on: boolean, color?: THREE.ColorRepresentation): void;
}

/** A-THIA-XUC – thìa xúc hoá chất inox (lòng thìa thuôn + cán dẹt), có đống bột tuỳ chọn. */
export function createSpatula(ctx: Tracker, o: { length?: number } = {}): Spatula {
  const L = o.length ?? mm(150);
  // Thép dụng cụ (sẫm hơn steel()) – thìa mảnh không chìm vào mặt bàn trắng.
  const steel = toolSteel(ctx);
  const group = new THREE.Group();
  group.name = 'spatula';
  const bowl = new THREE.Mesh(ctx.track(new THREE.SphereGeometry(mm(7), 20, 10, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38)), steel);
  bowl.scale.set(1.5, 0.55, 1);
  bowl.position.y = mm(3);
  const handle = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(L, mm(1.2), mm(5))), steel);
  handle.position.set(L / 2 + mm(8), mm(1.5), 0);
  handle.rotation.z = 0.05;
  const heapMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }));
  const heap = new THREE.Mesh(ctx.track(new THREE.SphereGeometry(mm(5), 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), heapMat);
  heap.scale.set(1.4, 0.5, 0.9);
  heap.position.y = mm(0.2);
  group.add(bowl, handle, heap);
  group.traverse((m) => (m.castShadow = true));
  return {
    group,
    heap,
    setLoad(on, color) {
      heap.visible = on;
      if (color !== undefined) heapMat.color.set(color);
    },
  };
}
