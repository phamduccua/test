import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createGlassMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';

/** A-LAM-KINH-LOM: lam kính dày có một lõm hình chỏm cầu ở giữa mặt trên (làm tiêu bản giọt treo). Gốc = tâm mặt dưới; lam dài theo x. */
export interface CavitySlide {
  group: THREE.Group;
  glass: THREE.Mesh;
  /** Mặt trên lam (y cục bộ), bán kính và độ sâu lõm (đv cảnh). */
  topY: number;
  cavityR: number;
  cavityDepth: number;
  /** Độ cao mặt lõm tại khoảng cách r từ tâm (y cục bộ). */
  surfaceAt(r: number): number;
}

export interface CavitySlideOptions {
  /** Kích thước (mm): mặc định 75 × 25 × 1,5, lõm Ø 15 sâu 0,7. */
  length?: number;
  width?: number;
  thickness?: number;
  cavityDiameter?: number;
  cavityDepth?: number;
  /** Đầu mờ để ghi nhãn ở đầu +x (mm, 0 = không có; mặc định 20) – giúp thấy lam trên nền tối. */
  frosted?: number;
}

export function createCavitySlide(ctx: Tracker, o: CavitySlideOptions = {}): CavitySlide {
  const L = mm(o.length ?? 75);
  const W = mm(o.width ?? 25);
  const T = mm(o.thickness ?? 1.5);
  const R = mm((o.cavityDiameter ?? 15) / 2);
  const d = mm(o.cavityDepth ?? 0.7);
  // Chỏm cầu bán kính Rs đi qua mép lõm và đáy lõm.
  const Rs = (R * R + d * d) / (2 * d);
  const surfaceAt = (r: number) => (r >= R ? T : T - d + (Rs - Math.sqrt(Math.max(0, Rs * Rs - r * r))));

  // Mặt trên: lưới mịn, hạ các đỉnh trong lõm; đỉnh nằm đúng mép lõm để viền lõm sắc.
  const top = new THREE.PlaneGeometry(L, W, 180, 60);
  top.rotateX(-Math.PI / 2);
  const pos = top.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, surfaceAt(Math.hypot(x, z)));
  }
  top.computeVertexNormals();
  // Thân lam: hộp bỏ mặt trên (nhóm +y).
  const box = new THREE.BoxGeometry(L, T, W);
  const g = box.groups[2];
  const idx = Array.from(box.index!.array);
  idx.splice(g.start, g.count);
  box.setIndex(idx);
  box.clearGroups();
  box.translate(0, T / 2, 0);
  const geo = ctx.track(mergeGeometries([top, box])!);
  top.dispose();
  box.dispose();

  const glass = new THREE.Mesh(geo, ctx.track(createGlassMaterial({ thickness: mm(1.2) })));
  glass.name = 'cavity-slide';
  const group = new THREE.Group();
  group.name = 'cavity-slide';
  group.add(glass);
  const fl = mm(o.frosted ?? 20);
  if (fl > 0) {
    const frost = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(fl, mm(0.08), W - mm(0.4))), ctx.track(new THREE.MeshStandardMaterial({ color: '#f1f2f0', roughness: 0.95 })));
    frost.position.set(L / 2 - fl / 2 - mm(0.2), T + mm(0.04), 0);
    group.add(frost);
  }
  return { group, glass, topY: T, cavityR: R, cavityDepth: d, surfaceAt };
}
