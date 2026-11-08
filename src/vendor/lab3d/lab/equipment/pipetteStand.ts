import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface PipetteStand {
  group: THREE.Group;
  /** Chỗ mũi tip của micropipette treo trên giá (cục bộ group) – chỗ nghỉ của createMicropipetteGesture. */
  tipRest: THREE.Vector3;
}

/** Giá đỡ micropipette (đế TRIM + trụ thép + ngàm màu) – chuyển từ TN-038-01 vào kit (dùng ở TN-038-01, TN-113-01). Gốc ở tâm đáy. */
export function createPipetteStand(ctx: Tracker): PipetteStand {
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'pipette-stand';
  const base = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(32), mm(36), mm(10), 32)), mats.trim());
  base.position.y = mm(5);
  const post = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(6), mm(6), mm(220), 16)), mats.steel());
  post.position.set(-mm(24), mm(120), 0);
  const arm = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(42), mm(10), mm(20))), mats.plastic('blue'));
  arm.position.set(-mm(12), mm(222), 0);
  for (const m of [base, post, arm]) {
    m.castShadow = true;
    group.add(m);
  }
  return { group, tipRest: new THREE.Vector3(0, mm(30), 0) };
}
