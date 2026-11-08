import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Tracker } from '../types';

export interface RockOptions {
  /** Bán kính trung bình (đơn vị cảnh). */
  radius?: number;
  /** Mức chia icosahedron (lump 18–28, mảnh vụn 2–4). */
  detail?: number;
  seed?: number;
  /** Biên độ gồ ghề lớn (tỉ lệ bán kính). */
  bumps?: number;
  /** Biên độ hạt mịn bề mặt (tỉ lệ bán kính). */
  grain?: number;
  /** Số mặt cắt phẳng (mảnh đập vỡ có cạnh sắc). */
  facets?: number;
  /** Co giãn theo trục (viên dẹt kiểu sỏi). */
  squash?: [number, number, number];
  /** Màu nền + màu vân (tô bằng màu đỉnh). */
  color?: THREE.ColorRepresentation;
  vein?: THREE.ColorRepresentation;
  /** true = pháp tuyến theo mặt (mảnh vỡ sắc cạnh). */
  flat?: boolean;
}

const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

/**
 * A-CHAT-RAN – hòn đá thủ tục: icosahedron + dịch theo nhiễu fbm (gồ ghề) + hạt mịn + các mặt cắt phẳng (vết vỡ),
 * tô màu đỉnh loang lổ (đá vôi, đá hoa, quặng…). Gốc ở tâm; bán kính ≈ `radius`.
 */
export function createRockGeometry(o: RockOptions = {}): THREE.BufferGeometry {
  const R = o.radius ?? 1;
  const seed = o.seed ?? 1;
  const rnd = rand(seed * 7919 + 13);
  const noise = new ImprovedNoise();
  const ofs = new THREE.Vector3(rnd() * 100, rnd() * 100, rnd() * 100);
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, o.detail ?? 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const fbm = (v: THREE.Vector3, f: number, oct: number) => {
    let s = 0;
    let a = 1;
    let n = 0;
    for (let i = 0; i < oct; i++) {
      s += a * noise.noise(v.x * f + ofs.x, v.y * f + ofs.y, v.z * f + ofs.z);
      n += a;
      a *= 0.5;
      f *= 2.1;
    }
    return s / n;
  };
  const planes = Array.from({ length: o.facets ?? 0 }, () => ({
    n: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
    d: 0.55 + rnd() * 0.3,
  }));
  const sq = o.squash ?? [1, 1, 1];
  const bumps = o.bumps ?? 0.22;
  const grain = o.grain ?? 0.03;
  const base = new THREE.Color(o.color ?? 0xd9d4c8);
  const vein = new THREE.Color(o.vein ?? 0x9d958a);
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize();
    let r = 1 + bumps * fbm(p, 1.3, 3) + grain * noise.noise(p.x * 14 + ofs.y, p.y * 14, p.z * 14 + ofs.x);
    q.copy(p).multiplyScalar(r);
    for (const pl of planes) {
      const k = q.dot(pl.n);
      if (k > pl.d) q.addScaledVector(pl.n, pl.d - k);
    }
    r = q.length();
    q.set(q.x * sq[0], q.y * sq[1], q.z * sq[2]).multiplyScalar(R);
    pos.setXYZ(i, q.x, q.y, q.z);
    // Màu: vân loang + điểm sẫm ở chỗ lõm.
    const m = THREE.MathUtils.clamp(0.5 + 0.9 * fbm(p, 3.2, 3), 0, 1);
    c.copy(base).lerp(vein, m * m * 0.85);
    c.multiplyScalar(0.86 + 0.14 * THREE.MathUtils.clamp((r - 0.8) * 2.5, 0, 1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (o.flat) g = g.toNonIndexed();
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Vật liệu đá: màu theo đỉnh, nhám cao, không kim loại. */
export function createRockMaterial(ctx: Tracker, o: { roughness?: number; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  return ctx.track(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.roughness ?? 0.93, metalness: 0, flatShading: o.flat ?? false }),
  );
}

export interface RockInstances {
  meshes: THREE.InstancedMesh[];
  group: THREE.Group;
  readonly max: number;
  /** Số hạt hiện (≤ max). */
  count: number;
  /** Tư thế hạt i (toạ độ group); scale = hệ số so với bán kính gốc, 0 = ẩn. */
  setPose(i: number, pos: THREE.Vector3, quat: THREE.Quaternion, scale: number): void;
  commit(): void;
}

/** Nhiều hòn đá (mảnh vụn) bằng InstancedMesh – `variants` hình khác nhau xoay vòng theo chỉ số. */
export function createRockInstances(ctx: Tracker, max: number, o: RockOptions & { variants?: number } = {}): RockInstances {
  const V = Math.max(1, Math.min(o.variants ?? 4, max));
  const mat = createRockMaterial(ctx, { flat: o.flat });
  const group = new THREE.Group();
  group.name = 'rocks';
  const per = Math.ceil(max / V);
  const meshes = Array.from({ length: V }, (_, v) => {
    const geo = ctx.track(createRockGeometry({ ...o, seed: (o.seed ?? 1) * 31 + v }));
    const mesh = new THREE.InstancedMesh(geo, mat, per);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    group.add(mesh);
    return mesh;
  });
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const api: RockInstances = {
    meshes,
    group,
    max,
    count: 0,
    setPose(i, pos, quat, scale) {
      const mesh = meshes[i % V];
      mesh.setMatrixAt(Math.floor(i / V), scale > 0 ? m.compose(pos, quat, s.setScalar(scale)) : zero);
    },
    commit() {
      meshes.forEach((mesh, v) => {
        mesh.count = Math.max(0, Math.ceil((api.count - v) / V));
        mesh.instanceMatrix.needsUpdate = true;
      });
    },
  };
  return api;
}
