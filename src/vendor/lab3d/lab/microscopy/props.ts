import * as THREE from 'three';
import { createRazorBlade } from '../handTools/razorBlade';
import { mm } from '../units';
import type { SimContext } from '../../sim/types';

/** A-LA-THAI-LAI: lá thài lài tía hình mác (≈ 13 × 3 cm), tím hai mặt, hơi cong; gốc ở giữa lá, dài theo x. */
export function createLeaf(ctx: SimContext): THREE.Group {
  const g = new THREE.Group();
  g.name = 'leaf';
  const len = mm(130);
  const half = mm(16);
  const sh = new THREE.Shape();
  const N = 30;
  const edge = (t: number) => half * Math.pow(Math.sin(Math.PI * t), 0.8) * (1 - 0.25 * t);
  sh.moveTo(-len / 2, 0);
  for (let i = 1; i <= N; i++) sh.lineTo(-len / 2 + (len * i) / N, edge(i / N));
  for (let i = N - 1; i >= 1; i--) sh.lineTo(-len / 2 + (len * i) / N, -edge(i / N));
  sh.closePath();
  const geo = ctx.track(new THREE.ShapeGeometry(sh, 6));
  geo.rotateX(-Math.PI / 2);
  // Uốn: mép lá cong lên, chóp lá hơi võng xuống bàn.
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setY(i, mm(4) + (z / half) ** 2 * mm(5) - ((x / (len / 2)) ** 2) * mm(3.5));
  }
  geo.computeVertexNormals();
  const top = ctx.track(new THREE.MeshPhysicalMaterial({ color: '#5c2a6e', roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color('#c79ad8'), side: THREE.FrontSide }));
  const under = ctx.track(new THREE.MeshPhysicalMaterial({ color: '#8d3fa6', roughness: 0.6, side: THREE.BackSide }));
  g.add(new THREE.Mesh(geo, top), new THREE.Mesh(geo, under));
  const rib = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(1), mm(1.6), len * 0.92, 8)), top);
  rib.rotation.z = Math.PI / 2;
  rib.position.y = mm(4);
  g.add(rib);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

/** A-DAO-LAM: lưỡi dao lam (≈ 43 × 22 mm), rãnh giữa + dải màu in. Gốc ở tâm, nằm phẳng. Bản đầy đủ: createRazorBlade. */
export function createRazor(ctx: SimContext): THREE.Group {
  return createRazorBlade(ctx).group;
}

/** A-GIAY-THAM: dải giấy thấm (≈ 40 × 15 mm); `setWet(0…1)` loang ẩm từ một đầu. Gốc ở tâm. */
export function createBlotter(ctx: SimContext): { mesh: THREE.Mesh; setWet(w: number): void } {
  const mat = ctx.track(new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.95 }));
  const mesh = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(40), mm(0.5), mm(15))), mat);
  mesh.name = 'blotter';
  mesh.castShadow = true;
  const dry = new THREE.Color('#f4efe6');
  const wet = new THREE.Color('#c9c3b6');
  return { mesh, setWet: (w) => mat.color.copy(dry).lerp(wet, Math.min(1, w)) };
}
