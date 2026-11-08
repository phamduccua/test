import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface TubeRack {
  group: THREE.Group;
  /** Vị trí đáy ống nghiệm tại mỗi lỗ (toạ độ cục bộ của giá). */
  slots: THREE.Vector3[];
}

/** Tấm gỗ có lỗ tròn (ExtrudeGeometry), nằm ngang, mặt dưới ở y = 0. */
function plank(len: number, depth: number, thick: number, holes: number[], holeR: number): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  const r = mm(4);
  s.moveTo(-len / 2 + r, -depth / 2);
  s.lineTo(len / 2 - r, -depth / 2);
  s.quadraticCurveTo(len / 2, -depth / 2, len / 2, -depth / 2 + r);
  s.lineTo(len / 2, depth / 2 - r);
  s.quadraticCurveTo(len / 2, depth / 2, len / 2 - r, depth / 2);
  s.lineTo(-len / 2 + r, depth / 2);
  s.quadraticCurveTo(-len / 2, depth / 2, -len / 2, depth / 2 - r);
  s.lineTo(-len / 2, -depth / 2 + r);
  s.quadraticCurveTo(-len / 2, -depth / 2, -len / 2 + r, -depth / 2);
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
  // UV gỗ: ExtrudeGeometry dùng toạ độ thế giới làm UV → co lại để vân gỗ to vừa phải.
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.2, uv.getY(i) * 2.2);
  return geo;
}

/** A-GIA-ONG-NGHIEM – giá gỗ 2 tầng, `slots` lỗ Ø21 bước 30 mm. */
export function createTubeRack(ctx: Tracker, o: { slots?: number; pitch?: number } = {}): TubeRack {
  const n = o.slots ?? 6;
  const pitch = o.pitch ?? mm(30);
  const len = n * pitch + mm(24);
  const depth = mm(66);
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch);
  const wood = labMaterials(ctx).wood();
  const group = new THREE.Group();
  group.name = 'tube-rack';
  const add = (geo: THREE.BufferGeometry, y: number) => {
    const m = new THREE.Mesh(geo, wood);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  };
  add(plank(len, depth, mm(10), [], 0), 0);
  add(plank(len, depth * 0.62, mm(8), xs, mm(10.5)), mm(42));
  add(plank(len, depth * 0.62, mm(9), xs, mm(10.5)), mm(84));
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(mm(12), mm(92), depth * 0.62), wood);
    post.position.set(side * (len / 2 - mm(6)), mm(46) + mm(8), 0);
    post.castShadow = post.receiveShadow = true;
    group.add(post);
  }
  const slots = xs.map((x) => new THREE.Vector3(x, mm(10.6), 0));
  return { group, slots };
}
