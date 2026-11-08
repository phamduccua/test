import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, handleMaterial, part, toolFrame, type HandTool, type HandleColor, type ToolAxis } from './common';

export interface ChopsticksOptions {
  /** Chiều dài (mm), mặc định 240 (đũa ăn 23–24 cm; đũa nấu 30–33 cm). */
  length?: number;
  /** Thân: 'bamboo' (tre – mặc định), 'wood' (gỗ sẫm) hoặc mã màu. */
  body?: 'bamboo' | 'wood' | (string & {});
  /** Đầu đũa sơn màu (mặc định 'red'); 'none' = không sơn. */
  band?: HandleColor | 'none';
  axis?: ToolAxis;
}

export interface Chopsticks extends HandTool {
  /** 0 = chụm (kẹp chặt), 1 = mở rộng (~12 mm ở đầu). */
  setOpen(k: number): void;
  /** Tương thích TN-070-01: `pinch(k)` = setOpen(1 − k). */
  pinch(k: number): void;
}

/**
 * A-DUA – đôi đũa thuôn (Ø7 ở đầu cầm → Ø3,5 ở đầu gắp), đầu cầm sơn dải màu. Gốc ở hai đầu gắp chụm lại, thân theo +x,
 * hai chiếc tách nhau theo z (nằm phẳng trên bàn). `tip` = giữa hai đầu gắp, `grip` = chỗ cầm (2/3 thân).
 */
export function createChopsticks(ctx: Tracker, o: ChopsticksOptions = {}): Chopsticks {
  const L = mm(o.length ?? 240);
  const { group, body } = toolFrame('chopsticks', o.axis);
  const bodyMat =
    (o.body ?? 'bamboo') === 'bamboo'
      ? ctx.track(new THREE.MeshStandardMaterial({ color: '#c9a062', roughness: 0.6 }))
      : o.body === 'wood'
        ? ctx.track(new THREE.MeshStandardMaterial({ color: '#7a4a28', roughness: 0.55 }))
        : ctx.track(new THREE.MeshStandardMaterial({ color: o.body, roughness: 0.5 }));
  const bandL = L * 0.22;
  const geo = ctx.track(new THREE.CylinderGeometry(mm(3.5), mm(1.75), L - (o.band === 'none' ? 0 : bandL), 10).rotateZ(-Math.PI / 2));
  geo.translate((L - (o.band === 'none' ? 0 : bandL)) / 2, 0, 0);
  const bandGeo = o.band === 'none' ? null : ctx.track(new THREE.CylinderGeometry(mm(3.6), mm(3.5), bandL, 10).rotateZ(-Math.PI / 2).translate(L - bandL / 2, 0, 0));
  const bandMat = o.band === 'none' ? null : handleMaterial(ctx, o.band ?? 'red');
  const sticks = [1, -1].map((side) => {
    const piv = new THREE.Group();
    piv.userData.side = side;
    const m = new THREE.Mesh(geo, bodyMat);
    m.castShadow = true;
    piv.add(m);
    if (bandGeo && bandMat) part(ctx, piv, bandGeo.clone(), bandMat);
    body.add(piv);
    return piv;
  });
  bandGeo?.dispose();
  const tip = anchor(body, 'tip', mm(3));
  const grip = anchor(body, 'grip', L * 0.66);
  const api: Chopsticks = {
    group,
    tip,
    grip,
    setOpen(k) {
      const c = THREE.MathUtils.clamp(k, 0, 1);
      for (const s of sticks) {
        const side = s.userData.side as number;
        // Đầu cầm cách nhau ~14 mm; đầu gắp chụm (k = 0) hoặc mở 12 mm (k = 1).
        s.position.z = side * mm(1.8 + 6 * c);
        s.rotation.y = -side * Math.atan2(mm(5.2 - 6 * c), L);
      }
    },
    pinch: (k) => api.setOpen(1 - k),
  };
  api.setOpen(0);
  return api;
}
