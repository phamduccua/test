import * as THREE from 'three';
import { createMetalMaterial, createPlasticMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';

/** Màu quy ước cực: đỏ (+), đen (−). */
export const POLE_COLORS = { plus: 0xc8242b, minus: 0x1d1f23 } as const;

const mats = new WeakMap<object, Map<string, THREE.Material>>();
/** Vật liệu nhỏ dùng chung trong kit điện (theo ctx). */
export function electricMat<T extends THREE.Material>(ctx: Tracker, key: string, make: () => T): T {
  let m = mats.get(ctx);
  if (!m) mats.set(ctx, (m = new Map()));
  let v = m.get(key) as T | undefined;
  if (!v) m.set(key, (v = ctx.track(make())));
  return v;
}

export const brass = (ctx: Tracker) => electricMat(ctx, 'brass', () => createMetalMaterial(0xd6b46a, 0.28, 1));
export const nickel = (ctx: Tracker) => electricMat(ctx, 'nickel', () => createMetalMaterial(0xd9dde2, 0.22, 1));

/** Cọc đấu dây (binding post): đế ren đồng + núm nhựa màu. Gốc ở đáy; `wirePoint` = lỗ luồn dây (cục bộ). */
export function createBindingPost(ctx: Tracker, color: THREE.ColorRepresentation): { group: THREE.Group; wirePoint: THREE.Vector3 } {
  const group = new THREE.Group();
  group.name = 'binding-post';
  const cap = electricMat(ctx, `post-${new THREE.Color(color).getHexString()}`, () => {
    const m = createPlasticMaterial(color, 0.32);
    m.clearcoat = 0.7;
    return m;
  });
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(mm(4.2), mm(4.2), mm(3), 6), brass(ctx));
  nut.position.y = mm(1.5);
  const stud = new THREE.Mesh(new THREE.CylinderGeometry(mm(1.8), mm(1.8), mm(6), 12), brass(ctx));
  stud.position.y = mm(6);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(mm(4.6), mm(5), mm(7), 16), cap);
  knob.position.y = mm(12);
  const top = new THREE.Mesh(new THREE.SphereGeometry(mm(4.6), 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap);
  top.position.y = mm(15.5);
  top.scale.y = 0.45;
  for (const m of [nut, stud, knob, top]) {
    m.castShadow = true;
    group.add(m);
  }
  return { group, wirePoint: new THREE.Vector3(0, mm(7), 0) };
}
