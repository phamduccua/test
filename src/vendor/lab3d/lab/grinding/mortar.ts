import * as THREE from 'three';
import { chaikin, densify } from '../glassware/curves';
import { buildProfile, type VesselProfile } from '../glassware/profile';
import { latheFromProfile } from '../glassware/vessel';
import { createLiquid, type Liquid } from '../liquid/liquid';
import { labMaterials } from '../materials/kit';
import { LAB_PALETTE } from '../materials/palette';
import type { P2, Tracker } from '../types';
import { mm } from '../units';

/**
 * A-COI-CHAY – cối chày sứ Ø 92 mm (gốc = giữa đáy cối) có mẫu mô (gan: miếng nâu đỏ; lá: mảnh lá xanh) và dịch nghiền.
 * `setGrind(p)` 0…1: mẫu vụn nhỏ dần; `pestlePose(phase, depth)` trả tư thế chày khi nghiền tròn (sim tự gán/hoạt cảnh).
 */
export interface Mortar {
  group: THREE.Group;
  profile: VesselProfile;
  liquid: Liquid;
  pestle: THREE.Group;
  /** Đặt mẫu mới vào cối: miếng mô (gan) hoặc mảnh lá. */
  setSample(kind: 'tissue' | 'leaf', color?: THREE.ColorRepresentation): void;
  setGrind(p: number): void;
  /** Vị trí + góc chày tại pha `phase` (rad) khi nghiền, toạ độ cục bộ của cối. */
  pestlePose(phase: number): { pos: THREE.Vector3; rot: THREE.Euler };
  /** Mép rót (cục bộ, phía −x). */
  lip: THREE.Vector3;
}

const P = (r: number, y: number): P2 => ({ r: mm(r), y: mm(y) });

function lumpGeometry(seed: number, r: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 2);
  const pos = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + 0.18 * Math.sin(v.x * 900 + seed) * Math.cos(v.z * 700 - seed * 2) + 0.1 * Math.sin(v.y * 1300 + seed * 3);
    v.multiplyScalar(n);
    v.y *= 0.55;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function createMortar(ctx: Tracker): Mortar {
  const outer = densify(chaikin([P(0, 0), P(26, 0), P(30, 2), P(34, 8), P(43, 30), P(46, 46), P(46, 50)], 3), mm(3));
  const profile = buildProfile(outer, mm(5));
  // Men sứ ngà (LAB_PALETTE.ceramic) + viền xanh sẫm quanh miệng – nhìn rõ trên mặt bàn trắng / máy chiếu.
  const porcelain = ctx.track(new THREE.MeshPhysicalMaterial({ color: LAB_PALETTE.ceramic, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  const group = new THREE.Group();
  group.name = 'mortar';
  const bowl = new THREE.Mesh(latheFromProfile(profile.closed, 64), porcelain);
  bowl.castShadow = bowl.receiveShadow = true;
  group.add(bowl);
  const band = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(46.2), mm(1.6), 8, 72).rotateX(Math.PI / 2)), labMaterials(ctx).plastic('blue'));
  band.position.y = mm(47);
  group.add(band);
  const liquid = createLiquid(ctx, profile, { volumeML: 0, meniscus: mm(0.6) });
  group.add(liquid.mesh);
  // Chày: đầu tròn + cán thon, gốc ở đầu chày.
  const pestle = new THREE.Group();
  const head = new THREE.Mesh(
    latheFromProfile(chaikin([P(0, 0), P(11, 1.5), P(15, 10), P(9, 24), P(8, 100), P(10, 112), P(0, 116)], 3), 32),
    porcelain,
  );
  head.castShadow = true;
  pestle.add(head);
  group.add(pestle);
  const sample = new THREE.Group();
  group.add(sample);
  const pieces: THREE.Mesh[] = [];
  let kind: 'tissue' | 'leaf' = 'tissue';
  const sampleMat = ctx.track(new THREE.MeshPhysicalMaterial({ color: 0x6e2a22, roughness: 0.45, clearcoat: 0.5, side: THREE.DoubleSide }));
  const geos: THREE.BufferGeometry[] = [];
  ctx.track(() => geos.forEach((g) => g.dispose()));
  const rest = (i: number, n: number) => {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const rr = mm(i === 0 ? 0 : 17);
    return new THREE.Vector3(Math.cos(a) * rr, mm(9 + (i % 2) * 1.5), Math.sin(a) * rr);
  };
  const m: Mortar = {
    group,
    profile,
    liquid,
    pestle,
    lip: new THREE.Vector3(-mm(46), mm(50), 0),
    setSample(k, color) {
      kind = k;
      pieces.forEach((p) => p.removeFromParent());
      pieces.length = 0;
      geos.forEach((g) => g.dispose());
      geos.length = 0;
      sampleMat.color.set(color ?? (k === 'tissue' ? 0x6e2a22 : 0x3f8f2f));
      const n = k === 'tissue' ? 4 : 6;
      for (let i = 0; i < n; i++) {
        const g = k === 'tissue' ? lumpGeometry(i * 1.7, mm(12 - i * 1.2)) : new THREE.CircleGeometry(mm(12), 18).scale(1, 0.62, 1).rotateX(-Math.PI / 2 + 0.25);
        geos.push(g);
        const p = new THREE.Mesh(g, sampleMat);
        p.position.copy(rest(i, n));
        p.rotation.y = i * 1.3;
        p.castShadow = true;
        sample.add(p);
        pieces.push(p);
      }
    },
    setGrind(p) {
      const s = Math.max(0, 1 - p) ** 0.7;
      pieces.forEach((pc, i) => {
        pc.visible = s > 0.04;
        pc.scale.setScalar(s * (kind === 'leaf' ? 1 : 1 + 0.25 * p));
        pc.position.copy(rest(i, pieces.length)).multiplyScalar(1 - 0.5 * p);
        pc.position.y = mm(6.5 + 3 * s);
      });
    },
    pestlePose(phase) {
      const r = mm(12);
      return {
        pos: new THREE.Vector3(Math.cos(phase) * r, mm(5), Math.sin(phase) * r),
        rot: new THREE.Euler(Math.sin(phase) * 0.32, 0, -Math.cos(phase) * 0.32),
      };
    },
  };
  m.setSample('tissue');
  return m;
}
