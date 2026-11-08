import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, handleMaterial, heatableSteel, part, toolFrame, type HandTool, type HandleColor, type ToolAxis, toolSteel } from './common';

export interface TweezersOptions {
  /** Chiều dài (mm), mặc định 120 (panh mổ 120–150, panh cấy mô 150–200). */
  length?: number;
  /** 'fine' = mũi nhọn (panh mổ, gắp đầu rễ), 'blunt' = mũi tù khía (kẹp gắp đĩa kháng sinh, mẫu vật). */
  point?: 'fine' | 'blunt';
  /** Ốp tay cầm màu nhận diện (mặc định 'blue'); 'steel' = panh inox trơn. */
  grips?: HandleColor;
  axis?: ToolAxis;
}

export interface Tweezers extends HandTool {
  /** 0 = khép, 1 = mở. */
  setOpen(k: number): void;
  /** Mũi ửng đỏ khi vừa hơ lửa 0…1. */
  setHeat(k: number): void;
  length: number;
}

/**
 * A-PANH – panh/kẹp gắp: hai lá thép thon nối ở đuôi (x = length), mũi ở gốc. Lá nằm phẳng song song mặt bàn,
 * hai lá chồng nhau theo y (mở = tách theo y; axis 'y' → tách theo x, nhìn rõ từ phía trước).
 * Ốp tay cầm màu ở 45–80 % thân (chỗ ngón cái – ngón trỏ bóp). `tip` = giữa hai mũi (gắn vật gắp), `grip` = giữa ốp tay cầm.
 */
export function createTweezers(ctx: Tracker, o: TweezersOptions = {}): Tweezers {
  const L = mm(o.length ?? 120);
  const fine = (o.point ?? 'fine') === 'fine';
  const { group, body } = toolFrame('tweezers', o.axis);
  const steel = heatableSteel(ctx);
  const tipL = Math.min(mm(25), L * 0.2);
  const t = mm(0.9);
  const gap = mm(1.2);
  const width = (x: number) => (fine ? mm(0.5) : mm(1.6)) + (mm(fine ? 2.8 : 2.2)) * Math.min(1, x / (L * 0.55));
  // Một lá: hình thang thon trong mặt xz, dày t theo y; mũi tù thì bo tròn.
  const leaf = (x0: number, x1: number) => {
    const s = new THREE.Shape();
    s.moveTo(x0, -width(x0)).lineTo(x1, -width(x1)).lineTo(x1, width(x1)).lineTo(x0, width(x0)).closePath();
    return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(0, t / 2, 0);
  };
  const gripMat = o.grips === 'steel' ? null : handleMaterial(ctx, o.grips ?? 'blue');
  const arms: THREE.Group[] = [];
  for (const side of [1, -1]) {
    // Bản lề ở đuôi: lá quay quanh z để mũi tách theo y.
    const pivot = new THREE.Group();
    pivot.position.x = L;
    pivot.userData.side = side;
    const arm = new THREE.Group();
    arm.position.set(-L, side * (gap / 2 + t / 2), 0);
    pivot.add(arm);
    part(ctx, arm, leaf(0, tipL), steel.mat);
    part(ctx, arm, leaf(tipL, L), toolSteel(ctx));
    if (!fine) for (let i = 0; i < 4; i++) part(ctx, arm, new THREE.BoxGeometry(mm(0.5), t * 0.6, width(0) * 2), steel.mat, mm(1.5 + i * 1.6), -side * t * 0.55);
    if (gripMat) {
      const g0 = L * 0.45;
      const g1 = L * 0.8;
      const pad = part(ctx, arm, new THREE.BoxGeometry(g1 - g0, mm(1.2), width((g0 + g1) / 2) * 2 + mm(1.2)), gripMat, (g0 + g1) / 2, side * mm(0.9));
      pad.name = 'grip-pad';
    }
    body.add(pivot);
    arms.push(pivot);
  }
  // Đuôi nối hai lá.
  part(ctx, body, new THREE.BoxGeometry(mm(6), gap + 2 * t, width(L) * 2), toolSteel(ctx), L - mm(3));
  const tip = anchor(body, 'tip', mm(2));
  const grip = anchor(body, 'grip', L * 0.62);
  const api: Tweezers = {
    group,
    tip,
    grip,
    length: L,
    setHeat: steel.heat,
    setOpen(k) {
      const c = THREE.MathUtils.clamp(k, 0, 1);
      // k = 0: hai mũi chạm nhau; k = 1: mỗi lá mở 0,03 rad.
      for (const a of arms) a.rotation.z = (a.userData.side as number) * ((gap / (2 * L)) * (1 - c) - 0.03 * c);
    },
  };
  api.setOpen(0);
  return api;
}
