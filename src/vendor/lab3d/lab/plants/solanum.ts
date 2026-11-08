import * as THREE from 'three';
import { latheFromProfile } from '../glassware/vessel';
import { createPlasticMaterial } from '../materials/factories';
import { broadLeafGeometry } from '../tissueCulture/tobacco';
import type { Tracker } from '../types';
import { mm } from '../units';

/** Họ Cà: khoai tây (Solanum tuberosum), cà chua (S. lycopersicum) và cây lai tế bào sinh dưỡng giữa hai loài. */
export type SolanumKind = 'potato' | 'tomato' | 'hybrid';

interface Look {
  leaf: string;
  /** Lá chét: dài × rộng (mm), số đôi, có lá chét nhỏ xen kẽ. */
  leaflet: [number, number];
  pairs: number;
  minor: boolean;
  petal: string | null;
  fruit: string | null;
}

const LOOK: Record<SolanumKind, Look> = {
  // Khoai tây: lá kép lông chim lẻ, lá chét trứng rộng lục đậm xen lá chét nhỏ; hoa trắng tím nhị vàng.
  potato: { leaf: '#2f6428', leaflet: [52, 32], pairs: 3, minor: true, petal: '#c9b6ea', fruit: null },
  // Cà chua: lá chét hẹp, xẻ thuỳ, lục vàng; hoa vàng, quả đỏ.
  tomato: { leaf: '#7aa53c', leaflet: [46, 21], pairs: 4, minor: false, petal: '#f2d230', fruit: '#d8452c' },
  hybrid: { leaf: '#5a8d36', leaflet: [49, 26], pairs: 3, minor: true, petal: '#e2c98a', fruit: null },
};

export interface SolanumPlant {
  group: THREE.Group;
  /** Phần cây trên mặt đất (gốc ở mặt đất chậu) – scale để cây lớn dần. */
  shoot: THREE.Group;
  leaves: THREE.Group[];
  setGrowth(k: number): void;
}

/** Lá kép lông chim: cuống chính theo +x, `pairs` đôi lá chét + lá chét ngọn. Gốc ở cuống. */
function compoundLeaf(ctx: Tracker, look: Look, mat: THREE.Material, stemMat: THREE.Material, scale: number): THREE.Group {
  const g = new THREE.Group();
  const [L, Wd] = look.leaflet;
  const len = mm(L * (look.pairs + 1) * 0.62) * scale;
  const rachis = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(1.1), mm(1.8), len, 6)), stemMat);
  rachis.rotation.z = -Math.PI / 2;
  rachis.position.x = len / 2;
  g.add(rachis);
  const geo = ctx.track(broadLeafGeometry(ctx, L * scale, Wd * scale, 0.18));
  const small = look.minor ? ctx.track(broadLeafGeometry(ctx, L * scale * 0.38, Wd * scale * 0.4, 0.1)) : null;
  const put = (x: number, side: number, gg: THREE.BufferGeometry, ang: number) => {
    const m = new THREE.Mesh(gg, mat);
    m.position.set(x, 0, 0);
    m.rotation.set(side * 0.25, side * ang, 0);
    m.castShadow = true;
    g.add(m);
  };
  for (let i = 0; i < look.pairs; i++) {
    const x = len * (0.18 + (0.72 * i) / look.pairs);
    for (const s of [1, -1]) {
      put(x, s, geo, 1.05 - 0.12 * i);
      if (small && i < look.pairs - 1) put(x + len * 0.12, s, small, 1.3);
    }
  }
  const tip = new THREE.Mesh(geo, mat);
  tip.position.x = len * 0.96;
  tip.castShadow = true;
  g.add(tip);
  return g;
}

/** Hoa sao 5 cánh (mặt hướng +y) với nhị vàng chụm giữa. */
function flower(ctx: Tracker, petal: THREE.Material, anther: THREE.Material, r: number): THREE.Group {
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rr = i % 2 ? r * 0.42 : r;
    if (i === 0) s.moveTo(rr * Math.cos(a), rr * Math.sin(a));
    else s.lineTo(rr * Math.cos(a), rr * Math.sin(a));
  }
  const g = new THREE.Group();
  const star = new THREE.Mesh(ctx.track(new THREE.ShapeGeometry(s)), petal);
  star.rotation.x = -Math.PI / 2;
  const cone = new THREE.Mesh(ctx.track(new THREE.ConeGeometry(r * 0.28, r * 0.7, 8)), anther);
  cone.position.y = r * 0.3;
  g.add(star, cone);
  return g;
}

/**
 * A-CAY-KHOAI-TAY / A-CAY-CA-CHUA / A-CAY-LAI: chậu cây họ Cà ≈ `height` mm (mặc định 300): thân, lá kép xếp xoắn 137,5°,
 * cụm hoa ở ngọn (cà chua có thêm quả). Cây lai: lá và hoa trung gian giữa hai loài. Gốc ở đáy chậu.
 */
export function createSolanumPlant(ctx: Tracker, o: { kind: SolanumKind; height?: number; pot?: boolean }): SolanumPlant {
  const look = LOOK[o.kind];
  const group = new THREE.Group();
  group.name = `solanum-${o.kind}`;
  const potH = o.pot === false ? 0 : mm(110);
  if (potH) {
    const pot = new THREE.Mesh(
      ctx.track(latheFromProfile([{ r: 0, y: 0 }, { r: mm(45), y: 0 }, { r: mm(62), y: mm(100) }, { r: mm(66), y: mm(101) }, { r: mm(66), y: potH }, { r: mm(59), y: potH }, { r: mm(59), y: mm(96) }, { r: 0, y: mm(96) }], 36)),
      ctx.track(createPlasticMaterial('#a5522f', 0.7)),
    );
    pot.castShadow = pot.receiveShadow = true;
    const soil = new THREE.Mesh(ctx.track(new THREE.CircleGeometry(mm(58), 28)), ctx.track(new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 1 })));
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = potH - mm(6);
    group.add(pot, soil);
  }
  const shoot = new THREE.Group();
  shoot.position.y = potH - mm(6);
  group.add(shoot);
  const H = mm(o.height ?? 300);
  const stemMat = ctx.track(new THREE.MeshStandardMaterial({ color: o.kind === 'potato' ? '#5f7f3e' : '#86a956', roughness: 0.6 }));
  const leafMat = ctx.track(new THREE.MeshPhysicalMaterial({ color: look.leaf, roughness: 0.55, sheen: 0.35, sheenColor: new THREE.Color('#d6ebb8'), side: THREE.DoubleSide }));
  const pts = Array.from({ length: 6 }, (_, i) => new THREE.Vector3(Math.sin(i * 1.3) * mm(6), (H * i) / 5, Math.cos(i * 1.7) * mm(4)));
  const curve = new THREE.CatmullRomCurve3(pts);
  const stem = new THREE.Mesh(ctx.track(new THREE.TubeGeometry(curve, 24, mm(5), 8)), stemMat);
  stem.castShadow = true;
  shoot.add(stem);
  const leaves: THREE.Group[] = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const k = i / (count - 1);
    const leaf = compoundLeaf(ctx, look, leafMat, stemMat, 1 - 0.4 * k);
    leaf.position.copy(curve.getPoint(0.12 + 0.8 * k));
    leaf.rotation.set(0, i * 2.4, 0.5 - 0.2 * k);
    shoot.add(leaf);
    leaves.push(leaf);
  }
  if (look.petal) {
    const petal = ctx.track(new THREE.MeshStandardMaterial({ color: look.petal, roughness: 0.5, side: THREE.DoubleSide }));
    const anther = ctx.track(new THREE.MeshStandardMaterial({ color: '#f0c419', roughness: 0.5 }));
    const top = curve.getPoint(1);
    for (let i = 0; i < 5; i++) {
      const f = flower(ctx, petal, anther, mm(11));
      const a = i * 1.26;
      f.position.set(top.x + Math.cos(a) * mm(22), top.y + mm(8 + (i % 2) * 10), top.z + Math.sin(a) * mm(22));
      f.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      shoot.add(f);
    }
  }
  if (look.fruit) {
    const fruit = ctx.track(new THREE.MeshPhysicalMaterial({ color: look.fruit, roughness: 0.25, clearcoat: 0.8 }));
    const green = ctx.track(new THREE.MeshPhysicalMaterial({ color: '#8fb34a', roughness: 0.3, clearcoat: 0.6 }));
    const ball = ctx.track(new THREE.SphereGeometry(mm(14), 16, 12));
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(ball, i === 2 ? green : fruit);
      const p = curve.getPoint(0.62 + i * 0.07);
      m.position.set(p.x + mm(30) * Math.cos(i * 2.1), p.y - mm(18), p.z + mm(30) * Math.sin(i * 2.1));
      m.scale.y = 0.85;
      m.castShadow = true;
      shoot.add(m);
    }
  }
  return {
    group,
    shoot,
    leaves,
    setGrowth(k) {
      const s = Math.max(0.001, k);
      shoot.scale.setScalar(s);
    },
  };
}
