import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

/**
 * A-MO-HINH-MIENG: mô hình khoang miệng học tập (≈ 1,5 lần thật) trên đế nhựa – lợi và hàm răng trên/dưới, lưỡi,
 * thành má hai bên + họng (vỏ trụ hở phía trước và hở nóc để nhìn vào), mép môi. Gốc ở giữa đáy đế, miệng hướng +z.
 */
export interface MouthModel {
  group: THREE.Group;
  /** Điểm trên mặt trong má trái (−x), toạ độ cục bộ – nơi cạo lấy tế bào niêm mạc. */
  cheek: THREE.Vector3;
  /** Pháp tuyến mặt trong má tại `cheek` (hướng vào khoang miệng). */
  cheekNormal: THREE.Vector3;
}

const R = 40;
const BOTTOM = 10;
const H = 50;

export function createMouthModel(ctx: Tracker): MouthModel {
  const group = new THREE.Group();
  group.name = 'mouth-model';
  const mat = (color: string, roughness: number, side: THREE.Side = THREE.FrontSide, clearcoat = 0) =>
    ctx.track(new THREE.MeshPhysicalMaterial({ color, roughness, side, clearcoat, clearcoatRoughness: 0.15 }));
  const mucosa = mat('#d8616f', 0.3, THREE.BackSide, 0.7);
  const skin = mat('#e6b7a2', 0.6);
  const gum = mat('#e58b97', 0.35, THREE.FrontSide, 0.5);
  const tooth = mat('#f3eedf', 0.25, THREE.FrontSide, 0.4);
  const tongue = mat('#cf6a77', 0.4, THREE.FrontSide, 0.5);
  const lip = mat('#c44d5c', 0.35, THREE.FrontSide, 0.4);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(ctx.track(geo), m);
    o.position.set(mm(x), mm(y), mm(z));
    o.castShadow = true;
    o.receiveShadow = true;
    group.add(o);
    return o;
  };

  add(new RoundedBoxGeometry(mm(104), mm(BOTTOM), mm(100), 3, mm(3)), labMaterials(ctx).whitePlastic(), 0, BOTTOM / 2, -4);
  // Thành má + họng: vỏ trụ hở cung trước ±45°. CylinderGeometry: x = r·sinθ, z = r·cosθ (θ = 0 là phía trước).
  const shell = new THREE.CylinderGeometry(mm(R), mm(R), mm(H), 64, 4, true, Math.PI / 4, Math.PI * 1.5);
  add(shell, skin, 0, BOTTOM + H / 2, 0);
  add(shell.clone(), mucosa, 0, BOTTOM + H / 2, 0);
  // Mép trên/dưới của vỏ và hai mép môi ở cửa miệng.
  [BOTTOM + 1.5, BOTTOM + H].forEach((y) => {
    const rim = add(new THREE.TorusGeometry(mm(R), mm(2.6), 10, 72, Math.PI * 1.5).rotateX(Math.PI / 2), y > 20 ? skin : lip, 0, y, 0);
    rim.rotation.y = -Math.PI * 0.75;
  });
  [Math.PI / 4, -Math.PI / 4].forEach((t) => add(new THREE.CapsuleGeometry(mm(3), mm(H - 4), 6, 14), lip, R * Math.sin(t), BOTTOM + H / 2, R * Math.cos(t)));

  // Cung hàm chữ U: x = 24t, z = 20 − 40t² (t ∈ [−1, 1]).
  const arch = (t: number, y: number) => new THREE.Vector3(mm(24 * t), mm(y), mm(20 - 40 * t * t));
  const archCurve = (y: number) => new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => arch(-1 + i / 6, y)));
  [BOTTOM + 9, BOTTOM + H - 9].forEach((y, k) => {
    const g = add(new THREE.TubeGeometry(archCurve(0), 48, mm(6), 12, false), gum, 0, y, 0);
    g.scale.y = 0.8;
    // Răng: cửa mỏng ở trước, hàm to ở sau; mọc lên (hàm dưới) hoặc chĩa xuống (hàm trên).
    for (let i = 0; i < 14; i++) {
      const t = -0.93 + (i / 13) * 1.86;
      const a = Math.abs(t);
      const w = a < 0.3 ? 6 : a < 0.6 ? 6.5 : 8.5;
      const d = a < 0.3 ? 3.6 : a < 0.6 ? 6 : 8.5;
      const h = a < 0.3 ? 9 : 7.5;
      const p = arch(t, 0);
      const o = add(new RoundedBoxGeometry(mm(w), mm(h), mm(d), 2, mm(1.4)), tooth, 0, 0, 0);
      o.position.set(p.x, mm(y + (k ? -1 : 1) * (4 + h / 2)), p.z);
      o.rotation.y = Math.atan2(80 * t, 24);
    }
  });
  const tg = add(new THREE.SphereGeometry(1, 28, 18), tongue, 0, BOTTOM + 14, -2);
  tg.scale.set(mm(17), mm(7), mm(24));

  return {
    group,
    cheek: new THREE.Vector3(-mm(R - 1.5), mm(BOTTOM + H / 2 + 2), mm(2)),
    cheekNormal: new THREE.Vector3(1, 0, 0),
  };
}
