import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { labMaterials } from '../materials/kit';
import type { SimContext } from '../../sim/types';

/**
 * A-KINH-SOI-NOI: kính hiển vi soi nổi (≈ 40 cm) dùng cho vi thao tác trên đĩa petri. Gốc ở giữa đáy đế; mặt soi (kính mờ có đèn đáy)
 * hướng +z, cột ở −z; đầu kính hai thị kính nghiêng về phía người dùng (+z). `stageSpot` = tâm mặt kính mờ.
 */
export interface StereoMicroscope {
  group: THREE.Group;
  stageSpot: THREE.Vector3;
  setLamp(on: boolean): void;
}

export function createStereoMicroscope(ctx: SimContext): StereoMicroscope {
  const mats = labMaterials(ctx);
  const body = mats.instrument();
  const black = mats.blackPaint();
  const chrome = mats.chrome();
  const g = new THREE.Group();
  g.name = 'stereo-microscope';
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(ctx.track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // Đế hộp có đèn chiếu từ dưới lên qua tấm kính mờ.
  add(new RoundedBoxGeometry(2.0, 0.34, 2.5, 4, 0.08), body, 0, 0.17, -0.1);
  const lampMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#c3cbd1', roughness: 0.7, emissive: '#fff6dc', emissiveIntensity: 0 }));
  const SPOT = new THREE.Vector3(0, 0.355, 0.3);
  add(new THREE.CylinderGeometry(0.62, 0.62, 0.02, 48), lampMat, SPOT.x, SPOT.y - 0.01, SPOT.z);
  add(new THREE.TorusGeometry(0.63, 0.025, 8, 48).rotateX(Math.PI / 2), black, SPOT.x, SPOT.y - 0.005, SPOT.z);
  // Kẹp mẫu hai bên.
  for (const s of [-1, 1]) {
    const clip = add(new THREE.BoxGeometry(0.42, 0.012, 0.07), chrome, s * 0.72, SPOT.y + 0.01, SPOT.z - 0.1);
    clip.rotation.y = s * 0.35;
  }
  // Công tắc + núm chỉnh độ sáng ở mặt trước đế.
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 20).rotateX(Math.PI / 2), black, 0.72, 0.17, 1.16);
  // Cột + khối chỉnh tiêu cự trượt trên cột.
  add(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 28), chrome, 0, 1.9, -0.95);
  add(new RoundedBoxGeometry(0.42, 0.62, 0.5, 3, 0.05), body, 0, 2.55, -0.82);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 28).rotateZ(Math.PI / 2), black, s * 0.27, 2.45, -0.75);
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20).rotateZ(Math.PI / 2), chrome, s * 0.35, 2.45, -0.75);
  }
  // Tay đỡ vươn ra phía trước, ôm thân vật kính.
  add(new RoundedBoxGeometry(0.34, 0.24, 1.0, 3, 0.05), body, 0, 2.6, -0.25);
  add(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 40), body, 0, 2.55, 0.3);
  // Thân zoom + vật kính hướng xuống.
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.36, 40), black, 0, 2.15, 0.3);
  add(new THREE.CylinderGeometry(0.2, 0.24, 0.22, 36), body, 0, 1.87, 0.3);
  add(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 30), mats.blackRubber(), 0, 1.755, 0.3);
  // Vòng zoom có vạch.
  add(new THREE.TorusGeometry(0.31, 0.03, 8, 40).rotateX(Math.PI / 2), mats.plastic('blue'), 0, 2.25, 0.3);
  // Đầu kính hai thị kính nghiêng 45°.
  const head = new THREE.Group();
  head.position.set(0, 2.92, 0.25);
  head.rotation.x = -0.75;
  g.add(head);
  add(new RoundedBoxGeometry(0.62, 0.28, 0.36, 3, 0.06), body, 0, 0, 0, head);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.075, 0.08, 0.5, 24), black, s * 0.16, 0.3, 0, head);
    add(new THREE.CylinderGeometry(0.095, 0.095, 0.1, 24), mats.blackRubber(), s * 0.16, 0.58, 0, head);
  }
  return {
    group: g,
    stageSpot: SPOT.clone(),
    setLamp(on) {
      lampMat.emissiveIntensity = on ? 1.1 : 0;
    },
  };
}
