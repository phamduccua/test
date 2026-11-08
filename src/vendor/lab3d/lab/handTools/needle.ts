import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, handleMaterial, heatableSteel, part, rodX, toolFrame, type HandTool, type HandleColor, type ToolAxis } from './common';

export interface NeedleOptions {
  /** 'needle' = kim mổ mũi nhọn tròn; 'lancet' = kim mũi mác (mũi dẹt hình lá, rạch/tách biểu bì); 'bent' = kim mũi cong 45°. */
  kind?: 'needle' | 'lancet' | 'bent';
  /** Chiều dài toàn bộ (mm), mặc định 135. */
  length?: number;
  /** Màu cán (mặc định 'teal' cho kim mổ, 'orange' cho kim mũi mác); 'wood' = cán gỗ. */
  handle?: HandleColor;
  axis?: ToolAxis;
}

export interface Needle extends HandTool {
  /** Mũi ửng đỏ khi hơ lửa 0…1. */
  setHeat(k: number): void;
}

/**
 * A-KIM-MO / A-KIM-MUI-MAC – kim mổ: mũi thép + chuôi thép Ø1,6 dài 35 mm + cán Ø7 có khía. Gốc ở mũi, cán về +x,
 * mặt dẹt của mũi mác nằm ngang. `tip` = mũi, `grip` = giữa cán.
 */
export function createNeedle(ctx: Tracker, o: NeedleOptions = {}): Needle {
  const kind = o.kind ?? 'needle';
  const L = mm(o.length ?? 135);
  const { group, body } = toolFrame(kind === 'lancet' ? 'lancet' : 'needle', o.axis);
  const steel = heatableSteel(ctx);
  const pointL = kind === 'lancet' ? mm(11) : mm(10);
  if (kind === 'lancet') {
    const s = new THREE.Shape();
    s.moveTo(0, 0).lineTo(mm(5), mm(2.2)).lineTo(pointL, mm(0.8)).lineTo(pointL, -mm(0.8)).lineTo(mm(5), -mm(2.2)).closePath();
    part(ctx, body, new THREE.ExtrudeGeometry(s, { depth: mm(0.4), bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -mm(0.2), 0), steel.mat);
  } else if (kind === 'bent') {
    // Mũi cong 45° xuống bàn.
    const seg = rodX(ctx, body, mm(0.05), mm(0.8), 0, pointL, steel.mat, 8);
    seg.geometry.translate(-pointL / 2, 0, 0);
    seg.position.x = pointL;
    seg.rotation.z = Math.PI / 4;
  } else {
    rodX(ctx, body, mm(0.05), mm(0.8), 0, pointL, steel.mat, 8);
  }
  const shankEnd = pointL + mm(35);
  rodX(ctx, body, mm(0.8), mm(0.8), pointL - mm(0.5), shankEnd + mm(4), steel.mat, 10);
  // Cán: côn nhẹ, đầu ống bọc kim loại + khía.
  const hMat = handleMaterial(ctx, o.handle ?? (kind === 'lancet' ? 'orange' : 'teal'));
  rodX(ctx, body, mm(2.2), mm(3), shankEnd - mm(4), shankEnd + mm(4), steel.mat, 16);
  const hEnd = Math.max(L, shankEnd + mm(50));
  rodX(ctx, body, mm(3.2), mm(3.6), shankEnd + mm(4), hEnd - mm(3), hMat, 18);
  part(ctx, body, new THREE.SphereGeometry(mm(3.6), 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2), hMat, hEnd - mm(3));
  const ridge = new THREE.TorusGeometry(mm(3.35), mm(0.35), 6, 20).rotateY(Math.PI / 2);
  for (let i = 0; i < 4; i++) part(ctx, body, ridge.clone(), hMat, shankEnd + mm(12 + i * 3.5));
  ridge.dispose();
  const tip = anchor(body, 'tip', 0);
  if (kind === 'bent') tip.position.set(pointL - pointL * Math.SQRT1_2, -pointL * Math.SQRT1_2, 0);
  const grip = anchor(body, 'grip', (shankEnd + hEnd) / 2);
  return { group, tip, grip, setHeat: steel.heat };
}
