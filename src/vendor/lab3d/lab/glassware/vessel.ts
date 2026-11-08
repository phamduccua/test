import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { proxyFromProfile } from '../geometry/clearance';
import { setClearance } from '../geometry/clearancePairs';
import type { VesselProfile } from './profile';

/** Một dụng cụ thuỷ tinh tròn xoay: nhóm gốc (đáy ngoài ở y=0) + mesh kính + profile để dựng chất lỏng. */
export interface Vessel {
  group: THREE.Group;
  glass: THREE.Mesh;
  profile: VesselProfile;
  /** Độ cao miệng (cục bộ). */
  mouthY: number;
  /** Điểm giữa miệng – gắn nhãn/khói. */
  mouth: THREE.Object3D;
}

export interface VesselOptions {
  material?: THREE.Material;
  segments?: number;
  name?: string;
}

/** Thứ tự vẽ: chất lỏng (−2) → bọt/kết tủa (đục, tự động trước) → kính (0). */
export const RENDER_ORDER = { liquid: -2, glass: 0, overlay: 2 } as const;

export function latheFromProfile(points: { r: number; y: number }[], segments = 64): THREE.LatheGeometry {
  return new THREE.LatheGeometry(
    points.map((p) => new THREE.Vector2(p.r, p.y)),
    segments,
  );
}

/** Dựng dụng cụ từ profile kín. */
export function createVessel(ctx: Tracker, profile: VesselProfile, o: VesselOptions = {}): Vessel {
  const group = new THREE.Group();
  group.name = o.name ?? 'vessel';
  const glass = new THREE.Mesh(latheFromProfile(profile.closed, o.segments ?? 64), o.material ?? labMaterials(ctx).glass());
  glass.renderOrder = RENDER_ORDER.glass;
  glass.castShadow = false;
  glass.receiveShadow = false;
  glass.name = `${group.name}-glass`;
  // Proxy va chạm thô (đo độ xuyên khi rót / đặt, tự tính tư thế rót) – theo khung của mesh kính.
  setClearance(glass, proxyFromProfile(profile));
  group.add(glass);
  const mouth = new THREE.Object3D();
  mouth.position.y = profile.height;
  group.add(mouth);
  return { group, glass, profile, mouthY: profile.height, mouth };
}
