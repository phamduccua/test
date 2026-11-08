import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import { accentColor, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface PenOptions {
  /** Màu mực + nắp + chuôi. Mặc định 'blue'. */
  color?: LabAccent | string;
  /** Bút dạ đang đậy nắp. Mặc định có. */
  capped?: boolean;
}

export interface Pen {
  group: THREE.Group;
  /** Đầu viết (con của group) – đặt vào chỗ cần viết/gõ. */
  tip: THREE.Object3D;
  /** Nắp bút (ẩn khi mở nắp). */
  cap: THREE.Object3D;
  setCapped(on: boolean): void;
}

/**
 * A-BUT-DA: bút dạ dầu ghi lên kính/ống nghiệm/đĩa petri (thân ngà Ø13 × 125 mm, nắp + chuôi màu mực, kẹp). Bút chì: `createPencil` (handTools).
 * Gốc ở đầu tù (chuôi), thân hướng +y; `tip` ở đầu viết. Nằm trên bàn: `group.rotation.z = -Math.PI / 2` rồi nâng y = bán kính.
 */
export function createPen(ctx: Tracker, o: PenOptions = {}): Pen {
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, parent: THREE.Object3D = group) => {
    const x = new THREE.Mesh(ctx.track(geo), m);
    x.position.y = y;
    x.castShadow = true;
    parent.add(x);
    return x;
  };
  const tip = new THREE.Object3D();
  group.add(tip);
  group.name = 'marker-pen';
  const ink = mats.plastic(accentColor(o.color ?? 'blue'));
  const R = mm(6.5);
  add(new THREE.CylinderGeometry(R, R, mm(108), 24), mats.instrument(), mm(54));
  add(new THREE.CylinderGeometry(R * 1.02, R * 1.02, mm(12), 24), ink, mm(6));
  add(new THREE.CylinderGeometry(R * 1.03, R * 1.03, mm(22), 24), ink, mm(62));
  add(new THREE.CylinderGeometry(R * 0.75, R * 0.55, mm(8), 20), mats.trim(), mm(112));
  add(new THREE.ConeGeometry(mm(2.2), mm(7), 14), ink, mm(119.5));
  tip.position.y = mm(123);
  // Nắp: ống màu mực úp lên đầu viết + kẹp.
  const cap = new THREE.Group();
  cap.position.y = mm(100);
  group.add(cap);
  add(new THREE.CylinderGeometry(R * 1.12, R * 1.12, mm(34), 24), ink, mm(14), cap);
  add(new THREE.SphereGeometry(R * 1.12, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), ink, mm(31), cap);
  const clip = add(new THREE.BoxGeometry(mm(3), mm(30), mm(1.6)), ink, mm(16), cap);
  clip.position.z = R * 1.12 + mm(1.4);
  const api: Pen = {
    group,
    tip,
    cap,
    setCapped(on) {
      cap.visible = on;
    },
  };
  api.setCapped(o.capped ?? true);
  return api;
}
