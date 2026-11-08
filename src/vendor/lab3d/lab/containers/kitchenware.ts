import * as THREE from 'three';
import { chaikin, densify } from '../glassware/curves';
import { createGraduations } from '../glassware/graduations';
import { levelForVolume } from '../glassware/profile';
import { createVessel, type Vessel } from '../glassware/vessel';
import type { Liquid, LiquidOptions } from '../liquid/liquid';
import { accentColor } from '../materials/palette';
import { createMetalMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { fromML, mm } from '../units';
import { anchor, lathe, optionalLiquid, P, shadowed, smoothProfile, type Accent } from './common';

/** Đồ bếp đựng/rót nước: ca đong có quai, ấm nhôm, nồi inox. Gốc mỗi vật ở tâm đáy ngoài; rót về −x. */

export interface JugOptions {
  /** Dung tích (mL): 1000 → Ø112 × 158 mm, 1500 → Ø120 × 160 mm (bình pha). Kích thước ghi đè được. */
  volume?: 1000 | 1500;
  diameter?: number;
  height?: number;
  /** Quai bên +x: màu nhựa nhận diện (mặc định 'blue'), 'glass' = quai thuỷ tinh liền, false = không quai. */
  handle?: Accent | 'glass' | false;
  /** Vạch chia (mặc định có, in đỏ để nổi trên kính). */
  graduations?: boolean;
  /** Thân: thuỷ tinh (mặc định) hoặc nhựa trong. */
  body?: 'glass' | 'plastic';
  liquid?: LiquidOptions;
}

export interface Jug {
  group: THREE.Group;
  vessel: Vessel;
  liquid: Liquid | null;
  /** Mép mỏ rót (−x) – nơi dòng nước rời ca khi nghiêng quanh z dương. */
  spout: THREE.Object3D;
  /** Chỗ tay nắm quai (+x). */
  grip: THREE.Object3D;
  mouth: THREE.Object3D;
}

/** A-CA-DONG – ca/bình rót thuỷ tinh có mỏ, quai màu và vạch mL. */
export function createJug(ctx: Tracker, o: JugOptions = {}): Jug {
  const mats = labMaterials(ctx);
  const big = o.volume === 1500;
  const R = (o.diameter ?? (big ? 120 : 112)) / 2;
  const H = o.height ?? (big ? 160 : 158);
  const profile = smoothProfile([P(0, 0), P(R - 4, 0), P(R, 4), P(R, H - 8), P(R + 2, H - 2), P(R + 2.5, H)], 2.5, 2);
  const vessel = createVessel(ctx, profile, { material: o.body === 'plastic' ? mats.clearPlastic() : mats.thickGlass(), name: 'jug' });
  const group = vessel.group;
  // Mỏ rót: nửa xuyến kính nhô ra phía −x.
  const lip = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(10), mm(2.4), 8, 20, Math.PI)), mats.thickGlass());
  lip.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  lip.position.set(-mm(R - 5), mm(H + 0.5), 0);
  group.add(lip);
  if (o.graduations !== false) {
    const top = big ? 1500 : 1000;
    const marks = [];
    for (let ml = 200; ml <= top; ml += big ? 250 : 200) {
      marks.push({ y: levelForVolume(profile.inner, fromML(ml)), major: true, label: ml === 1000 ? '1 L' : String(ml) });
    }
    group.add(createGraduations(ctx, profile, { marks: marks.filter((m) => m.y < mm(H - 6)), arc: 0.55, color: accentColor('red') }).rotateY(-0.9));
  }
  const handle = o.handle ?? 'blue';
  if (handle !== false) {
    const mat = handle === 'glass' ? mats.solidGlass() : mats.plastic(handle);
    const h = shadowed(new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(H * 0.25), mm(6), 10, 24, Math.PI)), mat));
    h.rotation.z = -Math.PI / 2;
    h.position.set(mm(R - 2), mm(H * 0.55), 0);
    group.add(h);
  }
  const liquid = optionalLiquid(ctx, profile, group, o.liquid);
  return {
    group, vessel, liquid,
    spout: anchor(group, 'jug-spout', -mm(R + 6), mm(H)),
    grip: anchor(group, 'jug-grip', mm(R + H * 0.25), mm(H * 0.55)),
    mouth: vessel.mouth,
  };
}

export interface Kettle {
  group: THREE.Group;
  /** Mép dưới miệng vòi (cục bộ) – chỗ nước tràn ra khi nghiêng quanh z dương. */
  spout: THREE.Object3D;
  /** Đỉnh quai xách – chỗ tay cầm. */
  grip: THREE.Object3D;
}

/** A-AM – ấm nhôm Ø 184 × 150 mm, vòi cong về −x, quai xách + núm nắp tối. `color` = ấm men màu thay vì nhôm. */
export function createKettle(ctx: Tracker, o: { color?: Accent; scale?: number } = {}): Kettle {
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'kettle';
  const body = o.color ? mats.plastic(o.color) : mats.steel();
  const outline = densify(chaikin([P(0, 0), P(78, 0), P(88, 12), P(92, 55), P(84, 110), P(60, 145), P(46, 150), P(0, 150)], 2), mm(5));
  group.add(lathe(ctx, outline, body, 48));
  // Vành nắp tối để thấy rõ đường nắp trên thân sáng.
  const seam = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(47), mm(2.2), 8, 40)), mats.trim());
  seam.rotation.x = Math.PI / 2;
  seam.position.y = mm(149);
  const knob = shadowed(new THREE.Mesh(ctx.track(new THREE.SphereGeometry(mm(12), 16, 10)), mats.trim()));
  knob.position.y = mm(156);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-mm(80), mm(45), 0), new THREE.Vector3(-mm(140), mm(70), 0), new THREE.Vector3(-mm(160), mm(140), 0));
  const spoutMesh = shadowed(new THREE.Mesh(ctx.track(new THREE.TubeGeometry(curve, 16, mm(10), 10)), body));
  const handle = shadowed(new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(80), mm(7), 8, 32, Math.PI)), mats.trim()));
  handle.position.y = mm(150);
  handle.rotation.y = Math.PI / 2;
  group.add(seam, knob, spoutMesh, handle);
  group.scale.setScalar(o.scale ?? 1);
  // Miệng vòi (−160; 140) mm, tiếp tuyến (−0,27; 0,96): mép dưới lệch một bán kính ống theo pháp tuyến hướng xuống.
  return { group, spout: anchor(group, 'kettle-spout', -mm(169.5), mm(137)), grip: anchor(group, 'kettle-grip', 0, mm(230)) };
}

export interface CookPot {
  group: THREE.Group;
  vessel: Vessel;
  liquid: Liquid | null;
  /** Nắp kính (null nếu không có) – gốc ở mép dưới, đậy tại y = miệng nồi. */
  lid: THREE.Group | null;
}

/** A-NOI – nồi inox Ø 200 × 120 mm, hai quai tối; nắp kính núm tối (tuỳ chọn). */
export function createCookPot(ctx: Tracker, o: { diameter?: number; height?: number; lid?: boolean; liquid?: LiquidOptions } = {}): CookPot {
  const mats = labMaterials(ctx);
  const R = (o.diameter ?? 200) / 2;
  const H = o.height ?? 120;
  const profile = smoothProfile([P(0, 0), P(R - 8, 0), P(R - 1, 6), P(R, 30), P(R, H)], 1.6, 2);
  // Inox xước (nhám hơn steel()) – không phản chiếu phòng tối thành nồi đen.
  const brushed = ctx.track(createMetalMaterial(0xc9ced4, 0.55, 0.85));
  const vessel = createVessel(ctx, profile, { material: brushed, name: 'pot' });
  vessel.glass.castShadow = true;
  const group = vessel.group;
  const handleGeo = ctx.track(new THREE.TorusGeometry(mm(22), mm(4), 10, 24, Math.PI));
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(handleGeo, mats.trim());
    h.rotation.set(Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    h.position.set(s * mm(R), mm(H * 0.83), 0);
    group.add(h);
  }
  // Vành miệng tối – mép nồi nổi trên mặt bàn sáng.
  const rim = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(R), mm(1.8), 8, 64)), mats.trim());
  rim.rotation.x = Math.PI / 2;
  rim.position.y = mm(H);
  group.add(rim);
  let lid: THREE.Group | null = null;
  if (o.lid) {
    lid = new THREE.Group();
    lid.add(lathe(ctx, [P(0, 14), P(R * 0.6, 11), P(R + 2, 2), P(R + 2, 0), P(R - 2, 0), P(R * 0.6, 9), P(0, 12)], mats.thickGlass(), 64));
    lid.add(lathe(ctx, [P(0, 26), P(12, 26), P(14, 22), P(8, 14), P(0, 14)], mats.trim(), 24));
    lid.position.y = mm(H);
    group.add(lid);
  }
  const liquid = optionalLiquid(ctx, profile, group, o.liquid);
  return { group, vessel, liquid, lid };
}
