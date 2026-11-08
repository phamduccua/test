import * as THREE from 'three';
import { createFlame, type Flame } from '../effects/flame';
import { chaikin, densify } from '../glassware/curves';
import { buildProfile } from '../glassware/profile';
import { createVessel } from '../glassware/vessel';
import { createLiquid, type Liquid } from '../liquid/liquid';
import { labMaterials } from '../materials/kit';
import type { LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface AlcoholLamp {
  group: THREE.Group;
  flame: Flame;
  alcohol: Liquid;
  /** Đỉnh bấc (gốc ngọn lửa) – để đặt dụng cụ đun phía trên. */
  wickTop: THREE.Object3D;
  readonly lit: boolean;
  /** Châm lửa (nắp đặt sang bên) / tắt bằng nắp (nắp chụp lên). */
  setLit(on: boolean): void;
  update(dt: number, elapsed?: number): void;
}

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });

/** A-DEN-CON – đèn cồn thuỷ tinh dày Ø78×85, cổ ren, ống bấc, bấc cotton, nắp chụp, lửa shader. */
/** `collar` = màu cổ ren giữ bấc (LAB_ACCENT hoặc mã màu, mặc định xanh dương – nhận ra từ cuối lớp). */
export function createAlcoholLamp(ctx: Tracker, o: { lit?: boolean; collar?: LabAccent | string } = {}): AlcoholLamp {
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'alcohol-lamp';
  const outline = [P(0, 0), P(34, 0), P(39, 1), P(39.5, 6), P(39, 42), P(33, 62), P(20, 74), P(12.5, 78), P(12.5, 86)];
  const profile = buildProfile(densify(chaikin(outline, 3), mm(3)), mm(3));
  const body = createVessel(ctx, profile, { material: mats.thickGlass(), name: 'lamp-body' });
  group.add(body.group);
  const alcohol = createLiquid(ctx, profile, { level: mm(34), color: 0xc9dcf2, opacity: 0.16, meniscus: mm(1.5) });
  body.group.add(alcohol.mesh);

  const neckY = mm(86);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(mm(15.5), mm(15.5), mm(12), 40), mats.plastic(o.collar ?? 'blue'));
  collar.position.y = neckY - mm(2);
  collar.castShadow = true;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(mm(3.6), mm(3.8), mm(16), 20, 1, true), mats.steel());
  tube.position.y = neckY + mm(4 + 8);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(mm(2.8), mm(3), mm(14), 12), mats.cotton());
  wick.position.y = neckY + mm(16);
  const wickTip = new THREE.Mesh(new THREE.SphereGeometry(mm(2.9), 12, 8), new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 1 }));
  wickTip.scale.y = 0.7;
  wickTip.position.y = neckY + mm(23);
  // Bấc chìm trong cồn – nhìn thấy qua thân kính.
  const wickIn = new THREE.Mesh(new THREE.CylinderGeometry(mm(2.5), mm(3.5), mm(76), 10), mats.cotton());
  wickIn.position.y = mm(3 + 38);
  wickIn.rotation.z = 0.04;
  group.add(collar, tube, wick, wickTip, wickIn);

  const wickTop = new THREE.Object3D();
  wickTop.position.y = neckY + mm(24);
  group.add(wickTop);
  const flame = createFlame(ctx, { height: mm(42), width: mm(7) });
  wickTop.add(flame.group);

  // Nắp chụp thuỷ tinh
  const capProfile = buildProfile(densify(chaikin([P(0, 0), P(12, 1), P(17, 8), P(17, 35)], 3), mm(3)), mm(2));
  const cap = createVessel(ctx, capProfile, { material: mats.thickGlass(), name: 'lamp-cap' });
  cap.group.rotation.x = Math.PI;
  group.add(cap.group);
  const capOn = new THREE.Vector3(0, neckY + mm(38), 0);
  const capOff = new THREE.Vector3(mm(62), mm(35), mm(18));

  let lit = o.lit ?? true;
  const place = () => cap.group.position.copy(lit ? capOff : capOn);
  place();
  flame.setLit(lit);
  return {
    group,
    flame,
    alcohol,
    wickTop,
    get lit() {
      return lit;
    },
    setLit(on) {
      lit = on;
      flame.setLit(on);
      place();
    },
    update(dt, elapsed) {
      flame.update(dt, elapsed);
    },
  };
}
