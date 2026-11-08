import * as THREE from 'three';
import { chaikin, densify } from '../glassware/curves';
import { buildProfile, type VesselProfile } from '../glassware/profile';
import { createVessel, type Vessel } from '../glassware/vessel';
import { createGlassMaterial, createWoodMaterial } from '../materials/factories';
import { createKnife } from '../handTools/knife';
import type { Tracker } from '../types';
import { mm } from '../units';

/** Đồ bếp cho thí nghiệm đời sống (Sinh 10): thớt gỗ, dao bếp, bát thuỷ tinh. Đơn vị cảnh = dm. */

/** Profile bát thuỷ tinh: đáy phẳng có chân thấp, thành loe cong (mm). Thuần. */
export function bowlProfile(diameter = 130, height = 60, wall = 2.6): VesselProfile {
  const R = diameter / 2;
  const foot = R * 0.5;
  const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });
  const pts = [P(0, 0), P(foot, 0), P(foot + 2, 1.5), P(R * 0.72, height * 0.18), P(R * 0.9, height * 0.5), P(R * 0.98, height * 0.82), P(R, height)];
  return buildProfile(densify(chaikin(pts, 3), mm(3)), mm(wall));
}

/** A-BAT-THUY-TINH: bát kính dày (gốc = đáy ngoài). Thêm chất lỏng bằng `createLiquid(ctx, bowl.profile, …)`. */
export function createGlassBowl(ctx: Tracker, o: { diameter?: number; height?: number } = {}): Vessel {
  const profile = bowlProfile(o.diameter, o.height);
  const mat = ctx.track(createGlassMaterial({ thickness: mm(6), tint: 0xeef7f3, attenuationDistance: 0.4 }));
  return createVessel(ctx, profile, { material: mat, name: 'bowl', segments: 72 });
}

/** A-THOT: thớt gỗ tròn (gốc ở tâm đáy); `topY` = mặt thớt. */
export function createCuttingBoard(ctx: Tracker, o: { radius?: number; thickness?: number } = {}) {
  const r = o.radius ?? mm(150);
  const t = o.thickness ?? mm(28);
  const group = new THREE.Group();
  group.name = 'cutting-board';
  const top = ctx.track(createWoodMaterial('#d9b47e', '#b48a52', 11));
  const side = ctx.track(new THREE.MeshStandardMaterial({ color: '#a77b47', roughness: 0.7 }));
  const geo = ctx.track(new THREE.CylinderGeometry(r, r * 0.985, t, 72, 1));
  const m = new THREE.Mesh(geo, [side, top, side]);
  m.position.y = t / 2;
  m.castShadow = m.receiveShadow = true;
  group.add(m);
  // Vòng tuổi (vân gỗ ngang) trên mặt thớt.
  const ringMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#b98d58', roughness: 0.8 }));
  [0.25, 0.48, 0.7, 0.88].forEach((k) => {
    const ring = new THREE.Mesh(ctx.track(new THREE.RingGeometry(r * k - mm(1.2), r * k, 64)), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = t + mm(0.2);
    group.add(ring);
  });
  return { group, topY: t, radius: r };
}

/**
 * A-DAO: dao bếp. Gốc ở giữa lưỡi; lưỡi nằm trong mặt phẳng x–y, cạnh sắc dọc trục x tại y = 0,
 * mũi dao về −x, cán về +x, sống dao ở y > 0. Bản đầy đủ (kiểu dao, màu cán, `tip`/`grip`): createKnife (handTools/knife).
 */
export function createKitchenKnife(ctx: Tracker, o: { blade?: number } = {}): THREE.Group {
  return createKnife(ctx, { blade: o.blade }).group;
}
