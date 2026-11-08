import * as THREE from 'three';
import { createVessel, type Vessel } from '../glassware/vessel';
import { buildProfile } from '../glassware/profile';
import { createWrapLabel, type WrapLabel } from '../glassware/wrapLabel';
import type { Liquid, LiquidOptions } from '../liquid/liquid';
import { accentColor, LAB_PALETTE } from '../materials/palette';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, lathe, optionalLiquid, P, smoothProfile, type Accent } from './common';

/** Cỡ cốc thật (mm): Ø miệng, Ø đáy, cao. */
export const CUP_PRESETS = {
  /** Cốc nhựa trong 180 mL. */
  plastic: { top: 70, bottom: 48, height: 82, kind: 'plastic' },
  /** Cốc giấy 200 mL. */
  paper: { top: 73, bottom: 50, height: 88, kind: 'paper' },
  /** Cốc đựng bệnh phẩm (đờm) 60 mL, nắp vặn. */
  sputum: { top: 48, bottom: 44, height: 58, kind: 'plastic' },
  /** Cốc bỏ đầu tip / rác thải nhỏ – nhựa đục màu. */
  bin: { top: 84, bottom: 72, height: 80, kind: 'opaque' },
} as const;
export type CupPreset = keyof typeof CUP_PRESETS;

export interface CupOptions {
  preset?: CupPreset;
  /** 'plastic' = nhựa trong (clearPlastic), 'paper' = giấy ngà + dải màu, 'opaque' = nhựa đục màu `color`. */
  kind?: 'plastic' | 'paper' | 'opaque';
  top?: number;
  bottom?: number;
  height?: number;
  /** Màu nhận diện: dải in cốc giấy, thân cốc đục, vành cốc nhựa. Mặc định 'blue' ('orange' cho bin). */
  color?: Accent;
  label?: string;
  sublabel?: string;
  /** Nắp vặn màu (cốc bệnh phẩm) – đặt cạnh cốc khi mở. */
  lid?: Accent;
  liquid?: LiquidOptions;
}

export interface Cup {
  group: THREE.Group;
  vessel: Vessel;
  liquid: Liquid | null;
  label: WrapLabel | null;
  lid: THREE.Mesh | null;
  lidClosed: THREE.Vector3;
  lidRest: THREE.Vector3;
  setOpen(open: boolean): void;
  mouth: THREE.Object3D;
}

/** A-COC-NHUA / A-COC-GIAY – cốc côn nhựa trong, cốc giấy, cốc bệnh phẩm có nắp, cốc đục. Gốc ở đáy ngoài. */
export function createCup(ctx: Tracker, o: CupOptions = {}): Cup {
  const mats = labMaterials(ctx);
  const pre = CUP_PRESETS[o.preset ?? 'plastic'];
  const kind = o.kind ?? pre.kind;
  const Rt = (o.top ?? pre.top) / 2;
  const Rb = (o.bottom ?? pre.bottom) / 2;
  const H = o.height ?? pre.height;
  const color = accentColor(o.color ?? (o.preset === 'bin' ? 'orange' : 'blue'));
  const wall = kind === 'paper' ? 0.6 : kind === 'opaque' ? 1.6 : 0.8;
  // Cốc nhựa/giấy: đáy lõm nhẹ + gờ cuộn ở miệng.
  const profile = smoothProfile([P(0, 2), P(Rb - 3, 2), P(Rb - 1, 0), P(Rb, 1), P(Rt, H - 2), P(Rt + 1.2, H - 0.8), P(Rt + 1.2, H)], wall, 2);
  const material = kind === 'plastic' ? mats.clearPlastic() : kind === 'paper' ? mats.paper() : mats.plastic(color);
  const vessel = createVessel(ctx, profile, { material, name: `cup-${kind}` });
  if (kind !== 'plastic') vessel.glass.castShadow = vessel.glass.receiveShadow = true;
  const group = vessel.group;
  if (kind !== 'opaque') {
    // Gờ miệng màu (cốc nhựa) / dải in (cốc giấy) – vật có phần màu đậm để nhận ra.
    const band = kind === 'paper'
      ? lathe(ctx, [P(Rb + (Rt - Rb) * 0.3 + 0.3, H * 0.3), P(Rb + (Rt - Rb) * 0.62 + 0.3, H * 0.62)], mats.plastic(color), 48)
      : new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(Rt + 0.6), mm(1.1), 6, 48)), mats.plastic(color));
    if (kind !== 'paper') {
      band.rotation.x = Math.PI / 2;
      band.position.y = mm(H - 0.6);
    }
    group.add(band);
  }
  let label: WrapLabel | null = null;
  if (o.label) {
    const y = H * 0.55;
    const r = Rb + ((Rt - Rb) * y) / H + 0.5;
    label = createWrapLabel(ctx, o.label, { radius: mm(r), height: mm(Math.min(24, H * 0.3)), arc: 1.6, sublabel: o.sublabel, stripe: color });
    label.mesh.position.y = mm(y);
    group.add(label.mesh);
  }
  let lid: THREE.Mesh | null = null;
  const lidClosed = new THREE.Vector3(0, mm(H - 8), 0);
  const lidRest = new THREE.Vector3(mm(Rt * 2 + 8), 0, mm(Rt * 0.4));
  let setOpen = (_v: boolean) => {};
  if (o.lid) {
    const cr = Rt + 2;
    lid = lathe(ctx, [P(0, 12), P(cr - 1.5, 12), P(cr, 10.5), P(cr, 0), P(cr - 1.6, 0), P(cr - 1.6, 9.5), P(0, 9.5)], mats.plastic(o.lid), 40);
    lid.name = 'cup-lid';
    group.add(lid);
    setOpen = (v) => void lid!.position.copy(v ? lidRest : lidClosed);
    setOpen(true);
  }
  const liquid = optionalLiquid(ctx, profile, group, o.liquid);
  return { group, vessel, liquid, label, lid, lidClosed, lidRest, setOpen, mouth: vessel.mouth };
}

export interface Can {
  group: THREE.Group;
  vessel: Vessel;
  /** Mặt đồ đục bên trong (sữa đặc, sữa chua) – hạ theo setFill. */
  top: THREE.Mesh;
  /** Độ cao mặt khi đầy. */
  topY: number;
  /** 0…1 phần còn lại (mặt hạ dần, 0 = ẩn). */
  setFill(k: number): void;
  label: WrapLabel;
  mouth: THREE.Object3D;
}

/** A-LON / A-HOP-SUA-CHUA – lon sữa đặc (thiếc, Ø 75 × 80) hoặc hộp sữa chua (nhựa ngà, Ø 75 × 56), nắp đã mở, nhãn in. */
export function createCan(ctx: Tracker, o: { kind?: 'can' | 'tub'; text: string; sub?: string; stripe?: Accent; fill?: THREE.ColorRepresentation }): Can {
  const mats = labMaterials(ctx);
  const can = o.kind !== 'tub';
  const pts = can ? [P(0, 0), P(36, 0), P(37.5, 2), P(37.5, 78), P(36, 80)] : [P(0, 0), P(28, 0), P(30, 2), P(36, 54), P(37.5, 56)];
  const profile = buildProfile(pts, mm(0.8));
  const vessel = createVessel(ctx, profile, { material: can ? mats.chrome() : mats.plastic(LAB_PALETTE.instrument), name: can ? 'can' : 'tub' });
  vessel.glass.castShadow = true;
  const stripe = accentColor(o.stripe ?? (can ? 'blue' : 'pink'));
  const label = createWrapLabel(ctx, o.text, { radius: mm(can ? 38 : 34), height: mm(can ? 56 : 30), arc: Math.PI * 1.2, stripe, sublabel: o.sub });
  label.mesh.position.y = mm(can ? 40 : 30);
  vessel.group.add(label.mesh);
  const top = new THREE.Mesh(ctx.track(new THREE.CircleGeometry(1, 32)), ctx.track(new THREE.MeshStandardMaterial({ color: o.fill ?? (can ? '#e9d9a8' : '#efe8d6'), roughness: 0.55 })));
  top.rotation.x = -Math.PI / 2;
  const topY = mm(can ? 70 : 46);
  const floor = mm(6);
  top.scale.setScalar(mm(can ? 36 : 33));
  top.position.y = topY;
  vessel.group.add(top);
  return {
    group: vessel.group, vessel, top, topY, label,
    mouth: anchor(vessel.group, 'can-mouth', 0, profile.height),
    setFill(k) {
      top.position.y = floor + (topY - floor) * Math.max(0, Math.min(1, k));
      top.visible = k > 0.005;
    },
  };
}
