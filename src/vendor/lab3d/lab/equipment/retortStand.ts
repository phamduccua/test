import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface RetortStandOptions {
  /** Chiều cao trụ (đơn vị cảnh), mặc định 550 mm. */
  rodHeight?: number;
  /** Độ cao tâm kẹp; null = không có kẹp. */
  clampHeight?: number | null;
  /** Độ cao vòng sắt; null = không có vòng. */
  ringHeight?: number | null;
  /** Khoảng từ trụ tới tâm kẹp/vòng. */
  reach?: number;
  /** Bán kính lòng kẹp (ôm cổ bình). */
  clampRadius?: number;
  ringRadius?: number;
}

export interface RetortStand {
  group: THREE.Group;
  /** Tâm hai càng kẹp (gắn dụng cụ vào đây). */
  clampPoint: THREE.Object3D;
  /** Tâm vòng sắt (mặt trên). */
  ringPoint: THREE.Object3D;
}

function boss(mats: ReturnType<typeof labMaterials>): THREE.Group {
  const g = new THREE.Group();
  const block = new THREE.Mesh(new THREE.BoxGeometry(mm(26), mm(24), mm(22)), mats.blackPaint());
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(mm(3), mm(3), mm(18), 12), mats.steel());
  screw.rotation.x = Math.PI / 2;
  screw.position.z = mm(18);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(mm(7), mm(7), mm(6), 16), mats.blackPaint());
  knob.rotation.x = Math.PI / 2;
  knob.position.z = mm(27);
  g.add(block, screw, knob);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** A-GIA-SAT – giá sắt: đế, trụ, khớp nối, kẹp càng cua (lót bần) và vòng sắt. Gốc = chân trụ; tay vươn theo +x. */
export function createRetortStand(ctx: Tracker, o: RetortStandOptions = {}): RetortStand {
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'retort-stand';
  const H = o.rodHeight ?? mm(550);
  const reach = o.reach ?? mm(150);
  const base = new THREE.Mesh(new THREE.BoxGeometry(mm(220), mm(10), mm(140)), mats.blackPaint());
  base.position.set(reach * 0.62, mm(5), 0);
  base.castShadow = base.receiveShadow = true;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(mm(5.5), mm(5.5), H, 20), mats.chrome());
  rod.position.y = H / 2 + mm(8);
  rod.castShadow = true;
  group.add(base, rod);

  const clampPoint = new THREE.Object3D();
  const ringPoint = new THREE.Object3D();
  group.add(clampPoint, ringPoint);

  if (o.clampHeight !== null) {
    const y = o.clampHeight ?? H * 0.65;
    const rc = o.clampRadius ?? mm(16);
    const b = boss(mats);
    b.position.y = y;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(mm(4), mm(4), reach - rc, 12), mats.chrome());
    arm.rotation.z = Math.PI / 2;
    arm.position.set((reach - rc) / 2, y, 0);
    arm.castShadow = true;
    group.add(b, arm);
    for (const side of [-1, 1]) {
      const jaw = new THREE.Mesh(new THREE.TorusGeometry(rc + mm(3), mm(2.6), 8, 24, Math.PI * 0.8), mats.chrome());
      jaw.rotation.x = Math.PI / 2;
      jaw.rotation.z = side > 0 ? Math.PI * 0.1 : -Math.PI * 0.9;
      jaw.position.set(reach, y, 0);
      const pad = new THREE.Mesh(new THREE.TorusGeometry(rc + mm(0.8), mm(1.6), 6, 20, Math.PI * 0.55), mats.cork());
      pad.rotation.copy(jaw.rotation);
      pad.rotation.z += side > 0 ? Math.PI * 0.12 : Math.PI * 0.12;
      pad.position.copy(jaw.position);
      jaw.castShadow = true;
      group.add(jaw, pad);
    }
    clampPoint.position.set(reach, y, 0);
  }
  if (o.ringHeight !== null) {
    const y = o.ringHeight ?? H * 0.35;
    const rr = o.ringRadius ?? mm(42);
    const b = boss(mats);
    b.position.y = y;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(mm(3.5), mm(3.5), reach - rr, 10), mats.blackPaint());
    arm.rotation.z = Math.PI / 2;
    arm.position.set((reach - rr) / 2, y, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, mm(3), 10, 48), mats.blackPaint());
    ring.rotation.x = Math.PI / 2;
    ring.position.set(reach, y, 0);
    arm.castShadow = ring.castShadow = true;
    group.add(b, arm, ring);
    ringPoint.position.set(reach, y + mm(3), 0);
  }
  return { group, clampPoint, ringPoint };
}
