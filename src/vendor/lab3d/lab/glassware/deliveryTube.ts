import * as THREE from 'three';
import { createGlassMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface DeliveryTubeOptions {
  /** Điểm nằm trong dụng cụ thuỷ tinh khác (bình, ống nghiệm, chậu nước) → đoạn đó dùng vật liệu đục ánh bạc (quy tắc kính lồng kính). */
  inside?: (p: THREE.Vector3) => boolean;
  /** Bán kính ngoài (mm). Mặc định 3 (ống Ø6). */
  radius?: number;
  /** Màu ngả của kính (mặc định xanh nhạt – ống mảnh vẫn thấy trên nền sáng). */
  tint?: THREE.ColorRepresentation;
}

export interface DeliveryTube {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  /** Hai đầu ống (toạ độ của cha): `start` = đầu cắm nút, `tip` = đầu dẫn khí ra. */
  start: THREE.Vector3;
  tip: THREE.Vector3;
}

/**
 * A-ONG-DAN-KHI: ống thuỷ tinh uốn theo đường cong `points` (toạ độ của cha), hai miệng ống có vòng đục để thấy lỗ.
 * Đoạn trong dụng cụ thuỷ tinh khác (`inside(p)` = true) dùng vật liệu đục vì transmission trong transmission không hiện.
 * Ống mềm (cao su/silicon) thì dùng `createCable`.
 */
export function createDeliveryTube(ctx: Tracker, points: THREE.Vector3[], o: DeliveryTubeOptions = {}): DeliveryTube {
  const radius = mm(o.radius ?? 3);
  const inside = o.inside ?? (() => false);
  const group = new THREE.Group();
  group.name = 'delivery-tube';
  const glass = ctx.track(createGlassMaterial({ thickness: mm(8), tint: o.tint ?? 0xb9dfe6, attenuationDistance: 0.07, roughness: 0.05 }));
  const opaque = ctx.track(new THREE.MeshStandardMaterial({ color: 0xc9d9de, roughness: 0.14, metalness: 0.65, envMapIntensity: 1.3 }));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const dense = curve.getSpacedPoints(160);
  // Chia đường thành các đoạn liên tiếp cùng trạng thái trong/ngoài.
  const runs: { pts: THREE.Vector3[]; in: boolean }[] = [];
  for (const p of dense) {
    const k = inside(p);
    const last = runs[runs.length - 1];
    if (last && last.in === k) last.pts.push(p);
    else {
      if (last) last.pts.push(p.clone());
      runs.push({ pts: last ? [last.pts[last.pts.length - 2].clone(), p] : [p], in: k });
    }
  }
  for (const r of runs) {
    if (r.pts.length < 2) continue;
    const c = new THREE.CatmullRomCurve3(r.pts, false, 'centripetal');
    const mesh = new THREE.Mesh(ctx.track(new THREE.TubeGeometry(c, Math.max(4, r.pts.length * 2), radius, 12, false)), r.in ? opaque : glass);
    mesh.castShadow = !r.in;
    group.add(mesh);
  }
  // Miệng ống: vòng đục vuông góc với hướng ống.
  const ringGeo = ctx.track(new THREE.TorusGeometry(radius * 0.8, radius * 0.25, 6, 16));
  const Z = new THREE.Vector3(0, 0, 1);
  for (const t of [0, 1]) {
    const ring = new THREE.Mesh(ringGeo, opaque);
    ring.position.copy(curve.getPointAt(t));
    ring.quaternion.setFromUnitVectors(Z, curve.getTangentAt(t));
    group.add(ring);
  }
  return { group, curve, start: dense[0].clone(), tip: dense[dense.length - 1].clone() };
}
