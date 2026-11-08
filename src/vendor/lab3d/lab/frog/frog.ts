import * as THREE from 'three';
import type { Tracker } from '../types';
import { plainMaterial, skinMaterial, type FrogSkin } from './skin';

/**
 * A-ECH: ếch ngồi (trưởng thành hoặc ếch con). Gốc ở mặt đất dưới bụng, đầu hướng +x, dài thân ≈ `length` (đv).
 * `update(dt)` làm họng phập phồng và thỉnh thoảng nháy mắt.
 */
export interface Frog {
  group: THREE.Group;
  setSkin(skin: FrogSkin): void;
  update(dt: number): void;
}

const geoCache = new WeakMap<Tracker, { sphere: THREE.SphereGeometry; capsule: THREE.CapsuleGeometry }>();
function shared(ctx: Tracker) {
  let g = geoCache.get(ctx);
  if (!g) {
    g = { sphere: ctx.track(new THREE.SphereGeometry(1, 32, 20)), capsule: ctx.track(new THREE.CapsuleGeometry(1, 1, 4, 12)) };
    geoCache.set(ctx, g);
  }
  return g;
}

export function createFrog(ctx: Tracker, o: { skin: FrogSkin; length?: number; variant?: number } = { skin: 'A' }): Frog {
  const { sphere, capsule } = shared(ctx);
  const g = new THREE.Group();
  g.name = 'frog';
  const root = new THREE.Group();
  root.scale.setScalar(o.length ?? 1);
  g.add(root);
  let skin = skinMaterial(ctx, o.skin, o.variant ?? 0);
  const skinned: THREE.Mesh[] = [];
  const blob = (sx: number, sy: number, sz: number, x: number, y: number, z: number, rz = 0) => {
    const m = new THREE.Mesh(sphere, skin);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.rotation.z = rz;
    m.castShadow = true;
    root.add(m);
    skinned.push(m);
    return m;
  };
  const up = new THREE.Vector3(0, 1, 0);
  /** Chi: capsule nối a → b, bán kính r. */
  const limb = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    const m = new THREE.Mesh(capsule, skin);
    const d = b.clone().sub(a);
    m.scale.set(r, Math.max(0.01, d.length() - 2 * r), r);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(up, d.normalize());
    m.castShadow = true;
    root.add(m);
    skinned.push(m);
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  blob(0.46, 0.24, 0.34, -0.02, 0.24, 0, 0.32);
  blob(0.28, 0.17, 0.29, 0.34, 0.36, 0, -0.08);
  const throat = blob(0.2, 0.08, 0.2, 0.36, 0.25, 0);
  // Mắt lồi + đồng tử.
  const eyeMat = plainMaterial(ctx, '#c9a23a', 0.15);
  const pupilMat = plainMaterial(ctx, '#0b0b0b', 0.1);
  const lids: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const lid = blob(0.085, 0.06, 0.085, 0.42, 0.45, s * 0.15);
    lids.push(lid);
    const eye = new THREE.Mesh(sphere, eyeMat);
    eye.scale.setScalar(0.065);
    eye.position.set(0.44, 0.5, s * 0.17);
    const pupil = new THREE.Mesh(sphere, pupilMat);
    pupil.scale.set(0.028, 0.02, 0.028);
    pupil.position.set(0.462, 0.51, s * 0.218);
    root.add(eye, pupil);
  }
  // Chân sau gập (đùi – cẳng – bàn), chân trước chống thẳng.
  for (const s of [-1, 1]) {
    const hip = V(-0.3, 0.2, s * 0.22);
    const knee = V(0.02, 0.12, s * 0.42);
    const ankle = V(-0.32, 0.06, s * 0.4);
    const toe = V(0.0, 0.03, s * 0.5);
    limb(hip, knee, 0.085);
    limb(knee, ankle, 0.06);
    limb(ankle, toe, 0.035);
    for (const a of [-0.35, 0, 0.35]) limb(toe, toe.clone().add(V(Math.cos(a) * 0.12, -0.005, s * Math.sin(a) * 0.12 + s * 0.02)), 0.014);
    const sh = V(0.24, 0.24, s * 0.2);
    const hand = V(0.34, 0.03, s * 0.25);
    limb(sh, hand, 0.04);
    for (const a of [-0.5, 0, 0.5]) limb(hand, hand.clone().add(V(Math.cos(a) * 0.07, -0.005, s * Math.sin(a) * 0.07)), 0.012);
  }
  let t = Math.random() * 5;
  let blink = 2 + Math.random() * 3;
  return {
    group: g,
    setSkin(s) {
      skin = skinMaterial(ctx, s, o.variant ?? 0);
      skinned.forEach((m) => (m.material = skin));
    },
    update(dt) {
      t += dt;
      throat.scale.y = 0.08 + 0.025 * Math.max(0, Math.sin(t * 5));
      blink -= dt;
      const shut = blink < 0 ? 1 : 0;
      if (blink < -0.15) blink = 2 + Math.random() * 4;
      lids.forEach((l) => (l.scale.y = 0.06 + 0.05 * shut));
    },
  };
}
