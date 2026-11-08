import * as THREE from 'three';
import { createVessel, type Vessel } from '../glassware/vessel';
import { createWrapLabel, type WrapLabel } from '../glassware/wrapLabel';
import type { Liquid, LiquidOptions } from '../liquid/liquid';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, lathe, optionalLiquid, P, smoothProfile, type Accent } from './common';

/** Cỡ lọ thật (mm): lọ sữa chua 220 mL, lọ dưa 3 L, lọ bệnh phẩm 30 mL, bình kị khí / vi hiếu khí 1 L. */
export const JAR_PRESETS = {
  yogurt: { diameter: 64, height: 85, mouth: 54, wall: 2.2, capHeight: 12, capColor: 'red' },
  pickle: { diameter: 150, height: 228, mouth: 130, wall: 3.5, capHeight: 20, capColor: 'red' },
  specimen: { diameter: 30, height: 38, mouth: 30, wall: 1.2, capHeight: 9, capColor: 'red' },
  anaerobic: { diameter: 125, height: 85, mouth: 125, wall: 2.5, capHeight: 10, capColor: 'blue' },
} as const;
export type JarPreset = keyof typeof JAR_PRESETS;

export interface JarOptions {
  preset?: JarPreset;
  /** Kích thước (mm) – ghi đè preset. `mouth` = Ø cổ ren (≤ diameter; bằng nhau = lọ thẳng không vai). */
  diameter?: number;
  height?: number;
  mouth?: number;
  wall?: number;
  capHeight?: number;
  /** Màu nắp (LAB_ACCENT hoặc mã) – phần màu đậm của lọ. */
  capColor?: Accent;
  /**
   * Thân: 'glass' (mặc định), 'plastic' = PET trong (clearPlastic), 'seeThrough' = nhựa trong *transparent*
   * (không transmission) để thấy dụng cụ thuỷ tinh đặt BÊN TRONG (đĩa petri trong bình kị khí).
   */
  body?: 'glass' | 'plastic' | 'seeThrough';
  /** Nhãn giấy dán thân (quay về +z). */
  label?: string;
  sublabel?: string;
  labelStripe?: string;
  /** Chất lỏng trong lọ (createLiquid). Nhiều lớp: tự tạo createLayeredLiquid(ctx, jar.vessel.profile, …). */
  liquid?: LiquidOptions;
  /** Nắp kẹp hai bên + núm (bình kị khí). Mặc định theo preset 'anaerobic'. */
  clamps?: boolean;
  /** Mặc định đậy nắp. */
  open?: boolean;
}

export interface Jar {
  /** Gốc = tâm đáy ngoài. */
  group: THREE.Group;
  vessel: Vessel;
  /** Nắp (con của group; gốc = mép dưới nắp). Đổi bằng setOpen hoặc tự đặt position/cha. */
  lid: THREE.Group;
  /** Vị trí nắp khi đậy (cục bộ group). */
  lidClosed: THREE.Vector3;
  /** Vị trí nắp khi mở – đặt ngửa trên bàn cạnh lọ (+x). */
  lidRest: THREE.Vector3;
  /** Tâm miệng lọ (để rót / thả vật vào, vùng thả). */
  mouth: THREE.Object3D;
  /** Đáy trong (chỗ đặt vật trong lọ). */
  floorY: number;
  label: WrapLabel | null;
  liquid: Liquid | null;
  setOpen(open: boolean): void;
  readonly open: boolean;
}

/** Vật liệu nhựa trong *transparent* – vật transmission bên trong vẫn hiện (theo dõi bằng ctx.track). */
function seeThroughMaterial(ctx: Tracker): THREE.MeshPhysicalMaterial {
  return ctx.track(new THREE.MeshPhysicalMaterial({ color: 0xc4dde8, roughness: 0.12, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide }));
}

/** A-LO-NAP – lọ/hũ có nắp vặn màu: lọ sữa chua, lọ dưa, lọ bệnh phẩm, bình kị khí. Gốc ở đáy ngoài. */
export function createJar(ctx: Tracker, o: JarOptions = {}): Jar {
  const mats = labMaterials(ctx);
  const pre = JAR_PRESETS[o.preset ?? 'yogurt'];
  const R = (o.diameter ?? pre.diameter) / 2;
  const H = o.height ?? pre.height;
  const rn = Math.min(R, (o.mouth ?? (o.diameter ? (o.diameter * pre.mouth) / pre.diameter : pre.mouth)) / 2);
  const wall = o.wall ?? pre.wall;
  const capH = o.capHeight ?? pre.capHeight;
  const body = o.body ?? (o.preset === 'specimen' ? 'plastic' : o.preset === 'anaerobic' ? 'seeThrough' : 'glass');
  const straight = R - rn < 1;
  const neck = Math.min(capH * 0.9, H * 0.14);
  const c = Math.min(5, R * 0.12);
  const outline = straight
    ? [P(0, 0), P(R - c, 0), P(R, c), P(R, H)]
    : [P(0, 0), P(R - c, 0), P(R, c), P(R, H - neck - (R - rn) * 1.1), P(rn, H - neck), P(rn, H)];
  const material = body === 'plastic' ? mats.clearPlastic() : body === 'seeThrough' ? seeThroughMaterial(ctx) : mats.thickGlass();
  const vessel = createVessel(ctx, smoothProfile(outline, wall, 2), { material, name: 'jar' });
  if (body === 'seeThrough') vessel.glass.renderOrder = 4;
  const group = vessel.group;
  const accent = mats.plastic(o.capColor ?? pre.capColor);

  // Nắp vặn rỗng (vành + mặt trên dày) – nhìn từ dưới vẫn thấy thành nắp.
  const lid = new THREE.Group();
  lid.name = 'jar-lid';
  const cr = rn + Math.max(1.5, wall);
  const t = Math.max(2.5, capH * 0.22);
  lid.add(lathe(ctx, [P(0, capH), P(cr - 1.5, capH), P(cr, capH - 1.5), P(cr, 0), P(cr - 1.6, 0), P(cr - 1.6, capH - t), P(0, capH - t)], accent, 48));
  const clamps = o.clamps ?? o.preset === 'anaerobic';
  if (clamps) {
    // Bình kị khí: núm vặn + 2 kẹp tối màu ôm vành; vành miệng tối để thấy rõ mép bình.
    const knob = lathe(ctx, [P(0, capH + 12), P(10, capH + 12), P(12, capH), P(0, capH)], mats.trim(), 24);
    lid.add(knob);
    const clampGeo = ctx.track(new THREE.BoxGeometry(mm(7), mm(capH + 18), mm(18)));
    for (const s of [-1, 1]) {
      const k = new THREE.Mesh(clampGeo, mats.trim());
      k.position.set(s * mm(cr + 3), mm((capH - 18) / 2), 0);
      k.castShadow = true;
      lid.add(k);
    }
    const rim = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(R + 0.5), mm(2.2), 8, 48)), mats.trim());
    rim.rotation.x = Math.PI / 2;
    rim.position.y = mm(H - 1.5);
    group.add(rim);
  }
  const lidClosed = new THREE.Vector3(0, mm(H - (capH - t)), 0);
  const lidRest = new THREE.Vector3(mm(R + cr + 12), 0, mm(R * 0.3));
  group.add(lid);
  let open = false;
  const setOpen = (v: boolean) => {
    open = v;
    lid.position.copy(v ? lidRest : lidClosed);
  };
  setOpen(o.open ?? false);

  let label: WrapLabel | null = null;
  if (o.label) {
    const lh = Math.min(H * 0.36, 60);
    label = createWrapLabel(ctx, o.label, { radius: mm(R + 0.4), height: mm(lh), arc: Math.min(2.2, 60 / R + 0.6), sublabel: o.sublabel, stripe: o.labelStripe });
    label.mesh.position.y = mm(Math.min(H * 0.42, H - neck - (R - rn) * 1.1 - lh / 2 - 2));
    group.add(label.mesh);
  }
  const liquid = optionalLiquid(ctx, vessel.profile, group, o.liquid);
  const mouth = anchor(group, 'jar-mouth', 0, mm(H));
  return {
    group, vessel, lid, lidClosed, lidRest, mouth, label, liquid, setOpen,
    floorY: vessel.profile.innerBottom,
    get open() {
      return open;
    },
  };
}
