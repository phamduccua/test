import * as THREE from 'three';
import { createFrog, type Frog } from '../../lab/frog/frog';
import type { FrogSkin } from '../../lab/frog/skin';
import { createTadpole, type Tadpole } from '../../lab/frog/tadpole';
import type { Tracker } from '../../lab/types';
import { EGG_COLORS, embryoKit, fibonacciSphere } from './eggParts';

/**
 * A-PHOI-ECH: phôi ếch theo giai đoạn (bán kính trứng = 1). `set(stage, dead, skin)`:
 * 0 trứng · 1 phân cắt (2 → 4 → 8 tế bào) · 2 phôi nang · 3 phôi vị (lỗ phôi + nút noãn hoàng) · 4 phôi thần kinh (nếp thần kinh khép dần)
 * · 5 phôi đuôi – nở (dài ra, đuôi mọc) · 6 nòng nọc · 7 ếch con. Phần lẻ = tiến độ trong giai đoạn. Đến phôi đuôi vẫn mang màu trứng (sắc tố
 * của tế bào chất trứng), từ khi nở màu da theo `skin`. Chết → khối trắng đục. Đầu hướng +x.
 */
export interface Embryo {
  group: THREE.Group;
  set(stage: number, dead: boolean, skin: FrogSkin | null): void;
  update(dt: number, speed: number): void;
}

const CLEAVE = [
  [[0.36, 0, 0, 0.66, 0.98, 0.98], [-0.36, 0, 0, 0.66, 0.98, 0.98]],
  [[0.36, 0, 0.36, 0.64, 0.98, 0.64], [-0.36, 0, 0.36, 0.64, 0.98, 0.64], [0.36, 0, -0.36, 0.64, 0.98, 0.64], [-0.36, 0, -0.36, 0.64, 0.98, 0.64]],
];
const CELLS = fibonacciSphere(150);

export function createEmbryo(ctx: Tracker): Embryo {
  const k = embryoKit(ctx);
  const g = new THREE.Group();
  g.name = 'embryo';
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const egg = mesh(k.egg, k.mat);
  // Phân cắt: 8 phôi bào (2 tầng); 2 và 4 tế bào dùng 4 khối đầu.
  const blasto = Array.from({ length: 8 }, () => mesh(k.egg, k.mat));
  // Phôi nang: nhiều tế bào nhỏ phủ mặt.
  const cells = new THREE.InstancedMesh(k.sphere, k.plain('#ffffff'), CELLS.length);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  CELLS.forEach((p, i) => {
    const t = THREE.MathUtils.smoothstep(p.y, -0.25, 0.18);
    col.set(EGG_COLORS.vegetal).lerp(new THREE.Color(EGG_COLORS.animal), t);
    cells.setColorAt(i, col);
  });
  g.add(cells);
  const lip = mesh(k.ring, k.plain('#2a1c12'));
  const plug = mesh(k.sphere, k.plain(EGG_COLORS.vegetal));
  const folds = [1, -1].map(() => mesh(k.capsule, k.plain('#4b3626')));
  const tail = mesh(k.capsule, k.plain('#6b5440'));
  const eyes = [1, -1].map(() => mesh(k.sphere, k.plain('#151010')));
  const deadMat = k.plain(EGG_COLORS.dead);
  const dead = mesh(k.sphere, deadMat);
  const fuzz = new THREE.InstancedMesh(k.sphere, deadMat, 40);
  for (let i = 0; i < 40; i++) {
    const p = CELLS[(i * 37) % CELLS.length];
    m4.compose(p.clone().multiply(new THREE.Vector3(1.04, 0.82, 1.04)), new THREE.Quaternion(), new THREE.Vector3().setScalar(0.1 + (i % 5) * 0.03));
    fuzz.setMatrixAt(i, m4);
  }
  g.add(fuzz);
  let tad: Tadpole | null = null;
  let frog: Frog | null = null;
  let skinNow: FrogSkin | null = null;
  const all = () => [egg, ...blasto, cells, lip, plug, ...folds, tail, ...eyes, dead, fuzz];

  return {
    group: g,
    set(stage, isDead, skin) {
      all().forEach((o) => (o.visible = false));
      if (tad) tad.group.visible = false;
      if (frog) frog.group.visible = false;
      const s = Math.floor(stage);
      const f = stage - s;
      if (isDead) {
        dead.visible = fuzz.visible = true;
        const L = s >= 5 ? 1.5 : 1;
        dead.scale.set(1.02 * L, 0.78, 1.02);
        return;
      }
      egg.scale.set(1, 1, 1);
      egg.rotation.set(0, 0, 0);
      if (s === 0) egg.visible = true;
      else if (s === 1) {
        const n = f < 0.33 ? 0 : f < 0.66 ? 1 : 2;
        blasto.forEach((b, i) => {
          const spec = n < 2 ? CLEAVE[n][i] : [i % 2 ? 0.3 : -0.3, i < 4 ? 0.38 : -0.32, (i >> 1) % 2 ? 0.3 : -0.3, i < 4 ? 0.5 : 0.6, i < 4 ? 0.5 : 0.62, i < 4 ? 0.5 : 0.6];
          b.visible = !!spec;
          if (!spec) return;
          b.position.set(spec[0], spec[1], spec[2]);
          b.scale.set(spec[3], spec[4], spec[5]);
        });
      } else if (s === 2) {
        egg.visible = cells.visible = true;
        egg.scale.setScalar(0.97);
        const sz = 0.24 - 0.11 * f;
        CELLS.forEach((p, i) => cells.setMatrixAt(i, m4.compose(p, new THREE.Quaternion(), new THREE.Vector3().setScalar(sz * (p.y < 0 ? 1.3 : 1)))));
        cells.instanceMatrix.needsUpdate = true;
      } else if (s === 3) {
        // Phôi vị: lỗ phôi ở cực thực vật thu hẹp dần quanh nút noãn hoàng (nhìn từ bên, lệch về sau).
        egg.visible = lip.visible = plug.visible = true;
        egg.rotation.z = 0.9;
        const r = 0.75 * (1 - f) + 0.18;
        const d = Math.sqrt(Math.max(0, 1 - r * r));
        const dir = new THREE.Vector3(-0.78, -0.62, 0).normalize();
        lip.position.copy(dir).multiplyScalar(d);
        lip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        lip.scale.set(r, r, 0.6);
        plug.position.copy(dir).multiplyScalar(d * 0.98);
        plug.scale.set(r * 0.9, r * 0.9, r * 0.9).multiply(new THREE.Vector3(1, 1, 0.5));
        plug.quaternion.copy(lip.quaternion);
      } else if (s === 4) {
        egg.visible = true;
        egg.scale.set(1.1 + 0.15 * f, 0.92, 0.95);
        egg.rotation.z = 0.15;
        folds.forEach((fo, i) => {
          fo.visible = true;
          const gap = 0.32 * (1 - f) + 0.04;
          fo.position.set(0, 0.84, (i ? -1 : 1) * gap);
          fo.scale.set(0.09, 0.9 + 0.3 * f, 0.09);
          fo.rotation.set(0, 0, Math.PI / 2);
        });
      } else if (s === 5) {
        const L = 1.25 + 0.55 * f;
        egg.visible = tail.visible = true;
        egg.scale.set(L, 0.72 - 0.08 * f, 0.66 - 0.06 * f);
        tail.position.set(-L - 0.25 * f, 0.08, 0);
        tail.scale.set(0.16, 0.2 + 1.2 * f, 0.1);
        tail.rotation.set(0, 0, Math.PI / 2 - 0.25);
        eyes.forEach((e, i) => {
          e.visible = f > 0.4;
          e.position.set(L * 0.72, 0.18, (i ? -1 : 1) * 0.42);
          e.scale.setScalar(0.12);
        });
      } else if (s === 6) {
        if (!tad || skin !== skinNow) {
          if (tad) g.remove(tad.group);
          tad = createTadpole(ctx, { skin: skin ?? 'B', length: 4.2, bent: skin === 'mix' });
          g.add(tad.group);
        }
        tad.group.visible = true;
        tad.group.scale.setScalar(0.8 + 0.4 * Math.min(1, f * 3));
      } else {
        if (!frog || skin !== skinNow) {
          if (frog) g.remove(frog.group);
          frog = createFrog(ctx, { skin: skin ?? 'B', length: 2.6 });
          frog.group.position.y = -0.6;
          g.add(frog.group);
        }
        frog.group.visible = true;
      }
      skinNow = skin;
    },
    update(dt, speed) {
      if (tad?.group.visible) tad.swim(dt, speed);
      if (frog?.group.visible) frog.update(dt);
    },
  };
}
