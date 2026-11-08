import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

/**
 * A-KEP-GO – kẹp gỗ ống nghiệm dài 190 mm: 2 thanh gỗ + lò xo xoắn thép.
 * Nằm dọc trục +x (đầu kẹp ở x = 0), gốc ở mặt dưới.
 */
export function createTubeHolder(ctx: Tracker): THREE.Group {
  const mats = labMaterials(ctx);
  const g = new THREE.Group();
  g.name = 'tube-holder';
  const L = mm(190);
  const barGeo = new THREE.BoxGeometry(L, mm(7), mm(11));
  barGeo.translate(L / 2, mm(3.5), 0);
  const lower = new THREE.Mesh(barGeo, mats.wood());
  const upper = new THREE.Mesh(barGeo, mats.wood());
  upper.position.y = mm(7.5);
  upper.rotation.z = -0.035;
  upper.position.x = mm(0);
  // Má kẹp cong ở đầu
  for (const [y, s] of [
    [mm(3), -1],
    [mm(12), 1],
  ] as const) {
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(mm(9), mm(3), 8, 16, Math.PI), mats.wood());
    jaw.rotation.x = 0;
    jaw.rotation.z = s > 0 ? 0 : Math.PI;
    jaw.position.set(mm(-6), y + s * mm(1), 0);
    jaw.scale.z = 1.6;
    g.add(jaw);
  }
  // Lò xo xoắn
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2 * 6;
    pts.push(new THREE.Vector3(mm(108) + (i / 96) * mm(22), mm(7) + Math.cos(a) * mm(8), Math.sin(a) * mm(8)));
  }
  const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 192, mm(0.9), 6), mats.steel());
  g.add(lower, upper, spring);
  g.traverse((o) => (o.castShadow = true));
  return g;
}
