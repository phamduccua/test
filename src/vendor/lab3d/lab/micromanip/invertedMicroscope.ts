import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { labMaterials } from '../materials/kit';
import type { SimContext } from '../../sim/types';

/**
 * A-KINH-DAO-NGUOC: kính hiển vi đảo ngược dùng cho vi thao tác (≈ 45 cm). Vật kính nằm DƯỚI bàn kính, đèn + tụ quang ở TRÊN,
 * hai thị kính chếch về phía người ngồi (+z). Gốc ở giữa đáy đế; `stageSpot` = tâm mặt bàn kính (chỗ đặt đĩa).
 */
export interface InvertedMicroscope {
  group: THREE.Group;
  stageSpot: THREE.Vector3;
  setLamp(on: boolean): void;
}

export function createInvertedMicroscope(ctx: SimContext): InvertedMicroscope {
  const mats = labMaterials(ctx);
  const body = mats.instrument();
  const black = mats.blackPaint();
  const chrome = mats.chrome();
  const g = new THREE.Group();
  g.name = 'inverted-microscope';
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(ctx.track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, r = 0.05) =>
    add(new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z);

  // Đế + khối thân sau (chứa đường quang), trụ đỡ đèn ở sau.
  box(2.3, 0.45, 3.0, body, 0, 0.225, -0.1, 0.08);
  box(1.6, 1.25, 1.3, body, 0, 1.05, -0.75);
  box(0.5, 2.6, 0.5, body, 0, 2.6, -1.3);
  // Bàn kính đen có lỗ giữa, bàn trượt cơ khí + núm ở bên phải.
  const plate = new THREE.Shape();
  plate.moveTo(-1.15, -0.85).lineTo(1.15, -0.85).lineTo(1.15, 0.85).lineTo(-1.15, 0.85).closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.22, 0, Math.PI * 2, true);
  plate.holes.push(hole);
  const stage = add(new THREE.ExtrudeGeometry(plate, { depth: 0.08, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), black, 0, 1.78, 0);
  stage.rotation.x = -Math.PI / 2;
  box(0.18, 0.1, 1.2, chrome, 0.92, 1.92, 0.1, 0.03);
  for (const y of [1.55, 1.68]) add(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 18), black, 1.22, y, 0.55).rotation.z = Math.PI / 2;
  // Mâm vật kính dưới lỗ bàn kính, 3 vật kính chĩa lên.
  const turret = add(new THREE.CylinderGeometry(0.42, 0.36, 0.12, 32), chrome, 0, 1.3, 0.05);
  turret.rotation.x = 0.25;
  [0, 2.1, 4.2].forEach((a, i) => {
    const o = add(new THREE.CylinderGeometry(0.075, 0.1, 0.34 - i * 0.04, 18), i === 0 ? chrome : black, Math.cos(a) * 0.22, 1.5, 0.05 + Math.sin(a) * 0.22);
    o.rotation.x = 0.25;
  });
  // Núm lấy nét to/nhỏ hai bên thân.
  for (const s of [1, -1]) {
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 24), black, s * 0.86, 0.8, -0.3).rotation.z = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 20), chrome, s * 0.95, 0.8, -0.3).rotation.z = Math.PI / 2;
  }
  // Tay đèn vươn từ trụ ra trên bàn kính: hộp đèn + tụ quang chĩa xuống.
  box(0.42, 0.32, 1.45, body, 0, 3.75, -0.6);
  box(0.62, 0.42, 0.62, body, 0, 4.05, -1.3);
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.75, 24), black, 0, 3.25, 0);
  const lampMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#fff7df', emissive: '#ffefc0', emissiveIntensity: 0 }));
  const lens = add(new THREE.CircleGeometry(0.13, 24), lampMat, 0, 2.87, 0);
  lens.rotation.x = Math.PI / 2;
  // Đầu quan sát: hai thị kính chếch lên, về phía người ngồi.
  box(0.95, 0.42, 0.7, body, 0, 1.25, 0.95, 0.06);
  for (const s of [1, -1]) {
    const tube = add(new THREE.CylinderGeometry(0.1, 0.11, 0.62, 20), black, s * 0.2, 1.62, 1.35);
    tube.rotation.x = 0.85;
    const eye = add(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 20), black, s * 0.2, 1.86, 1.6);
    eye.rotation.x = 0.85;
  }
  return {
    group: g,
    stageSpot: new THREE.Vector3(0, 1.88, 0),
    setLamp(on) {
      lampMat.emissiveIntensity = on ? 2.2 : 0;
    },
  };
}
