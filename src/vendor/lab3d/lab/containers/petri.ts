import * as THREE from 'three';
import { petriProfile } from '../glassware/shapes';
import { createVessel, type Vessel } from '../glassware/vessel';
import { createWrapLabel, type WrapLabel } from '../glassware/wrapLabel';
import type { Liquid, LiquidOptions } from '../liquid/liquid';
import { accentColor } from '../materials/palette';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { optionalLiquid, type Accent } from './common';

export type PetriLid = 'on' | 'side' | 'none';

export interface PetriOptions {
  /** Ø đáy (mm): 90 (mặc định), 60, 100… Nắp = Ø + 4. */
  diameter?: number;
  /** Cao đáy (mm), mặc định 13. */
  height?: number;
  /** 'on' = đậy (mặc định), 'side' = nắp ngửa cạnh đĩa (+x), 'none' = không có nắp. */
  lid?: PetriLid;
  /** Thuỷ tinh (mặc định) hoặc nhựa PS dùng một lần. */
  plastic?: boolean;
  /** Dung dịch/môi trường lỏng trong đĩa (mặc định mực 6 mm nếu chỉ cho màu). */
  liquid?: LiquidOptions;
  /** Nhãn băng dính viết bút dạ trên thành đáy (vd "A", "Đ/C"). */
  mark?: string;
  markColor?: Accent;
}

export interface Petri {
  group: THREE.Group;
  base: Vessel;
  lid: THREE.Group | null;
  /** Vị trí nắp khi đậy / khi đặt ngửa bên cạnh (cục bộ group). */
  lidOn: THREE.Vector3;
  lidSide: THREE.Vector3;
  liquid: Liquid | null;
  mark: WrapLabel | null;
  /** Mặt dung dịch (hoặc đáy trong nếu không có). */
  surfaceY(): number;
  /** Bán kính lòng đĩa dùng được (đặt mẫu). */
  radius: number;
  setLid(state: 'on' | 'side'): void;
}

/** A-DIA-PETRI (đủ bộ): đáy + nắp (đậy / ngửa bên cạnh) + dung dịch + nhãn đánh dấu. Gốc ở tâm đáy ngoài. */
export function createPetri(ctx: Tracker, o: PetriOptions = {}): Petri {
  const mats = labMaterials(ctx);
  const D = o.diameter ?? 90;
  const H = o.height ?? 13;
  const mat = o.plastic ? mats.clearPlastic() : mats.thickGlass();
  const group = new THREE.Group();
  group.name = 'petri';
  const base = createVessel(ctx, petriProfile(D, H), { material: mat, name: 'petri-base' });
  group.add(base.group);
  const lidOn = new THREE.Vector3(0, mm(H + 2), 0);
  const lidSide = new THREE.Vector3(mm(D + 18), 0, 0);
  let lid: THREE.Group | null = null;
  if (o.lid !== 'none') {
    const v = createVessel(ctx, petriProfile(D + 4, 9), { material: mat, name: 'petri-lid' });
    lid = v.group;
    lid.rotation.x = Math.PI;
    group.add(lid);
  }
  const setLid = (s: 'on' | 'side') => {
    if (!lid) return;
    lid.position.copy(s === 'on' ? lidOn : lidSide);
    // Úp khi đậy, ngửa khi đặt bên cạnh (giữ vô trùng mặt trong).
    lid.rotation.x = s === 'on' ? Math.PI : 0;
  };
  setLid(o.lid === 'side' ? 'side' : 'on');
  const liquid = optionalLiquid(ctx, base.profile, base.group, o.liquid && { ...(o.liquid.volumeML === undefined && { level: mm(6) }), meniscus: mm(0.6), ...o.liquid });
  let mark: WrapLabel | null = null;
  if (o.mark) {
    mark = createWrapLabel(ctx, o.mark, { radius: mm(D / 2 + 0.4), height: mm(8), arc: 0.7, stripe: accentColor(o.markColor ?? 'red') });
    mark.mesh.position.y = mm(H * 0.45);
    base.group.add(mark.mesh);
  }
  return {
    group, base, lid, lidOn, lidSide, liquid, mark, setLid,
    radius: mm(D / 2 - 3),
    surfaceY: () => (liquid ? liquid.level : base.profile.innerBottom),
  };
}
