import * as THREE from 'three';
import { chaikin, densify } from '../glassware/curves';
import { buildProfile, type VesselProfile } from '../glassware/profile';
import { latheFromProfile } from '../glassware/vessel';
import { createLiquid, type Liquid, type LiquidOptions } from '../liquid/liquid';
import type { LabAccent } from '../materials/palette';
import type { P2, Tracker } from '../types';
import { mm } from '../units';

/** Tiện ích chung cho nhóm Đồ chứa (lọ, ca, cốc, khay, hộp…). Thuần kit – không phụ thuộc sim/app. */

/** Điểm profile theo mm. */
export const P = (r: number, y: number): P2 => ({ r: mm(r), y: mm(y) });

/** Profile kín từ polyline ngoài (mm, đáy → miệng), bo góc chaikin. */
export function smoothProfile(pts: P2[], wall: number, iterations = 3): VesselProfile {
  return buildProfile(densify(chaikin(pts, iterations), mm(3)), mm(wall));
}

/** Màu nhận diện: tên LAB_ACCENT hoặc mã màu tuỳ ý. */
export type Accent = LabAccent | string;

/** Bật đổ/nhận bóng. */
export function shadowed<T extends THREE.Mesh>(m: T): T {
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Mesh tròn xoay từ profile mm (đã track geometry). */
export function lathe(ctx: Tracker, pts: P2[], mat: THREE.Material, segments = 48): THREE.Mesh {
  return shadowed(new THREE.Mesh(ctx.track(latheFromProfile(pts, segments)), mat));
}

/** Chất lỏng tuỳ chọn trong một profile (null nếu không có màu). */
export function optionalLiquid(ctx: Tracker, profile: VesselProfile, parent: THREE.Object3D, o?: LiquidOptions): Liquid | null {
  if (!o) return null;
  const liquid = createLiquid(ctx, profile, { meniscus: mm(1.2), ...o });
  parent.add(liquid.mesh);
  return liquid;
}

/** Điểm neo rỗng (miệng, quai, chỗ đặt…). */
export function anchor(parent: THREE.Object3D, name: string, x: number, y: number, z = 0): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}
