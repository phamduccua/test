import * as THREE from 'three';
import { chaikin, densify } from '../glassware/curves';
import { buildProfile } from '../glassware/profile';
import { proxyFromProfile } from '../geometry/clearance';
import { setClearance } from '../geometry/clearancePairs';
import { createVessel, latheFromProfile, type Vessel } from '../glassware/vessel';
import { createPlasticMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });

/** A-QUE-CAY: que cấy vòng (vòng Ø4 mm + dây 6 cm + cán kim loại + chuôi nhựa) ≈ 22 cm. Gốc ở tâm vòng, cán theo +x, vòng nằm ngang. */
export type InoculatingLoop = THREE.Group & {
  /** Nung đỏ vòng + dây khi hơ lửa: 0 = nguội … 1 = đỏ rực. */
  setGlow(t: number): void;
};

export function createInoculatingLoop(ctx: Tracker): InoculatingLoop {
  const mats = labMaterials(ctx);
  const g = new THREE.Group();
  g.name = 'inoculating-loop';
  // Vật liệu riêng (không dùng chung steel()) để nung đỏ không lan sang dụng cụ khác.
  const wire = ctx.track(mats.steel().clone());
  wire.emissive.set('#ff5a1a');
  wire.emissiveIntensity = 0;
  const ring = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(2), mm(0.35), 8, 28)), wire);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const rod = (r: number, x0: number, x1: number, mat: THREE.Material, seg = 12) => {
    const m = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(r, r, x1 - x0, seg)), mat);
    m.rotation.z = Math.PI / 2;
    m.position.x = (x0 + x1) / 2;
    m.castShadow = true;
    g.add(m);
  };
  rod(mm(0.35), mm(2), mm(62), wire, 8);
  rod(mm(2), mm(60), mm(120), mats.chrome());
  rod(mm(4.2), mm(120), mm(220), ctx.track(createPlasticMaterial('#2f5f9e', 0.5)), 20);
  return Object.assign(g, {
    setGlow(t: number) {
      wire.emissiveIntensity = Math.max(0, Math.min(1, t)) * 2.4;
    },
  });
}

/** A-BINH-RUA: bình rửa nhựa PE 250 mL (Ø65 × 150) có vòi cong; gốc ở đáy, vòi chĩa về +x; `tip` = đầu vòi. */
export function createWashBottle(ctx: Tracker): { group: THREE.Group; tip: THREE.Object3D } {
  const g = new THREE.Group();
  g.name = 'wash-bottle';
  // PE mờ ngả xanh xám (không trắng tinh – nhìn rõ trên bàn sáng, máy chiếu).
  const pe = ctx.track(createPlasticMaterial('#a7bfc6', 0.55));
  const outline = [P(0, 0), P(30, 0), P(32.5, 3), P(32.5, 118), P(24, 134), P(14, 140), P(14, 150)];
  const body = new THREE.Mesh(ctx.track(latheFromProfile(densify(chaikin([...outline, P(0, 150)], 3), mm(4)), 48)), pe);
  body.castShadow = true;
  // Proxy va chạm của thân bình (vòi mảnh không tính) – __ix.overlaps() đo được bình rửa lấn vào chậu / vật chứa khác.
  setClearance(body, proxyFromProfile(buildProfile(densify(chaikin(outline, 3), mm(4)), mm(1.5))));
  g.add(body);
  const capMat = ctx.track(createPlasticMaterial('#e44d3a', 0.4));
  const cap = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(16), mm(16), mm(16), 32)), capMat);
  cap.position.y = mm(156);
  g.add(cap);
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, mm(160), 0),
    new THREE.Vector3(0, mm(205), 0),
    new THREE.Vector3(mm(12), mm(222), 0),
    new THREE.Vector3(mm(45), mm(212), 0),
    new THREE.Vector3(mm(68), mm(196), 0),
  ]);
  const tube = new THREE.Mesh(ctx.track(new THREE.TubeGeometry(path, 40, mm(2.6), 12)), pe);
  tube.castShadow = true;
  g.add(tube);
  const tip = new THREE.Object3D();
  tip.position.set(mm(69), mm(195), 0);
  g.add(tip);
  return { group: g, tip };
}

/** A-CHAU-RUA: chậu nhựa nông Ø200 × 70 mm đựng nước rửa (gốc ở đáy). Trả `Vessel` để đổ chất lỏng (`createLiquid(ctx, v.profile)`). */
export function createWashBasin(ctx: Tracker, o: { diameter?: number; height?: number; color?: THREE.ColorRepresentation } = {}): Vessel {
  const R = (o.diameter ?? 200) / 2;
  const H = o.height ?? 70;
  const outer = densify(chaikin([P(0, 0), P(R * 0.72, 0), P(R * 0.8, 3), P(R * 0.97, H - 4), P(R + 3, H)], 3), mm(4));
  const v = createVessel(ctx, buildProfile(outer, mm(2.5)), { material: ctx.track(createPlasticMaterial(o.color ?? '#5d8fc4', 0.5)), name: 'wash-basin' });
  v.glass.castShadow = v.glass.receiveShadow = true;
  return v;
}
