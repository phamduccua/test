import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import { accentColor, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, part, rodX, toolFrame, type HandTool, type ToolAxis } from './common';

export interface PencilOptions {
  /** Chiều dài (mm), mặc định 175 (bút mới). */
  length?: number;
  /** Màu sơn thân, mặc định 'yellow'. */
  color?: LabAccent | (string & {});
  /** Có đầu tẩy + vòng kim loại (mặc định true). */
  eraser?: boolean;
  axis?: ToolAxis;
}

export interface Pencil extends HandTool {
  /** Đầu tù/đầu tẩy (đầu dùng gõ – ép tiêu bản) – con của group, ở gốc. */
  butt: THREE.Object3D;
}

/**
 * A-BUT-CHI – bút chì lục giác Ø7 sơn bóng, đầu vót gỗ + ngòi chì. Gốc ở ĐẦU TÙ (đầu tẩy – dùng gõ/ép mẫu như SGK),
 * thân theo +x; `tip` = ngòi chì (đầu xa), `butt` = đầu tù, `grip` = chỗ cầm gần ngòi.
 */
export function createPencil(ctx: Tracker, o: PencilOptions = {}): Pencil {
  const L = mm(o.length ?? 175);
  const R = mm(3.6);
  const { group, body } = toolFrame('pencil', o.axis);
  const paint = ctx.track(new THREE.MeshPhysicalMaterial({ color: accentColor(o.color ?? 'yellow'), roughness: 0.35, clearcoat: 0.6 }));
  const coneL = mm(18);
  let x0 = 0;
  if (o.eraser ?? true) {
    rodX(ctx, body, mm(3.3), mm(3.3), 0, mm(5), ctx.track(new THREE.MeshStandardMaterial({ color: '#d9727a', roughness: 0.9 })), 16);
    rodX(ctx, body, mm(3.75), mm(3.75), mm(5), mm(13), labMaterials(ctx).chrome(), 16);
    x0 = mm(13);
  } else {
    rodX(ctx, body, R * 0.95, R * 0.95, 0, mm(0.6), labMaterials(ctx).wood(), 6);
    x0 = mm(0.6);
  }
  const shaft = rodX(ctx, body, R, R, x0, L - coneL, paint, 6);
  shaft.rotation.x = Math.PI / 6;
  const wood = part(ctx, body, new THREE.ConeGeometry(R, coneL, 6, 1, true).rotateZ(-Math.PI / 2), labMaterials(ctx).wood(), L - coneL / 2);
  wood.rotation.x = Math.PI / 6;
  const leadL = mm(5);
  part(ctx, body, new THREE.ConeGeometry(mm(1.05), leadL, 12).rotateZ(-Math.PI / 2), ctx.track(new THREE.MeshStandardMaterial({ color: '#2b2d31', roughness: 0.4 })), L - leadL / 2 + mm(0.5));
  const tip = anchor(body, 'tip', L + mm(0.5));
  const butt = anchor(body, 'butt', 0);
  const grip = anchor(body, 'grip', L - mm(45));
  return { group, tip, grip, butt };
}
