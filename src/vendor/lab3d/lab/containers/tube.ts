import * as THREE from 'three';
import { testTubeProfile } from '../glassware/shapes';
import { createVessel, type Vessel } from '../glassware/vessel';
import { createWrapLabel, type WrapLabel } from '../glassware/wrapLabel';
import type { Liquid, LiquidOptions } from '../liquid/liquid';
import { accentColor } from '../materials/palette';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { lathe, optionalLiquid, P, smoothProfile, type Accent } from './common';

/** Dán nhãn số/chữ quanh ống (giấy, dải màu `stripe`), tâm nhãn ở `y` (đv) – thêm vào vessel.group. */
export function addTubeLabel(ctx: Tracker, vessel: Vessel, text: string, o: { y?: number; height?: number; sublabel?: string; stripe?: Accent } = {}): WrapLabel {
  const r = vessel.profile.maxRadius + mm(0.5);
  const h = o.height ?? mm(o.sublabel ? 16 : 11);
  const label = createWrapLabel(ctx, text, { radius: r, height: h, arc: o.sublabel ? 1.3 : 0.95, sublabel: o.sublabel, stripe: accentColor(o.stripe ?? 'blue') });
  label.mesh.position.y = o.y ?? vessel.profile.height * 0.55;
  vessel.group.add(label.mesh);
  return label;
}

export interface LabelledTubeOptions {
  /** Ø × dài (mm), mặc định 16 × 160. */
  diameter?: number;
  length?: number;
  /** Ống nhựa PS trong (ống nghiệm nhựa 14 mL) thay cho thuỷ tinh. */
  plastic?: boolean;
  label?: string;
  sublabel?: string;
  stripe?: Accent;
  /** Tâm nhãn (mm tính từ đáy), mặc định 55 % chiều dài. */
  labelAt?: number;
  /** Nắp vặn/nắp chụp màu nhận diện. */
  cap?: Accent;
  capOn?: boolean;
  liquid?: LiquidOptions;
}

export interface LabelledTube {
  /** = vessel.group (gốc ở đáy ống). */
  group: THREE.Group;
  vessel: Vessel;
  liquid: Liquid | null;
  label: WrapLabel | null;
  cap: THREE.Mesh | null;
  /** Đậy / mở nắp (nắp mở đặt đứng cạnh ống, +x). */
  setCap(on: boolean): void;
  mouth: THREE.Object3D;
}

/** A-ONG-NGHIEM có nhãn số + nắp màu (ống thử enzyme, ống mẫu, ống nuôi cấy nắp vặn). Gốc ở đáy ống. */
export function createLabelledTube(ctx: Tracker, o: LabelledTubeOptions = {}): LabelledTube {
  const mats = labMaterials(ctx);
  const D = o.diameter ?? 16;
  const L = o.length ?? 160;
  const vessel = createVessel(ctx, testTubeProfile(D, L, o.plastic ? 1 : 0.9), {
    material: o.plastic ? mats.clearPlastic('#e6eef2') : undefined,
    name: o.plastic ? 'plastic-tube' : 'test-tube',
    segments: 48,
  });
  const group = vessel.group;
  const label = o.label !== undefined
    ? addTubeLabel(ctx, vessel, o.label, { y: mm(o.labelAt ?? L * 0.55), sublabel: o.sublabel, stripe: o.stripe })
    : null;
  let cap: THREE.Mesh | null = null;
  const R = D / 2 + 0.55;
  const capH = Math.max(12, D * 0.9);
  if (o.cap !== undefined) {
    const cr = R + 1.4;
    cap = lathe(ctx, [P(0, capH), P(cr - 1, capH), P(cr, capH - 1), P(cr, 0), P(R, 0), P(R, capH - 2.5), P(0, capH - 2.5)], mats.plastic(o.cap), 32);
    cap.name = 'tube-cap';
    group.add(cap);
  }
  const setCap = (on: boolean) => {
    if (!cap) return;
    cap.position.set(on ? 0 : mm(D + 10), on ? mm(L - capH + 2.5) : 0, 0);
  };
  setCap(o.capOn ?? true);
  const liquid = optionalLiquid(ctx, vessel.profile, group, o.liquid);
  return { group, vessel, liquid, label, cap, setCap, mouth: vessel.mouth };
}

export interface MicroTubeOptions {
  /** 'eppendorf' = ống li tâm 1,5 mL (Ø 10,8 × 39 mm), 'pcr' = ống PCR 0,2 mL (Ø 6 × 21 mm). */
  kind?: 'eppendorf' | 'pcr';
  /** Màu nắp (nhựa PP màu) – mặc định 'blue'. Thân luôn là nhựa trong. */
  color?: Accent;
  /** Nắp mở 0…1 (0 = đóng). */
  open?: number;
  liquid?: LiquidOptions;
}

export interface MicroTube {
  group: THREE.Group;
  vessel: Vessel;
  liquid: Liquid | null;
  /** Bản lề nắp (+x) – quay quanh z; dùng setOpen. */
  hinge: THREE.Group;
  setOpen(k: number): void;
  mouth: THREE.Object3D;
}

/** A-ONG-EPPENDORF / A-ONG-PCR – ống nhựa đáy nón có nắp bật liền thân. Gốc ở mũi đáy, dọc +y. */
export function createMicroTube(ctx: Tracker, o: MicroTubeOptions = {}): MicroTube {
  const mats = labMaterials(ctx);
  const pcr = o.kind === 'pcr';
  const pts = pcr
    ? [P(0, 0), P(0.8, 0.3), P(2.4, 9), P(3, 11), P(3, 19.5), P(3.4, 20.2), P(3.4, 21)]
    : [P(0, 0), P(1.2, 0.4), P(4.2, 14), P(5.2, 18), P(5.2, 36.5), P(5.9, 37.5), P(5.9, 39)];
  const vessel = createVessel(ctx, smoothProfile(pts, pcr ? 0.5 : 0.8, 1), { material: mats.clearPlastic('#e8eef0'), name: pcr ? 'pcr-tube' : 'microtube', segments: 32 });
  const group = vessel.group;
  const top = vessel.profile.height;
  const rr = vessel.profile.maxRadius + mm(0.3);
  const capMat = mats.plastic(o.color ?? 'blue');
  const hinge = new THREE.Group();
  hinge.name = 'microtube-hinge';
  hinge.position.set(rr + mm(0.8), top, 0);
  const ch = mm(pcr ? 2.2 : 3.2);
  const lid = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(rr, rr, ch, 24)), capMat);
  lid.position.set(-(rr + mm(0.8)), ch / 2, 0);
  const plug = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(rr - mm(1.2), rr - mm(1.2), mm(3), 20)), capMat);
  plug.position.y = -ch / 2 - mm(1.5);
  lid.add(plug);
  // Tai bấm + dây bản lề.
  const tab = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(3), ch * 0.8, mm(4))), capMat);
  tab.position.set(-rr - mm(1), 0, 0);
  lid.add(tab);
  hinge.add(lid);
  group.add(hinge);
  const strap = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(1.6), mm(3), mm(3))), capMat);
  strap.position.set(rr + mm(0.6), top - mm(1.2), 0);
  group.add(strap);
  const setOpen = (k: number) => void (hinge.rotation.z = -Math.max(0, Math.min(1, k)) * 1.95);
  setOpen(o.open ?? 0);
  const liquid = optionalLiquid(ctx, vessel.profile, group, o.liquid);
  return { group, vessel, liquid, hinge, setOpen, mouth: vessel.mouth };
}
