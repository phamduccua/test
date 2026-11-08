import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, handleMaterial, part, toolFrame, type HandTool, type HandleColor, type ToolAxis, toolSteel } from './common';

export interface ScissorsOptions {
  /** Chiều dài toàn bộ (mm), mặc định 115 (kéo mổ thẳng 11,5 cm). */
  length?: number;
  /** Mũi 'sharp' (nhọn – nhọn, kéo mổ) | 'blunt' (tù – kéo cắt giấy/cắt rễ). */
  point?: 'sharp' | 'blunt';
  /** Màu quai (mặc định 'red'); 'steel' = quai thép liền. */
  handles?: HandleColor;
  axis?: ToolAxis;
}

export interface Scissors extends HandTool {
  /** Đinh bản lề (con của group). */
  hinge: THREE.Object3D;
  /** 0 = khép, 1 = mở hết (≈ 32°). */
  setOpen(k: number): void;
}

/**
 * A-KEO – kéo: hai lưỡi thép quay quanh đinh bản lề ở 40 % chiều dài, quai tròn có ốp nhựa màu. Nằm phẳng trên bàn (mặt xz),
 * mũi ở gốc, quai về +x. `tip` = điểm cắt gần mũi, `grip` = giữa hai quai.
 */
export function createScissors(ctx: Tracker, o: ScissorsOptions = {}): Scissors {
  const L = mm(o.length ?? 115);
  const blunt = o.point === 'blunt';
  const steel = toolSteel(ctx);
  const ringMat = o.handles === 'steel' ? steel : handleMaterial(ctx, o.handles ?? 'red');
  const { group, body } = toolFrame('scissors', o.axis);
  const hx = L * 0.42;
  const bladeT = mm(1);
  const blades: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.x = hx;
    pivot.userData.side = s;
    // Lưỡi: sống cong phía ngoài (s·z > 0), cạnh sắc thẳng trên trục x.
    const sh = new THREE.Shape();
    const w = mm(blunt ? 5.5 : 4.5);
    sh.moveTo(-hx, blunt ? s * mm(1.6) : 0);
    if (blunt) sh.quadraticCurveTo(-hx + mm(1), s * mm(2.8), -hx + mm(4), s * mm(3));
    sh.quadraticCurveTo(-hx * 0.45, s * w, 0, s * w * 1.05).lineTo(mm(4), s * mm(2)).lineTo(mm(4), -s * mm(0.6)).lineTo(-hx, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: bladeT, bevelEnabled: false, curveSegments: 10 }).rotateX(Math.PI / 2);
    part(ctx, pivot, geo, steel, 0, s > 0 ? bladeT : 0);
    // Cán: thanh thép chếch ra ngoài tới quai.
    const shankL = L - hx - mm(16);
    const shank = part(ctx, pivot, new THREE.BoxGeometry(shankL, bladeT * 1.4, mm(3.2)), steel, shankL / 2 + mm(2), (s > 0 ? bladeT : 0) - bladeT / 2, -s * mm(4));
    shank.rotation.y = s * 0.16;
    // Quai: vòng xuyến thép + ốp màu (to, nhìn rõ từ xa).
    const ringR = mm(s > 0 ? 8 : 9.5);
    const ring = part(ctx, pivot, new THREE.TorusGeometry(ringR, mm(2.2), 10, 28).rotateX(Math.PI / 2), ringMat, L - hx - ringR, (s > 0 ? bladeT : 0) - bladeT / 2, -s * (mm(6) + ringR * 0.9));
    ring.scale.set(1.25, 1, 1);
    body.add(pivot);
    blades.push(pivot);
  }
  const hinge = anchor(body, 'hinge', hx, bladeT);
  part(ctx, hinge, new THREE.CylinderGeometry(mm(2), mm(2), bladeT * 2.6, 14), labMaterials(ctx).chrome(), 0, -bladeT / 2);
  const tip = anchor(body, 'tip', mm(6), bladeT / 2);
  const grip = anchor(body, 'grip', L - mm(14), bladeT / 2);
  return {
    group,
    tip,
    grip,
    hinge,
    setOpen(k) {
      const a = 0.28 * THREE.MathUtils.clamp(k, 0, 1);
      for (const b of blades) b.rotation.y = (b.userData.side as number) * a;
    },
  };
}
