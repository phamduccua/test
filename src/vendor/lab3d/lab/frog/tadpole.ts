import * as THREE from 'three';
import type { Tracker } from '../types';
import { plainMaterial, skinMaterial, SKIN_COLORS, type FrogSkin } from './skin';

/**
 * A-NONG-NOC: nòng nọc – thân bầu (đầu hướng +x), đuôi dẹt 4 đốt nối tiếp uốn theo sóng khi bơi.
 * Gốc ở tâm thân, dài toàn bộ ≈ `length` (đv). `swim(dt, speed)`: speed 0 = nằm yên, 1 = bơi nhanh.
 * `bent` = đuôi cong lệch (phôi dị dạng).
 */
export interface Tadpole {
  group: THREE.Group;
  setSkin(skin: FrogSkin): void;
  swim(dt: number, speed: number): void;
}

const SEG = 4;
const SEG_L = 0.15;

const cache = new WeakMap<Tracker, { body: THREE.SphereGeometry; fins: THREE.BufferGeometry[]; muscle: THREE.CapsuleGeometry }>();
function shared(ctx: Tracker) {
  let c = cache.get(ctx);
  if (c) return c;
  const fins: THREE.BufferGeometry[] = [];
  for (let i = 0; i < SEG; i++) {
    const h0 = 0.15 * (1 - i / SEG) + 0.01;
    const h1 = 0.15 * (1 - (i + 1) / SEG) + 0.01;
    const s = new THREE.Shape();
    s.moveTo(0, -h0 * 0.8).lineTo(-SEG_L - 0.004, -h1 * 0.8).lineTo(-SEG_L - 0.004, h1).lineTo(0, h0).closePath();
    fins.push(ctx.track(new THREE.ShapeGeometry(s)));
  }
  c = {
    body: ctx.track(new THREE.SphereGeometry(1, 28, 18)),
    fins,
    muscle: ctx.track(new THREE.CapsuleGeometry(1, 1, 3, 10).rotateZ(Math.PI / 2)),
  };
  cache.set(ctx, c);
  return c;
}

export function createTadpole(ctx: Tracker, o: { skin: FrogSkin; length?: number; bent?: boolean; variant?: number } = { skin: 'A' }): Tadpole {
  const geo = shared(ctx);
  const g = new THREE.Group();
  g.name = 'tadpole';
  const root = new THREE.Group();
  root.scale.setScalar(o.length ?? 1);
  g.add(root);
  const finMat = (s: FrogSkin) => {
    const m = plainMaterial(ctx, new THREE.Color(SKIN_COLORS[s].side).lerp(new THREE.Color('#d8d0a8'), 0.35), 0.5);
    m.side = THREE.DoubleSide;
    return m;
  };
  const body = new THREE.Mesh(geo.body, skinMaterial(ctx, o.skin, o.variant ?? 0));
  body.scale.set(0.24, 0.17, 0.18);
  body.castShadow = true;
  root.add(body);
  const eyeMat = plainMaterial(ctx, '#0d0d0d', 0.12);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(geo.body, eyeMat);
    e.scale.setScalar(0.035);
    e.position.set(0.13, 0.05, s * 0.135);
    root.add(e);
  }
  const pivots: THREE.Group[] = [];
  const fins: THREE.Mesh[] = [];
  const muscles: THREE.Mesh[] = [];
  let parent: THREE.Object3D = root;
  for (let i = 0; i < SEG; i++) {
    const p = new THREE.Group();
    p.position.x = i === 0 ? -0.2 : -SEG_L;
    parent.add(p);
    const fin = new THREE.Mesh(geo.fins[i], finMat(o.skin));
    p.add(fin);
    fins.push(fin);
    const r = 0.04 * (1 - i / SEG) + 0.008;
    const mu = new THREE.Mesh(geo.muscle, skinMaterial(ctx, o.skin, o.variant ?? 0));
    mu.scale.set(SEG_L / 2, r, r);
    mu.position.x = -SEG_L / 2;
    p.add(mu);
    muscles.push(mu);
    pivots.push(p);
    parent = p;
  }
  const bend = o.bent ? 0.35 : 0;
  let phase = Math.random() * 6;
  return {
    group: g,
    setSkin(s) {
      body.material = skinMaterial(ctx, s, o.variant ?? 0);
      muscles.forEach((m) => (m.material = body.material));
      fins.forEach((f) => (f.material = finMat(s)));
    },
    swim(dt, speed) {
      phase += dt * (2 + 14 * speed);
      const amp = 0.08 + 0.32 * speed;
      pivots.forEach((p, i) => (p.rotation.y = bend * (i + 1) * 0.3 + Math.sin(phase - i * 0.9) * amp * (0.4 + i * 0.25)));
      root.rotation.y = -Math.sin(phase) * amp * 0.15;
    },
  };
}
