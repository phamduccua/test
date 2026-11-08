import * as THREE from 'three';
import { mm } from '../units';
import type { Tracker } from '../types';

/** A-CU-HANH-RE: củ hành tây có chùm rễ trắng; đặt lên miệng cốc để rễ ngập nước. Gốc = đĩa thân (đáy củ), rễ mọc về −y. */
export interface OnionBulb {
  group: THREE.Group;
  /** Đầu rễ phồng (0 = bình thường, 1 = phồng gấp ~2,2 lần – c-tumour khi xử lí colchicine lâu). */
  setSwell(k: number): void;
  /** Độ dài rễ (tỉ lệ 0,3…1,5 so với mặc định). */
  setRootLength(k: number): void;
  /** Đầu rễ phía trước (+z) để cắt: điểm neo con của group, ở chóp rễ. */
  tipAnchor: THREE.Object3D;
}

export interface OnionBulbOptions {
  roots?: number;
  /** Chiều dài rễ trung bình (mm). */
  rootLength?: number;
  seed?: number;
  /** Màu vỏ lụa. */
  skin?: THREE.ColorRepresentation;
}

const P = (r: number, y: number) => new THREE.Vector2(mm(r), mm(y));
const OUTLINE = [P(0, 0), P(11, 0), P(14, 2), P(24, 7), P(33, 16), P(37, 27), P(36, 38), P(31, 50), P(21, 62), P(10, 71), P(5, 78), P(3, 86), P(0, 88)];

export function createOnionBulb(ctx: Tracker, o: OnionBulbOptions = {}): OnionBulb {
  const group = new THREE.Group();
  group.name = 'onion-bulb';
  const skin = ctx.track(new THREE.MeshPhysicalMaterial({ color: o.skin ?? '#b5763a', roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color('#f3c98d'), clearcoat: 0.25 }));
  const body = new THREE.Mesh(ctx.track(new THREE.LatheGeometry(OUTLINE, 48)), skin);
  group.add(body);
  const vein = ctx.track(new THREE.MeshStandardMaterial({ color: '#8c5427', roughness: 0.7 }));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const pts = OUTLINE.slice(2, 11).map((p) => new THREE.Vector3(Math.cos(a) * p.x * 1.004, p.y, Math.sin(a) * p.x * 1.004));
    group.add(new THREE.Mesh(ctx.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, mm(0.35), 4)), vein));
  }
  const plate = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(12), mm(10), mm(4), 24)), ctx.track(new THREE.MeshStandardMaterial({ color: '#d8c7a0', roughness: 0.9 })));
  plate.position.y = -mm(1);
  group.add(plate);

  // Chùm rễ: mỗi rễ là ống cong + chóp tròn (đầu rễ hơi vàng ngà – mô phân sinh đặc tế bào chất).
  const rootMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#f2ecda', roughness: 0.6 }));
  const tipMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#efe1b8', roughness: 0.55 }));
  const tipGeo = ctx.track(new THREE.SphereGeometry(1, 12, 8));
  const roots = new THREE.Group();
  group.add(roots);
  const tips: THREE.Mesh[] = [];
  let seed = o.seed ?? 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const n = o.roots ?? 22;
  const base = o.rootLength ?? 40;
  const tipAnchor = new THREE.Object3D();
  for (let i = 0; i <= n; i++) {
    // Rễ cuối cùng là rễ thẳng phía trước (+z) dùng để cắt.
    const front = i === n;
    const a = front ? Math.PI / 2 : (i / n) * Math.PI * 2 + rnd() * 0.3;
    if (!front && Math.abs(Math.sin(a) - 1) < 0.2) continue;
    const r0 = front ? mm(8) : mm(3 + rnd() * 7);
    const len = front ? mm(base * 1.05) : mm(base * (0.75 + rnd() * 0.6));
    const spread = front ? 0 : mm(6 + rnd() * 14);
    const rad = mm(0.55 + (front ? 0.1 : rnd() * 0.2));
    const pts = [0, 0.35, 0.7, 1].map((t) => new THREE.Vector3(Math.cos(a) * (r0 + spread * t * t), -mm(2) - len * t, Math.sin(a) * (r0 + spread * t * t)));
    const curve = new THREE.CatmullRomCurve3(pts);
    roots.add(new THREE.Mesh(ctx.track(new THREE.TubeGeometry(curve, 16, rad, 6)), rootMat));
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.copy(pts[3]);
    tip.scale.set(rad * 1.05, rad * 1.6, rad * 1.05);
    tip.userData.rad = rad;
    tips.push(tip);
    roots.add(tip);
    if (front) {
      tipAnchor.position.copy(pts[3]);
      roots.add(tipAnchor);
    }
  }
  group.traverse((x) => (x.castShadow = true));
  return {
    group,
    tipAnchor,
    setSwell(k) {
      const f = 1 + 1.2 * Math.max(0, Math.min(1, k));
      for (const t of tips) {
        const r = t.userData.rad as number;
        t.scale.set(r * 1.05 * f, r * (1.6 + 0.6 * (f - 1)), r * 1.05 * f);
      }
    },
    setRootLength(k) {
      roots.scale.y = k;
    },
  };
}
