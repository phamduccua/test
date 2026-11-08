import * as THREE from 'three';
import { createMetalMaterial } from '../materials/factories';
import type { Tracker } from '../types';

/**
 * A-KINH-HIEN-VI-CO: kính hiển vi đồng thau kiểu thập niên 1830 (≈ 34 cm) – đế móng ngựa sơn đen, trụ + khớp nghiêng, bàn kính vuông có kẹp lò xo,
 * gương lõm hắt sáng trên chạc dưới bàn kính, ống kính thẳng đứng (thị kính + vật kính) lên xuống bằng thanh răng + hai núm.
 * Gốc ở giữa đáy, người xem đứng phía +z. Đơn vị dm.
 */
export interface BrassMicroscope {
  group: THREE.Group;
  /** Tâm mặt bàn kính (toạ độ group). */
  slideSpot: THREE.Vector3;
  /** Đỉnh thị kính (toạ độ group). */
  eyepiece: THREE.Vector3;
  /** Gương: quay quanh trục x (rad) để hắt sáng từ nguồn vào lỗ bàn kính. */
  mirror: THREE.Object3D;
  /** Đưa ống kính lên/xuống (0 = sát, 1 = cao nhất), mượt. */
  setFocus(t: number): void;
  /** Đốm sáng ở lỗ bàn kính khi gương hắt đèn. */
  setLit(on: boolean): void;
  /** Hai núm thanh răng hai bên khâu dẫn (vặn = nâng/hạ ống kính): quay quanh trục núm bằng `rotation.y` (trục y cục bộ = trục núm). */
  knobs: THREE.Mesh[];
  update(dt: number): void;
}

const STAGE_Y = 1.32;

export function createBrassMicroscope(ctx: Tracker): BrassMicroscope {
  const brass = ctx.track(createMetalMaterial('#c9a45a', 0.32, 1));
  const dark = ctx.track(createMetalMaterial('#8a6a32', 0.45, 1));
  const black = ctx.track(new THREE.MeshStandardMaterial({ color: '#1c1a18', roughness: 0.35, metalness: 0.2 }));
  const glass = ctx.track(new THREE.MeshStandardMaterial({ color: '#cfe3ee', roughness: 0.05, metalness: 0.6 }));
  const g = new THREE.Group();
  g.name = 'brass-microscope';
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(ctx.track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Đế móng ngựa (mở về phía người xem để luồn gương).
  const foot = new THREE.Shape();
  foot.absarc(0, 0, 0.78, -0.95, Math.PI + 0.95, false);
  foot.absarc(0, 0, 0.42, Math.PI + 0.95, -0.95, true);
  const base = add(new THREE.ExtrudeGeometry(foot, { depth: 0.09, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 40 }), black, 0, 0.025, 0);
  base.rotation.x = Math.PI / 2;
  base.position.y = 0.115;
  // Trụ, khớp nghiêng và thân sau.
  add(new THREE.CylinderGeometry(0.075, 0.1, 0.62, 24), brass, 0, 0.42, -0.62);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 20), dark, 0, 0.78, -0.62).rotation.z = Math.PI / 2;
  add(new THREE.BoxGeometry(0.14, 1.55, 0.1), brass, 0, 1.52, -0.6);
  // Bàn kính vuông có lỗ + hai kẹp lò xo.
  const plate = new THREE.Shape();
  plate.moveTo(-0.46, -0.42).lineTo(0.46, -0.42).lineTo(0.46, 0.42).lineTo(-0.46, 0.42).closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.07, 0, Math.PI * 2, true);
  plate.holes.push(hole);
  const stage = add(new THREE.ExtrudeGeometry(plate, { depth: 0.04, bevelEnabled: false }), black, 0, STAGE_Y, -0.05);
  stage.rotation.x = -Math.PI / 2;
  stage.position.y = STAGE_Y - 0.04;
  add(new THREE.BoxGeometry(0.14, 0.12, 0.56), brass, 0, STAGE_Y - 0.1, -0.33);
  for (const s of [-1, 1]) {
    const clip = add(new THREE.BoxGeometry(0.05, 0.012, 0.3), brass, s * 0.3, STAGE_Y + 0.012, -0.12);
    clip.rotation.x = 0.06;
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12), brass, s * 0.3, STAGE_Y + 0.015, -0.27);
  }
  // Đốm sáng ở lỗ bàn kính (MeshBasic, sáng khi gương hắt đèn).
  const spotMat = ctx.track(new THREE.MeshBasicMaterial({ color: '#fff3c8', toneMapped: false, transparent: true, opacity: 0 }));
  const spot = add(new THREE.CircleGeometry(0.068, 32), spotMat, 0, STAGE_Y + 0.001, -0.05);
  spot.rotation.x = -Math.PI / 2;
  spot.castShadow = false;

  // Gương lõm trên chạc (yoke) dưới bàn kính.
  const yoke = new THREE.Group();
  yoke.position.set(0, 0.62, -0.05);
  g.add(yoke);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 10), brass, 0, 0.0, -0.3, yoke).rotation.x = Math.PI / 2;
  const fork = add(new THREE.TorusGeometry(0.2, 0.018, 8, 32, Math.PI), brass, 0, 0, 0, yoke);
  fork.rotation.x = Math.PI / 2;
  const mirror = new THREE.Group();
  yoke.add(mirror);
  add(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 40), brass, 0, 0, 0, mirror);
  add(new THREE.SphereGeometry(0.19, 40, 8, 0, Math.PI * 2, 0, 0.35), glass, 0, -0.16, 0, mirror);
  mirror.rotation.x = 0.35;

  // Ống kính: trượt lên xuống trong khâu dẫn ở đầu thân.
  const tube = new THREE.Group();
  g.add(tube);
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 28), dark, 0, 2.2, -0.45);
  add(new THREE.BoxGeometry(0.1, 0.08, 0.3), brass, 0, 2.2, -0.52);
  // Mỗi núm nằm trong một khớp đã xoay trục y → trục núm (nằm ngang): `rotation.y` của núm = quay quanh chính trục của nó.
  const knobs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.11, 2.05, -0.5);
    pivot.rotation.z = Math.PI / 2;
    g.add(pivot);
    return add(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20), dark, 0, 0, 0, pivot);
  });
  const lathe = (pts: [number, number][]) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 40);
  add(lathe([[0, 0], [0.035, 0], [0.05, 0.05], [0.06, 0.14], [0.08, 0.17], [0.08, 0.22]]), brass, 0, STAGE_Y + 0.14, -0.05, tube);
  add(new THREE.CylinderGeometry(0.075, 0.075, 1.15, 32, 1, true), brass, 0, STAGE_Y + 0.93, -0.05, tube);
  add(new THREE.TorusGeometry(0.08, 0.014, 8, 32), dark, 0, STAGE_Y + 0.38, -0.05, tube).rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.08, 0.014, 8, 32), dark, 0, STAGE_Y + 1.48, -0.05, tube).rotation.x = Math.PI / 2;
  add(lathe([[0.065, 0], [0.068, 0.2], [0.09, 0.22], [0.09, 0.27], [0.05, 0.28], [0, 0.28]]), brass, 0, STAGE_Y + 1.5, -0.05, tube);
  add(new THREE.CircleGeometry(0.045, 24), glass, 0, STAGE_Y + 1.785, -0.05, tube).rotation.x = -Math.PI / 2;
  // Vật kính có thấu kính nhỏ ở đầu.
  add(new THREE.CircleGeometry(0.03, 20), glass, 0, STAGE_Y + 0.139, -0.05, tube).rotation.x = Math.PI / 2;

  let focus = 0.3;
  let target = 0.3;
  let lit = 0;
  let litTarget = 0;
  const place = () => (tube.position.y = 0.06 + focus * 0.2);
  place();
  return {
    group: g,
    slideSpot: new THREE.Vector3(0, STAGE_Y + 0.004, -0.05),
    eyepiece: new THREE.Vector3(0, STAGE_Y + 1.85, -0.05),
    mirror,
    knobs,
    setFocus(t) {
      target = THREE.MathUtils.clamp(t, 0, 1);
    },
    setLit(on) {
      litTarget = on ? 1 : 0;
    },
    update(dt) {
      const k = 1 - Math.exp(-dt * 5);
      focus += (target - focus) * k;
      lit += (litTarget - lit) * k;
      spotMat.opacity = 0.9 * lit;
      place();
    },
  };
}
