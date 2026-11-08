import * as THREE from 'three';
import { createMetalMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import type { LabAccent } from '../materials/palette';
import type { Tracker } from '../types';

/**
 * Quy ước chung cho dụng cụ cầm tay (src/lab/handTools):
 *  - Gốc `group` ở ĐẦU LÀM VIỆC (mũi panh/kim/bút, lòng thìa, mũi tip…).
 *  - Dụng cụ cầm ngang (panh, kéo, kim, dao, bút, thìa, đũa, thước) nằm theo +x, mặt phẳng dụng cụ song song mặt bàn;
 *    `axis: 'y'` = dựng đứng thân theo +y (cầm thẳng đứng gắp/nhúng từ trên xuống).
 *  - Dụng cụ hút/nhỏ (micropipette, pipet nhựa) mặc định +y như createDropper/createPipette – dùng ngay với createDropperGesture.
 *  - `tip` = Object3D con ở đầu làm việc (gắn vật gắp được: `tip.attach(obj)`), `grip` = chỗ tay cầm (neo cho bàn tay/createGrabbable).
 *  - Cán/quai/núm màu nhận diện đậm (LAB_ACCENT) để nhìn rõ trên máy chiếu; thân thép dùng labMaterials.steel().
 */
export interface HandTool {
  group: THREE.Group;
  /** Đầu làm việc (con của group). */
  tip: THREE.Object3D;
  /** Chỗ tay cầm (con của group). */
  grip: THREE.Object3D;
}

export type ToolAxis = 'x' | 'y';

/** Màu cán: tên LAB_ACCENT / mã hex, 'wood' (gỗ), 'steel' (liền thép), 'dark' (nhựa đen TRIM). */
export type HandleColor = LabAccent | 'wood' | 'steel' | 'dark' | (string & {});

const steels = new WeakMap<object, THREE.MeshStandardMaterial>();

/**
 * Thép dụng cụ cầm tay: xám sẫm hơn labMaterials.steel() – thép sáng phản chiếu softbox nên trên mặt bàn trắng (preset bench)
 * lưỡi/càng mảnh chìm hẳn; bản này đọc rõ là kim loại xám trên nền sáng mà vẫn ánh kim.
 */
export function toolSteel(ctx: Tracker): THREE.MeshStandardMaterial {
  let m = steels.get(ctx);
  if (!m) {
    m = ctx.track(createMetalMaterial(0x5b636c, 0.45, 0.55));
    // Phản chiếu softbox yếu đi – mặt trên lá panh/lưỡi kéo không loá trắng như mặt bàn.
    m.envMapIntensity = 0.45;
    steels.set(ctx, m);
    ctx.track(() => steels.delete(ctx));
  }
  return m;
}

export function handleMaterial(ctx: Tracker, c: HandleColor): THREE.Material {
  const m = labMaterials(ctx);
  if (c === 'wood') return m.wood();
  if (c === 'steel') return toolSteel(ctx);
  if (c === 'dark') return m.trim();
  return m.plastic(c);
}

/** Khung dụng cụ: `group` (gốc ở đầu làm việc) chứa `body` (dựng theo +x); axis 'y' xoay body để thân theo +y. */
export function toolFrame(name: string, axis: ToolAxis = 'x') {
  const group = new THREE.Group();
  group.name = name;
  const body = new THREE.Group();
  body.name = `${name}-body`;
  if (axis === 'y') body.rotation.z = Math.PI / 2;
  group.add(body);
  return { group, body };
}

/** Điểm neo con của `parent`. */
export function anchor(parent: THREE.Object3D, name: string, x: number, y = 0, z = 0): THREE.Object3D {
  const a = new THREE.Object3D();
  a.name = name;
  a.position.set(x, y, z);
  parent.add(a);
  return a;
}

/** Mesh đổ bóng, thêm vào `parent`. */
export function part<T extends THREE.BufferGeometry>(ctx: Tracker, parent: THREE.Object3D, geo: T, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(ctx.track(geo), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Trụ nằm theo trục x từ x0 tới x1 (bán kính đầu r0 → r1). */
export function rodX(ctx: Tracker, parent: THREE.Object3D, r0: number, r1: number, x0: number, x1: number, mat: THREE.Material, seg = 12) {
  const geo = new THREE.CylinderGeometry(r1, r0, x1 - x0, seg).rotateZ(-Math.PI / 2);
  return part(ctx, parent, geo, mat, (x0 + x1) / 2);
}

/** Thép nung được (vật liệu riêng – nung đỏ không lan sang dụng cụ khác); `heat(k)` 0…1. */
export function heatableSteel(ctx: Tracker) {
  const mat = ctx.track(toolSteel(ctx).clone());
  mat.emissive.set('#ff5a1a');
  mat.emissiveIntensity = 0;
  return { mat, heat: (k: number) => void (mat.emissiveIntensity = 2.2 * THREE.MathUtils.clamp(k, 0, 1) ** 1.5) };
}
