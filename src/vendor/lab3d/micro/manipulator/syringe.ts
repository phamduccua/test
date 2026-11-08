import * as THREE from 'three';
import type { Tracker } from '../../lab/types';

export interface SyringeGadgetOptions {
  /** Dài thân (đv, mặc định 1); bán kính = 0,13 × dài. */
  length?: number;
  /** Màu dịch trong thân (dầu vi tiêm vàng nhạt, môi trường hồng…). */
  fluid?: THREE.ColorRepresentation;
  /** Màu cần piston + núm đẩy. */
  color?: THREE.ColorRepresentation;
}

export interface SyringeGadget {
  group: THREE.Group;
  /** Cần piston, GỐC Ở NÚM ĐẨY (chỗ nắm) – dời dọc +x: `pushed` (đẩy hết) → `pulled` (kéo hết ra). */
  plunger: THREE.Group;
  /** Vùng bắt to quanh núm đẩy (vô hình). */
  grip: THREE.Mesh;
  pushed: THREE.Vector3;
  pulled: THREE.Vector3;
  /** Mũi xi lanh (đầu −x, hệ group) – nối ống dẫn tới dụng cụ. */
  nozzle: THREE.Vector3;
  /** Cột dịch theo vị trí piston hiện tại (gọi sau khi piston dời). */
  sync(): void;
  setFluid(color: THREE.ColorRepresentation): void;
}

/**
 * Xi lanh bơm vi tiêm (kiểu CellTram) vẽ đơn giản: thân kính trong có vạch chia, gioăng cao su, cần + núm đẩy, mũi nối ống.
 * Trục +x, mũi ở −x. Dùng làm piston kéo được (`createPiston({ object: g.plunger, from: g.pushed, to: g.pulled })`), vĩ mô trên bàn
 * hoặc neo cạnh thị trường vi mô bằng `anchorToView`.
 */
export function createSyringeGadget(ctx: Tracker, o: SyringeGadgetOptions = {}): SyringeGadget {
  const L = o.length ?? 1;
  const R = 0.13 * L;
  const g = new THREE.Group();
  g.name = 'syringe-gadget';
  const mat = <T extends THREE.Material>(m: T) => ctx.track(m);
  const geo = <T extends THREE.BufferGeometry>(x: T) => ctx.track(x);
  const glass = mat(new THREE.MeshStandardMaterial({ color: '#d9eef6', roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
  const dark = mat(new THREE.MeshStandardMaterial({ color: o.color ?? '#2d3540', roughness: 0.45, metalness: 0.2 }));
  const rubber = mat(new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: 0.8 }));
  const fluid = mat(new THREE.MeshStandardMaterial({ color: o.fluid ?? '#e8cf74', roughness: 0.3, emissive: o.fluid ?? '#e8cf74', emissiveIntensity: 0.15 }));
  const ink = mat(new THREE.MeshBasicMaterial({ color: '#33414d' }));
  const along = (m: THREE.Mesh) => ((m.rotation.z = -Math.PI / 2), m);
  const barrel = along(new THREE.Mesh(geo(new THREE.CylinderGeometry(R, R, L, 28, 1, true)), glass));
  barrel.renderOrder = 3;
  g.add(barrel);
  // Vạch chia trên thân, vai + mũi ở −x, tai cầm ở +x.
  for (let i = 1; i < 10; i++) {
    const tick = new THREE.Mesh(geo(new THREE.BoxGeometry(0.008 * L, R * (i % 5 ? 0.35 : 0.6), 0.004 * L)), ink);
    tick.position.set(-L / 2 + (i / 10) * L, R * 0.82, R * 0.55);
    g.add(tick);
  }
  const shoulder = along(new THREE.Mesh(geo(new THREE.CylinderGeometry(R, R * 0.35, R * 0.8, 24)), dark));
  shoulder.position.x = -L / 2 - R * 0.4;
  const tipMesh = along(new THREE.Mesh(geo(new THREE.CylinderGeometry(R * 0.35, R * 0.18, R * 1.2, 16)), dark));
  tipMesh.position.x = -L / 2 - R * 1.4;
  const flange = new THREE.Mesh(geo(new THREE.BoxGeometry(R * 0.35, R * 4, R * 2.2)), dark);
  flange.position.x = L / 2;
  g.add(shoulder, tipMesh, flange);
  // Cột dịch: từ vai tới gioăng (scale x theo vị trí piston).
  const column = along(new THREE.Mesh(geo(new THREE.CylinderGeometry(R * 0.9, R * 0.9, 1, 24).translate(0, 0.5, 0)), fluid));
  column.position.x = -L / 2;
  g.add(column);
  // Cần piston: gốc ở núm đẩy; gioăng cách núm đúng một thân (−L).
  const plunger = new THREE.Group();
  const seal = along(new THREE.Mesh(geo(new THREE.CylinderGeometry(R * 0.96, R * 0.96, R * 0.5, 24)), rubber));
  seal.position.x = -L;
  const rod = along(new THREE.Mesh(geo(new THREE.CylinderGeometry(R * 0.22, R * 0.22, L, 12).translate(0, L / 2, 0)), dark));
  rod.position.x = -L;
  const thumb = along(new THREE.Mesh(geo(new THREE.CylinderGeometry(R * 1.25, R * 1.25, R * 0.3, 28)), dark));
  plunger.add(seal, rod, thumb);
  const grip = new THREE.Mesh(geo(new THREE.BoxGeometry(L * 0.42, R * 3.4, R * 3.4)), mat(new THREE.MeshBasicMaterial({ visible: false })));
  grip.position.x = -L * 0.08;
  grip.name = 'syringe-grip';
  grip.userData.noOutline = true;
  plunger.add(grip);
  g.add(plunger);
  const pushed = new THREE.Vector3(L / 2 + R * 0.4, 0, 0);
  const pulled = new THREE.Vector3(1.5 * L - R * 0.4, 0, 0);
  plunger.position.copy(pushed);
  const sync = () => {
    const len = Math.max(1e-3, plunger.position.x - L - R * 0.25 + L / 2);
    column.scale.set(1, len, 1);
    column.visible = len > 0.01 * L;
  };
  sync();
  return {
    group: g, plunger, grip, pushed, pulled,
    nozzle: new THREE.Vector3(-L / 2 - R * 2, 0, 0),
    sync,
    setFluid: (c) => void (fluid.color.set(c), fluid.emissive.set(c)),
  };
}
