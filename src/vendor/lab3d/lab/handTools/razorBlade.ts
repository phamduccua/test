import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, handleMaterial, part, toolFrame, type HandTool, type HandleColor, toolSteel } from './common';

export interface RazorBladeOptions {
  /** 'double' = dao lam hai lưỡi 43 × 22 mm có rãnh giữa (như createRazor); 'single' = dao lam một lưỡi 38 × 19 mm có sống gấp màu. */
  kind?: 'double' | 'single';
  /** Màu sống/nhãn (mặc định 'blue') – phần đậm để nhận ra lưỡi dao trên bàn trắng. */
  accent?: HandleColor;
}

/**
 * A-DAO-LAM – lưỡi dao lam nằm phẳng (gốc ở tâm, mặt trên y ≈ 0,4 mm). Hai lưỡi: dải màu in giữa thân;
 * một lưỡi: sống gấp kim loại sơn màu ở cạnh −z. `tip` = giữa cạnh cắt (+z), `grip` = chỗ ngón tay giữ (sống/giữa thân).
 */
export function createRazorBlade(ctx: Tracker, o: RazorBladeOptions = {}): HandTool {
  const single = o.kind === 'single';
  const { group, body } = toolFrame('razor');
  const [w, d] = single ? [mm(38), mm(19)] : [mm(43), mm(22)];
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2, -d / 2).lineTo(w / 2, -d / 2).lineTo(w / 2, d / 2).lineTo(-w / 2, d / 2).closePath();
  if (!single) {
    const slot = new THREE.Path();
    slot.moveTo(-mm(13), -mm(1.2)).lineTo(mm(13), -mm(1.2)).lineTo(mm(13), mm(1.2)).lineTo(-mm(13), mm(1.2)).closePath();
    sh.holes.push(slot);
  }
  part(ctx, body, new THREE.ExtrudeGeometry(sh, { depth: mm(0.4), bevelEnabled: false }).rotateX(-Math.PI / 2), toolSteel(ctx));
  const accent = handleMaterial(ctx, o.accent ?? 'blue');
  if (single) {
    // Sống gấp: thanh chữ U ôm cạnh sau, dày 2 mm.
    part(ctx, body, new THREE.BoxGeometry(w + mm(0.4), mm(2), mm(4.5)), accent, 0, mm(0.2), -d / 2 + mm(1.8));
  } else {
    // Dải màu in hai bên rãnh (như nhãn hiệu trên dao lam).
    for (const s of [-1, 1]) part(ctx, body, new THREE.BoxGeometry(mm(7.5), mm(0.05), mm(5)), accent, s * mm(17.25), mm(0.43), 0);
  }
  const tip = anchor(body, 'tip', 0, mm(0.2), d / 2);
  const grip = anchor(body, 'grip', 0, mm(0.4), single ? -d / 2 + mm(1.8) : 0);
  return { group, tip, grip };
}
