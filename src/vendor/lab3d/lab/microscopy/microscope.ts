import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { labMaterials } from '../materials/kit';
import type { SimContext } from '../../sim/types';

/** A-KINH-HIEN-VI: kính hiển vi quang học một thị kính nghiêng (≈ 33 cm), gốc ở giữa đáy đế, bàn kính hướng +z, thân ở −z. */
export interface Microscope {
  group: THREE.Group;
  /** Tâm mặt bàn kính (toạ độ của group) – chỗ đặt lam kính. */
  slideSpot: THREE.Vector3;
  setObjective(obj: 10 | 40): void;
  setLamp(on: boolean): void;
  update(dt: number): void;
}

const OBJECTIVES = [
  { mag: 4, len: 0.34, band: '#d23a2e' },
  { mag: 10, len: 0.4, band: '#e8c23a' },
  { mag: 40, len: 0.5, band: '#3a7bd5' },
];

export interface MicroscopeOptions {
  /** Màu đế: 'instrument' (mặc định, ngà như thân) hoặc 'cabinet' (xám xanh đậm – tách khỏi mặt bàn trắng trên máy chiếu). */
  base?: 'instrument' | 'cabinet';
}

export function createMicroscope(ctx: SimContext, o: MicroscopeOptions = {}): Microscope {
  const mats = labMaterials(ctx);
  const body = mats.instrument();
  const black = mats.blackPaint();
  const chrome = mats.chrome();
  const g = new THREE.Group();
  g.name = 'microscope';
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(ctx.track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  add(new RoundedBoxGeometry(1.5, 0.26, 1.9, 4, 0.08), o.base === 'cabinet' ? mats.cabinet() : body, 0, 0.13, -0.1);
  const lampMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffe7a8', emissiveIntensity: 0 }));
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.06, 32), lampMat, 0, 0.29, 0.25);

  // Thân cong: tiết diện chữ nhật bo góc chạy theo đường cong từ đế lên tới đầu kính.
  const sec = new THREE.Shape();
  sec.absarc(0, 0, 0.13, 0, Math.PI * 2, false);
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.2, -0.78),
    new THREE.Vector3(0, 1.1, -0.86),
    new THREE.Vector3(0, 2.05, -0.72),
    new THREE.Vector3(0, 2.7, -0.36),
  ]);
  const arm = add(new THREE.ExtrudeGeometry(sec, { steps: 40, bevelEnabled: false, extrudePath: path }), body, 0, 0, 0);
  arm.scale.x = 1.5;

  // Bàn kính đen có lỗ giữa + khối đỡ + kẹp lam.
  const plate = new THREE.Shape();
  plate.moveTo(-0.62, -0.6).lineTo(0.62, -0.6).lineTo(0.62, 0.6).lineTo(-0.62, 0.6).closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.11, 0, Math.PI * 2, true);
  plate.holes.push(hole);
  const stage = add(new THREE.ExtrudeGeometry(plate, { depth: 0.07, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), black, 0, 1.2, 0.15);
  stage.rotation.x = -Math.PI / 2;
  add(new THREE.BoxGeometry(0.36, 0.22, 0.5), body, 0, 1.12, -0.5);
  for (const s of [-1, 1]) {
    const clip = add(new THREE.BoxGeometry(0.06, 0.012, 0.42), chrome, s * 0.3, 1.3, 0.28);
    clip.rotation.y = s * 0.35;
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16), chrome, s * 0.36, 1.31, 0.08);
  }
  add(new THREE.CylinderGeometry(0.13, 0.15, 0.24, 28), black, 0, 1.0, 0.15);
  // Ốc to, ốc nhỏ hai bên thân.
  for (const s of [-1, 1]) {
    const coarse = add(new THREE.CylinderGeometry(0.19, 0.19, 0.07, 32), black, s * 0.27, 1.55, -0.78);
    coarse.rotation.z = Math.PI / 2;
    const fine = add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 28), black, s * 0.34, 1.55, -0.78);
    fine.rotation.z = Math.PI / 2;
  }

  // Đầu kính, ống nghiêng + thị kính hướng về phía người dùng (−z).
  add(new RoundedBoxGeometry(0.4, 0.34, 0.72, 3, 0.07), body, 0, 2.62, -0.12);
  const tube = new THREE.Group();
  tube.position.set(0, 2.78, -0.22);
  tube.rotation.x = -Math.PI / 4;
  g.add(tube);
  add(new THREE.CylinderGeometry(0.1, 0.11, 0.62, 28), body, 0, 0.31, 0, tube);
  add(new THREE.CylinderGeometry(0.085, 0.085, 0.24, 28), black, 0, 0.7, 0, tube);
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 28), black, 0, 0.83, 0, tube);

  // Mâm xoay vật kính: trục đứng ở (0, 2.4, −0.05), vật kính đang dùng quay về +z (trên tâm bàn kính).
  const turret = new THREE.Group();
  turret.position.set(0, 2.42, -0.05);
  g.add(turret);
  add(new THREE.CylinderGeometry(0.3, 0.26, 0.1, 40), chrome, 0, 0, 0, turret);
  const angles = OBJECTIVES.map((_, i) => (i * Math.PI * 2) / 3);
  OBJECTIVES.forEach((o, i) => {
    const pivot = new THREE.Group();
    pivot.rotation.y = angles[i];
    turret.add(pivot);
    const holder = new THREE.Group();
    holder.position.set(0, -0.05, 0.2);
    holder.rotation.x = 0.16;
    pivot.add(holder);
    add(new THREE.CylinderGeometry(0.075, 0.075, o.len * 0.7, 24), chrome, 0, -o.len * 0.35, 0, holder);
    add(new THREE.CylinderGeometry(0.077, 0.077, 0.03, 24), ctx.track(new THREE.MeshStandardMaterial({ color: o.band, roughness: 0.4 })), 0, -o.len * 0.3, 0, holder);
    add(new THREE.CylinderGeometry(0.045, 0.06, o.len * 0.3, 24), chrome, 0, -o.len * 0.85, 0, holder);
  });

  let target = -angles[1];
  turret.rotation.y = target;
  return {
    group: g,
    slideSpot: new THREE.Vector3(0, 1.3, 0.15),
    setObjective(obj) {
      target = -angles[obj === 40 ? 2 : 1];
    },
    setLamp(on) {
      lampMat.emissiveIntensity = on ? 2.2 : 0;
    },
    update(dt) {
      turret.rotation.y += (target - turret.rotation.y) * (1 - Math.exp(-dt * 5));
    },
  };
}
