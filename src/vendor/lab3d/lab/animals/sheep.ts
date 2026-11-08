import * as THREE from 'three';
import type { Tracker } from '../types';

/**
 * A-CUU: cừu cái procedural (thang dm, cao vai ≈ 7 dm, dài ≈ 11 dm). Gốc ở mặt đất giữa bốn chân, đầu hướng +x.
 * Thân lông = cầu nhiễu + búp lông InstancedMesh; đầu, tai, chân màu "mặt"; sừng xoắn tuỳ chọn (Scottish Blackface).
 */
export interface SheepLook {
  wool: THREE.ColorRepresentation;
  face: THREE.ColorRepresentation;
  horns?: boolean;
}

export interface Sheep {
  group: THREE.Group;
  /** Điểm gần bầu vú / bụng (toạ độ group) – chỗ lấy mẫu, chỗ cấy phôi. */
  udder: THREE.Vector3;
  setLook(look: SheepLook): void;
  /** 0…1: bụng to dần khi mang thai. */
  setBelly(k: number): void;
  update(dt: number, elapsed: number): void;
}

function fleece(radii: THREE.Vector3, seed: number, detail = 5): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 9 + seed) * Math.sin(v.y * 11 + seed * 2) * Math.sin(v.z * 10 + seed * 3);
    v.multiplyScalar(1 + 0.05 * n + 0.025 * Math.sin(v.x * 23 + v.z * 19));
    p.setXYZ(i, v.x * radii.x, v.y * radii.y, v.z * radii.z);
  }
  g.computeVertexNormals();
  return g;
}

export function createSheep(ctx: Tracker, o: { look: SheepLook; seed?: number }): Sheep {
  const seed = o.seed ?? 1;
  const wool = ctx.track(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }));
  const curlMat = ctx.track(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }));
  const face = ctx.track(new THREE.MeshStandardMaterial({ roughness: 0.75 }));
  const hoof = ctx.track(new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.6 }));
  const hornMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#b7a789', roughness: 0.55 }));
  const eyeMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#141210', roughness: 0.2 }));
  const group = new THREE.Group();
  group.name = 'sheep';
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group) => {
    const m = new THREE.Mesh(ctx.track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const torso = new THREE.Group();
  torso.position.set(0, 5.1, 0);
  group.add(torso);
  const R = new THREE.Vector3(5.1, 2.75, 2.7);
  add(fleece(R, seed), wool, 0, 0, 0, torso);
  add(fleece(new THREE.Vector3(1.9, 1.8, 1.6), seed + 4, 3), wool, 4.1, 1.1, 0, torso).rotation.z = 0.7;
  add(fleece(new THREE.Vector3(0.9, 0.7, 0.7), seed + 7, 2), wool, -5.0, 0.6, 0, torso);
  // Búp lông xoăn rải trên mặt thân.
  const curlGeo = ctx.track(new THREE.IcosahedronGeometry(0.62, 1));
  const N = 320;
  const curls = new THREE.InstancedMesh(curlGeo, curlMat, N);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996 + seed;
    const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    if (dir.y < -0.55) dir.y = -0.55;
    const pos = dir.clone().multiply(R).multiplyScalar(0.97);
    m4.compose(pos, q.random(), new THREE.Vector3().setScalar(0.75 + 0.5 * Math.abs(Math.sin(i * 7.1))));
    curls.setMatrixAt(i, m4);
    curls.setColorAt(i, c.setScalar(0.86 + 0.14 * Math.abs(Math.sin(i * 3.3))));
  }
  curls.castShadow = true;
  torso.add(curls);
  ctx.track(curls);

  // Chân: phần trên lẫn trong lông, cẳng màu mặt, móng sẫm.
  for (const [x, z] of [[3.0, 1.2], [3.0, -1.2], [-3.1, 1.25], [-3.1, -1.25]]) {
    add(new THREE.CylinderGeometry(0.36, 0.3, 3.6, 12), face, x, 2.0, z);
    add(new THREE.CylinderGeometry(0.33, 0.36, 0.38, 12), hoof, x, 0.19, z);
  }

  // Đầu: hộp sọ thuôn, mõm, tai, mắt, lông đỉnh đầu; nhóm `head` để gật/quay.
  const head = new THREE.Group();
  head.position.set(6.1, 7.0, 0);
  group.add(head);
  const skull = add(new THREE.SphereGeometry(1, 28, 20), face, 0.55, -0.35, 0, head);
  skull.scale.set(1.55, 1.0, 0.82);
  skull.rotation.z = -0.55;
  const muzzle = add(new THREE.SphereGeometry(0.62, 20, 14), face, 1.55, -1.15, 0, head);
  muzzle.scale.set(1.1, 0.9, 0.95);
  add(fleece(new THREE.Vector3(0.95, 0.6, 0.85), seed + 9, 2), wool, -0.25, 0.55, 0, head);
  for (const s of [1, -1]) {
    const ear = add(new THREE.SphereGeometry(1, 16, 10), face, -0.35, 0.05, s * 0.95, head);
    ear.scale.set(0.75, 0.22, 0.32);
    ear.rotation.set(s * 0.5, s * 0.9, -0.25);
    add(new THREE.SphereGeometry(0.13, 10, 8), eyeMat, 0.75, -0.05, s * 0.66, head);
  }
  const horns = new THREE.Group();
  head.add(horns);
  for (const s of [1, -1]) {
    const h = add(new THREE.TorusGeometry(0.55, 0.16, 10, 24, Math.PI * 1.45), hornMat, -0.25, 0.2, s * 0.8, horns);
    h.rotation.set(0, s * 0.35, -0.6);
  }

  const udder = new THREE.Vector3(-2.2, 2.6, 0);
  let belly = 0;
  const phase = seed * 1.7;
  const sheep: Sheep = {
    group,
    udder,
    setLook(l) {
      wool.color.set(l.wool);
      curlMat.color.set(l.wool);
      face.color.set(l.face);
      horns.visible = !!l.horns;
    },
    setBelly(k) {
      belly = Math.min(1, Math.max(0, k));
    },
    update(_dt, t) {
      const breathe = 1 + 0.012 * Math.sin(t * 2.2 + phase);
      torso.scale.set(1, (1 + 0.12 * belly) * breathe, (1 + 0.16 * belly) * breathe);
      torso.position.y = 5.1 - 0.25 * belly;
      // Thỉnh thoảng cúi gặm cỏ rồi ngẩng lên, quay đầu nhẹ.
      const graze = Math.max(0, Math.sin(t * 0.35 + phase)) ** 6;
      head.rotation.z = -0.9 * graze;
      head.position.y = 7.0 - 1.6 * graze;
      head.rotation.y = 0.25 * Math.sin(t * 0.5 + phase * 2);
    },
  };
  sheep.setLook(o.look);
  return sheep;
}
