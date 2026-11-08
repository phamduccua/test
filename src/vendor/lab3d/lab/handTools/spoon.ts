import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, handleMaterial, part, toolFrame, type HandTool, type HandleColor, type ToolAxis, toolSteel } from './common';

export interface SpoonOptions {
  /** 'table' = thìa canh 190 mm (lòng 50 × 34), 'tea' = thìa cà phê 130 mm (lòng 34 × 24). */
  kind?: 'table' | 'tea';
  /** Chiều dài (mm) – ghi đè theo kind. */
  length?: number;
  /** Ốp cán màu (mặc định 'red'); 'steel' = thìa inox trơn. */
  handle?: HandleColor;
  axis?: ToolAxis;
}

export interface Spoon extends HandTool {
  /** Đống hạt/bột hoặc mặt chất lỏng trong lòng thìa (ẩn/hiện, đổi màu). */
  load: THREE.Mesh;
  /** `kind` 'heap' = đống bột/hạt (mặc định), 'liquid' = thìa đầy nước/sữa (mặt phẳng). */
  setLoad(on: boolean, color?: THREE.ColorRepresentation, kind?: 'heap' | 'liquid'): void;
}

/**
 * A-THIA – thìa ăn inox (lòng thìa bầu dục + cán dẹt hơi cong lên, ốp nhựa màu cuối cán). Gốc ở giữa lòng thìa (đáy trong),
 * cán theo +x; `tip` = giữa lòng thìa (chỗ múc), `grip` = giữa ốp cán. Kiểu API giống createSpatula (`setLoad`).
 */
export function createSpoon(ctx: Tracker, o: SpoonOptions = {}): Spoon {
  const tea = o.kind === 'tea';
  const L = mm(o.length ?? (tea ? 130 : 190));
  const bl = mm(tea ? 34 : 50);
  const bw = mm(tea ? 24 : 34);
  const depth = mm(tea ? 6 : 9);
  const steel = toolSteel(ctx);
  const { group, body } = toolFrame('spoon', o.axis);
  // Lòng thìa: nửa cầu dưới ép dẹt, hai mặt (nhìn được cả lòng lẫn lưng).
  const bowlMat = ctx.track(steel.clone());
  bowlMat.side = THREE.DoubleSide;
  const bowl = part(ctx, body, new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bowlMat, 0, depth);
  bowl.scale.set(bl / 2, depth, bw / 2);
  // Cổ + cán: cong lên dần (thìa đặt trên bàn thì cán chạm bàn, lòng thìa hơi nghiêng).
  const neckL = L - bl / 2;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(bl / 2 - mm(3), depth, 0), new THREE.Vector3(bl / 2 + neckL * 0.35, depth * 1.6, 0), new THREE.Vector3(L, depth * 1.2, 0));
  const shank = part(ctx, body, new THREE.TubeGeometry(curve, 24, mm(1.6), 8), steel);
  shank.scale.z = tea ? 2.2 : 2.8;
  const hc = o.handle ?? 'red';
  if (hc !== 'steel') {
    const p0 = curve.getPoint(0.55);
    const p1 = curve.getPoint(1);
    const len = p0.distanceTo(p1);
    const pad = part(ctx, body, new THREE.CapsuleGeometry(mm(tea ? 3.4 : 4.2), len, 4, 12).rotateZ(Math.PI / 2), handleMaterial(ctx, hc), (p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
    pad.scale.set(1, 0.62, 1.3);
    pad.rotation.z = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  }
  const loadMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0xece4d0, roughness: 0.7 }));
  const load = part(ctx, body, new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), loadMat, 0, depth * 0.35);
  load.visible = false;
  const tip = anchor(body, 'tip', 0, depth * 0.3);
  const grip = anchor(body, 'grip', 0);
  grip.position.copy(curve.getPoint(0.78));
  const api: Spoon = {
    group,
    tip,
    grip,
    load,
    setLoad(on, color, kind = 'heap') {
      load.visible = on;
      if (color !== undefined) loadMat.color.set(color);
      // Đống bột nhô lên giữa lòng; chất lỏng = mặt gần phẳng sát miệng lòng thìa.
      if (kind === 'liquid') {
        load.scale.set(bl * 0.46, mm(0.6), bw * 0.46);
        load.position.y = depth * 0.82;
        loadMat.roughness = 0.15;
      } else {
        load.scale.set(bl * 0.38, depth * 0.9, bw * 0.38);
        load.position.y = depth * 0.35;
        loadMat.roughness = 0.75;
      }
    },
  };
  api.setLoad(false);
  return api;
}
