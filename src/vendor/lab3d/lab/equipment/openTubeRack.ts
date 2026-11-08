import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface OpenTubeRack {
  group: THREE.Group;
  /** Vị trí đáy ống nghiệm tại mỗi lỗ (toạ độ cục bộ của giá). */
  slots: THREE.Vector3[];
}

/** Tấm gỗ bo góc có lỗ tròn, nằm ngang, mặt dưới ở y = 0. */
function plank(len: number, depth: number, thick: number, holes: number[], holeR: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  const r = mm(4);
  const [x0, x1, z0, z1] = [-len / 2, len / 2, -depth / 2, depth / 2];
  s.moveTo(x0 + r, z0);
  s.lineTo(x1 - r, z0);
  s.quadraticCurveTo(x1, z0, x1, z0 + r);
  s.lineTo(x1, z1 - r);
  s.quadraticCurveTo(x1, z1, x1 - r, z1);
  s.lineTo(x0 + r, z1);
  s.quadraticCurveTo(x0, z1, x0, z1 - r);
  s.lineTo(x0, z0 + r);
  s.quadraticCurveTo(x0, z0, x0 + r, z0);
  for (const x of holes) {
    const h = new THREE.Path();
    h.absarc(x, 0, holeR, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: mm(0.8),
    bevelSize: mm(0.8),
    bevelSegments: 2,
    curveSegments: 20,
  });
  geo.rotateX(-Math.PI / 2);
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.2, uv.getY(i) * 2.2);
  return geo;
}

/**
 * Giá ống nghiệm "thoáng": đế gỗ có hõm nông + MỘT tấm đỡ lỗ ở cao `holdY` (mặc định 78 mm), hai trụ bên.
 * Khác createTubeRack (2 tầng lỗ): phần dưới ống để trống hoàn toàn → nhìn rõ màu/lớp chất lỏng.
 */
export function createOpenTubeRack(
  ctx: Tracker,
  o: { slots?: number; pitch?: number; holdY?: number } = {},
): OpenTubeRack {
  const n = o.slots ?? 6;
  const pitch = o.pitch ?? mm(30);
  const holdY = o.holdY ?? mm(78);
  const len = n * pitch + mm(24);
  const depth = mm(62);
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch);
  const wood = labMaterials(ctx).wood();
  const group = new THREE.Group();
  group.name = 'open-tube-rack';
  const add = (geo: THREE.BufferGeometry, y: number) => {
    const m = new THREE.Mesh(geo, wood);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(plank(len, depth, mm(10), [], 0), 0);
  // Hõm đặt đáy ống: vòng gỗ sẫm nông trên mặt đế.
  const ringMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.9 }));
  for (const x of xs) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(mm(4.5), mm(8.5), 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, mm(10.9), 0);
    group.add(ring);
  }
  add(plank(len, depth * 0.6, mm(9), xs, mm(10)), holdY);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(mm(12), holdY + mm(9) - mm(10), depth * 0.6), wood);
    post.position.set(side * (len / 2 - mm(6)), mm(10) + (holdY + mm(9) - mm(10)) / 2, 0);
    post.castShadow = post.receiveShadow = true;
    group.add(post);
  }
  const slots = xs.map((x) => new THREE.Vector3(x, mm(10.9), 0));
  return { group, slots };
}
