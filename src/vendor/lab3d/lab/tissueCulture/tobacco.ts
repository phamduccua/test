import * as THREE from 'three';
import { latheFromProfile } from '../glassware/vessel';
import { createPlasticMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';

/** Phiến lá hình trứng (dài theo +x từ cuống ở gốc), mép hơi gợn, uốn cong võng xuống; hai mặt. */
export function broadLeafGeometry(ctx: Tracker, length = 180, width = 100, droop = 0.25): THREE.BufferGeometry {
  const L = mm(length);
  const half = mm(width / 2);
  const N = 28;
  const edge = (t: number) => half * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.75) * (1 - 0.35 * t) * (1 + 0.04 * Math.sin(t * 40));
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  for (let i = 1; i <= N; i++) s.lineTo((L * i) / N, edge(i / N));
  for (let i = N - 1; i >= 1; i--) s.lineTo((L * i) / N, -edge(i / N));
  s.closePath();
  const geo = ctx.track(new THREE.ShapeGeometry(s, 8));
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / L;
    const z = p.getZ(i) / half;
    p.setY(i, -droop * L * x * x + Math.abs(z) * mm(6) * x);
  }
  geo.computeVertexNormals();
  return geo;
}

export function leafMaterials(ctx: Tracker, color = '#4f8f3a') {
  const top = ctx.track(new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#cfe8b0'), side: THREE.DoubleSide }));
  const vein = ctx.track(new THREE.MeshStandardMaterial({ color: '#b9d48f', roughness: 0.6 }));
  return { top, vein };
}

/** Lá kèm gân giữa (gốc ở cuống, dài theo +x). */
export function createBroadLeaf(ctx: Tracker, o: { length?: number; width?: number; droop?: number; color?: string } = {}): THREE.Group {
  const g = new THREE.Group();
  const L = mm(o.length ?? 180);
  const { top, vein } = leafMaterials(ctx, o.color);
  const droop = o.droop ?? 0.25;
  const blade = new THREE.Mesh(broadLeafGeometry(ctx, o.length, o.width, droop), top);
  blade.castShadow = true;
  g.add(blade);
  const pts = Array.from({ length: 9 }, (_, i) => new THREE.Vector3((L * i) / 8, -droop * L * (i / 8) ** 2 + mm(0.8), 0));
  g.add(new THREE.Mesh(ctx.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, mm(1.6), 6)), vein));
  return g;
}

/**
 * A-CAY-THUOC-LA: chậu cây thuốc lá (Nicotiana tabacum) non ≈ 45 cm: thân, 9 lá to hình trứng xếp xoắn, cụm nụ và hoa hồng ống dài ở ngọn.
 * Gốc ở đáy chậu. `leaves[i]` (gốc ở cuống) để lấy vị trí lá; `buds` = cụm nụ (lấy bao phấn).
 */
export function createTobaccoPlant(ctx: Tracker): { group: THREE.Group; leaves: THREE.Group[]; buds: THREE.Group; stemTop: THREE.Vector3 } {
  const group = new THREE.Group();
  group.name = 'tobacco-plant';
  const potMat = ctx.track(createPlasticMaterial('#a5522f', 0.7));
  const pot = new THREE.Mesh(
    ctx.track(latheFromProfile([{ r: 0, y: 0 }, { r: mm(55), y: 0 }, { r: mm(75), y: mm(130) }, { r: mm(80), y: mm(132) }, { r: mm(80), y: mm(145) }, { r: mm(72), y: mm(145) }, { r: mm(72), y: mm(130) }, { r: 0, y: mm(130) }], 40)),
    potMat,
  );
  pot.castShadow = pot.receiveShadow = true;
  const soil = new THREE.Mesh(ctx.track(new THREE.CircleGeometry(mm(71), 32)), ctx.track(new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 1 })));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = mm(135);
  group.add(pot, soil);
  const H = mm(330);
  const stemTop = new THREE.Vector3(0, mm(135) + H, 0);
  const stemMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#7fa65a', roughness: 0.6 }));
  const stem = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(5), mm(9), H, 12)), stemMat);
  stem.position.y = mm(135) + H / 2;
  stem.castShadow = true;
  group.add(stem);
  const leaves: THREE.Group[] = [];
  for (let i = 0; i < 9; i++) {
    const k = i / 8;
    const leaf = createBroadLeaf(ctx, { length: 200 - 90 * k, width: 115 - 50 * k, droop: 0.35 - 0.15 * k });
    leaf.position.y = mm(150) + H * 0.85 * k;
    leaf.rotation.set(0, i * 2.4, 0.35 + 0.25 * k);
    group.add(leaf);
    leaves.push(leaf);
  }
  // Cụm hoa: nụ xanh hình thoi + vài hoa hồng ống loe.
  const buds = new THREE.Group();
  buds.position.copy(stemTop);
  group.add(buds);
  const budMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#9cbc6b', roughness: 0.6 }));
  const petal = ctx.track(new THREE.MeshStandardMaterial({ color: '#e98fb0', roughness: 0.5, side: THREE.DoubleSide }));
  const budGeo = ctx.track(new THREE.CapsuleGeometry(mm(4), mm(16), 4, 10));
  const tubeGeo = ctx.track(latheFromProfile([{ r: mm(3), y: 0 }, { r: mm(4), y: mm(30) }, { r: mm(14), y: mm(42) }, { r: mm(15), y: mm(43) }], 20));
  for (let i = 0; i < 9; i++) {
    const a = i * 2.2;
    const tilt = 0.35 + 0.08 * (i % 3);
    const stalk = new THREE.Group();
    stalk.rotation.set(Math.sin(a) * tilt, 0, Math.cos(a) * tilt);
    buds.add(stalk);
    const flower = i % 3 === 0;
    const m = new THREE.Mesh(flower ? tubeGeo : budGeo, flower ? petal : budMat);
    m.position.y = flower ? mm(8) : mm(20);
    m.castShadow = true;
    stalk.add(m);
  }
  return { group, leaves, buds, stemTop };
}
