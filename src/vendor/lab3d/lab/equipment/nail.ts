import * as THREE from 'three';
import { createPlatedMaterial, type PlatedMaterial } from '../materials/plating';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface Nail {
  /** Gốc ở mũi đinh, thân theo +y cục bộ tới mũ. */
  group: THREE.Group;
  mesh: THREE.Mesh;
  plating: PlatedMaterial;
  length: number;
  /** Ghi lại mặt chất lỏng hiện tại (độ cao thế giới `worldY`) làm ranh giới mạ – gọi khi đinh đã nằm yên trong dung dịch. */
  captureWaterline(worldY: number): void;
}

/** A-DINH-SAT – đinh sắt (Lathe: mũi nhọn, thân có khía gần mũ, mũ dẹt) với vật liệu mạ được (Cu bám dần). */
export function createNail(
  ctx: Tracker,
  o: { length?: number; diameter?: number; coat?: THREE.ColorRepresentation; base?: THREE.ColorRepresentation } = {},
): Nail {
  const L = o.length ?? mm(60);
  const r = (o.diameter ?? mm(3)) / 2;
  const head = r * 2.4;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.25, r * 0.5)];
  pts.push(new THREE.Vector2(r, r * 3.2));
  // Thân + vài khía chống tuột gần mũ.
  const grip0 = L - mm(10);
  for (let y = r * 3.4; y < L - mm(1.2); y += mm(0.6)) {
    const k = y > grip0 && y < L - mm(3) ? Math.round((y - grip0) / mm(0.6)) % 2 : 0;
    pts.push(new THREE.Vector2(r * (1 - 0.06 * k), y));
  }
  pts.push(new THREE.Vector2(r * 1.1, L - mm(1.2)));
  pts.push(new THREE.Vector2(head, L - mm(0.7)));
  pts.push(new THREE.Vector2(head, L - mm(0.2)));
  pts.push(new THREE.Vector2(head * 0.85, L));
  pts.push(new THREE.Vector2(0, L + mm(0.1)));
  const plating = createPlatedMaterial({ base: o.base, coat: o.coat });
  ctx.track(plating.material);
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), plating.material);
  mesh.castShadow = true;
  mesh.name = 'nail';
  const group = new THREE.Group();
  group.name = 'nail-group';
  group.add(mesh);
  const inv = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  return {
    group,
    mesh,
    plating,
    length: L,
    captureWaterline(worldY) {
      mesh.updateWorldMatrix(true, false);
      inv.copy(mesh.matrixWorld).invert();
      // Mặt phẳng y = worldY → toạ độ cục bộ (điểm + pháp tuyến).
      mesh.getWorldPosition(p);
      p.y = worldY;
      p.applyMatrix4(inv);
      n.set(0, 1, 0).transformDirection(inv);
      plating.setWaterline(n, n.dot(p));
    },
  };
}
