import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { labMaterials } from '../materials/kit';
import type { SimContext } from '../../sim/types';

/**
 * A-VI-THAO-TAC: bộ vi thao tác 3 trục (kiểu cơ khí) đứng cạnh kính hiển vi. Gốc = giữa đáy đế; dụng cụ chĩa về −x.
 * Cụm trượt (3 khối ray + 3 núm vặn) mang tay kẹp; dụng cụ thuỷ tinh gắn vào tay kẹp, đầu dụng cụ ở `tip`.
 */
export interface MicromanipulatorOptions {
  /** Chiều cao điểm kẹp dụng cụ so với đế (đv, mặc định 1,55). */
  height?: number;
  /** Đầu dụng cụ cách điểm kẹp (đầu tay kẹp, x = −0,3) theo −x (reach) và xuống dưới (drop). */
  reach?: number;
  drop?: number;
  /** Dụng cụ: đầu nhọn ở gốc toạ độ, thân chạy theo +x (vd. `createGlassMicrotool`). */
  tool?: THREE.Object3D;
  color?: THREE.ColorRepresentation;
}

export interface Micromanipulator {
  group: THREE.Group;
  /** Đầu dụng cụ (toạ độ group) khi độ dời = 0. */
  tip: THREE.Vector3;
  /** Dời cụm trượt (đv, toạ độ group) – đầu dụng cụ dời theo; núm vặn tự quay. */
  setOffset(x: number, y: number, z: number): void;
  update(dt: number): void;
}

export function createMicromanipulator(ctx: SimContext, o: MicromanipulatorOptions = {}): Micromanipulator {
  const mats = labMaterials(ctx);
  const paint = ctx.track(new THREE.MeshStandardMaterial({ color: o.color ?? '#30343b', roughness: 0.45, metalness: 0.2 }));
  const alu = ctx.track(new THREE.MeshStandardMaterial({ color: '#b9bec6', roughness: 0.3, metalness: 0.85 }));
  const chrome = mats.chrome();
  const knobMat = mats.blackRubber();
  const H = o.height ?? 1.55;
  const reach = o.reach ?? 1.2;
  const drop = o.drop ?? 0.25;
  const g = new THREE.Group();
  g.name = 'micromanipulator';
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(ctx.track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // Đế nặng + cột đứng (ray trục z – lên/xuống).
  add(new RoundedBoxGeometry(0.62, 0.06, 0.56, 3, 0.02), paint, 0.05, 0.03, 0);
  add(new RoundedBoxGeometry(0.16, H - 0.1, 0.18, 3, 0.02), paint, 0.2, (H - 0.1) / 2 + 0.06, 0);
  add(new THREE.BoxGeometry(0.02, H - 0.3, 0.06), alu, 0.115, H / 2, 0);

  const carriage = new THREE.Group();
  g.add(carriage);
  // Khối trượt dọc (Z), khối trượt ngang sâu (Y), ray ngang (X) chĩa về phía bàn kính.
  add(new RoundedBoxGeometry(0.2, 0.22, 0.24, 3, 0.02), alu, 0.1, H, 0, carriage);
  add(new RoundedBoxGeometry(0.22, 0.08, 0.3, 3, 0.015), paint, 0.02, H + 0.15, 0, carriage);
  add(new RoundedBoxGeometry(0.42, 0.07, 0.11, 3, 0.015), alu, -0.12, H + 0.06, 0, carriage);
  const knobs: THREE.Mesh[] = [];
  const knob = (x: number, y: number, z: number, axis: 'x' | 'y' | 'z') => {
    const k = add(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 20), knobMat, x, y, z, carriage);
    if (axis === 'x') k.rotation.z = Math.PI / 2;
    if (axis === 'z') k.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.065, 12), chrome, 0, 0, 0, k);
    knobs.push(k);
  };
  knob(0.24, H + 0.06, 0, 'x');
  knob(0.1, H + 0.15, 0.2, 'z');
  knob(0.1, H - 0.17, 0.0, 'y');

  // Tay kẹp: ống nhôm nghiêng theo dụng cụ, đầu kẹp có vít.
  const angle = Math.atan2(drop, reach);
  const holder = new THREE.Group();
  holder.position.set(-0.3, H, 0);
  holder.rotation.z = angle;
  carriage.add(holder);
  const sleeve = add(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 16), alu, 0.12, 0, 0, holder);
  sleeve.rotation.z = Math.PI / 2;
  const collet = add(new THREE.CylinderGeometry(0.022, 0.03, 0.06, 16), chrome, -0.08, 0, 0, holder);
  collet.rotation.z = Math.PI / 2;
  if (o.tool) {
    // Đầu nhọn cách điểm kẹp đúng hypot(reach, drop) theo −x của tay kẹp; phần thân còn lại nằm trong ống kẹp.
    o.tool.position.set(-Math.hypot(reach, drop), 0, 0);
    holder.add(o.tool);
  }
  const tip = new THREE.Vector3(-0.3 - reach, H - drop, 0);
  const cur = new THREE.Vector3();
  const goal = new THREE.Vector3();
  return {
    group: g,
    tip,
    setOffset(x, y, z) {
      goal.set(x, y, z);
    },
    update(dt) {
      const prev = cur.clone();
      cur.lerp(goal, 1 - Math.exp(-dt * 6));
      carriage.position.copy(cur);
      const d = cur.clone().sub(prev);
      knobs[0].rotation.x += d.x * 40;
      knobs[1].rotation.y += d.z * 40;
      knobs[2].rotation.y += d.y * 40;
    },
  };
}

/** Dụng cụ thuỷ tinh kéo nhỏ: 'hook' = kim có móc ở đầu, 'holding' = ống giữ đầu tù. Đầu ở gốc, thân theo +x. */
export function createGlassMicrotool(ctx: SimContext, o: { kind: 'hook' | 'holding'; length?: number }): THREE.Group {
  const L = o.length ?? 1.25;
  const mat = ctx.track(new THREE.MeshPhysicalMaterial({ color: '#d7ecf2', roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }));
  const g = new THREE.Group();
  const r0 = o.kind === 'hook' ? 0.0012 : 0.004;
  const pts = [
    new THREE.Vector2(r0, 0),
    new THREE.Vector2(o.kind === 'hook' ? 0.003 : 0.006, L * 0.12),
    new THREE.Vector2(0.008, L * 0.3),
    new THREE.Vector2(0.008, L),
  ];
  const shaft = new THREE.Mesh(ctx.track(new THREE.LatheGeometry(pts, 12)), mat);
  shaft.rotation.z = -Math.PI / 2;
  g.add(shaft);
  if (o.kind === 'hook') {
    // Móc nhỏ uốn cong ở đầu kim.
    const hook = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(0.006, 0.0012, 6, 12, Math.PI * 1.2)), mat);
    hook.position.set(0.001, -0.006, 0);
    g.add(hook);
  }
  return g;
}
