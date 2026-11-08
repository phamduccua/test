import * as THREE from 'three';
import { toolSteel } from '../handTools/common';
import type { Tracker } from '../types';
import { mm } from '../units';

/** Dụng cụ cấy mô: panh dài và dao mổ inox. Gốc ở mũi, thân dọc +y. `setHeat(0…1)` = phần mũi ửng đỏ khi vừa hơ lửa. */
export interface CultureTool {
  group: THREE.Group;
  /** Điểm kẹp/giữ mẫu (con của group, ngay trên mũi). */
  grip: THREE.Object3D;
  setHeat(k: number): void;
}

export interface Forceps extends CultureTool {
  /** 0 = khép, 1 = mở. */
  setOpen(v: number): void;
}

/** Thép dụng cụ (toolSteel – sẫm, không chìm vào mặt bàn trắng) có phần mũi nung đỏ. */
function hotSteel(ctx: Tracker) {
  const m = ctx.track(toolSteel(ctx).clone());
  m.emissive = new THREE.Color(0xff5a1a);
  m.emissiveIntensity = 0;
  return m;
}

/** A-PANH: panh inox dài 150 mm hai càng mảnh, mũi nhọn (mũi 25 mm cuối là phần hơ lửa). */
export function createForceps(ctx: Tracker, length = 150): Forceps {
  const steel = toolSteel(ctx);
  const tipMat = hotSteel(ctx);
  const group = new THREE.Group();
  group.name = 'forceps';
  const L = mm(length);
  const tipL = mm(25);
  const arms: THREE.Group[] = [];
  const width = (y: number) => mm(0.7) + (mm(2.6) * Math.min(1, y / (L * 0.7)));
  const armGeo = (y0: number, y1: number) => {
    const s = new THREE.Shape();
    s.moveTo(-width(y0), y0).lineTo(width(y0), y0).lineTo(width(y1), y1).lineTo(-width(y1), y1).closePath();
    const geo = ctx.track(new THREE.ExtrudeGeometry(s, { depth: mm(0.8), bevelEnabled: false }));
    geo.translate(0, -L, -mm(0.4));
    geo.rotateY(Math.PI / 2);
    return geo;
  };
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.y = L;
    pivot.userData.side = side;
    const tip = new THREE.Mesh(armGeo(0, tipL), tipMat);
    const body = new THREE.Mesh(armGeo(tipL, L), steel);
    for (const m of [tip, body]) {
      m.castShadow = true;
      m.position.x = side * mm(0.8);
      pivot.add(m);
    }
    group.add(pivot);
    arms.push(pivot);
  }
  const grip = new THREE.Object3D();
  grip.position.y = mm(2);
  group.add(grip);
  const f: Forceps = {
    group,
    grip,
    setHeat: (k) => (tipMat.emissiveIntensity = 2.2 * THREE.MathUtils.clamp(k, 0, 1) ** 1.5),
    setOpen(v) {
      for (const a of arms) a.rotation.z = (a.userData.side as number) * (0.006 + 0.02 * v);
    },
  };
  f.setOpen(0.15);
  return f;
}

/** A-DAO-MO: dao mổ cán dẹt inox số 3 (khía chống trượt) + lưỡi số 11 hình tam giác nhọn. */
export function createScalpel(ctx: Tracker): CultureTool {
  const steel = toolSteel(ctx);
  const bladeMat = hotSteel(ctx);
  const group = new THREE.Group();
  group.name = 'scalpel';
  const blade = new THREE.Shape();
  blade.moveTo(0, 0).lineTo(mm(1.2), mm(3)).lineTo(mm(4), mm(30)).lineTo(-mm(1.6), mm(30)).lineTo(-mm(1.6), mm(8)).closePath();
  const bg = ctx.track(new THREE.ExtrudeGeometry(blade, { depth: mm(0.4), bevelEnabled: false }));
  bg.translate(0, 0, -mm(0.2));
  const bm = new THREE.Mesh(bg, bladeMat);
  bm.castShadow = true;
  group.add(bm);
  const handle = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(7.5), mm(120), mm(2.2))), steel);
  handle.position.set(mm(1.2), mm(30 + 60), 0);
  handle.castShadow = true;
  group.add(handle);
  const ridge = ctx.track(new THREE.BoxGeometry(mm(7.7), mm(0.8), mm(2.5)));
  for (let i = 0; i < 14; i++) {
    const r = new THREE.Mesh(ridge, steel);
    r.position.set(mm(1.2), mm(70 + i * 2.4), 0);
    group.add(r);
  }
  const grip = new THREE.Object3D();
  grip.position.y = mm(1);
  group.add(grip);
  return { group, grip, setHeat: (k) => (bladeMat.emissiveIntensity = 2.2 * THREE.MathUtils.clamp(k, 0, 1) ** 1.5) };
}
