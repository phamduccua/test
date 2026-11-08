import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import { latticeSites, neighborPairs, type CrystalPreset, type Site } from './lattice';

/** 'ballStick' = mô hình rỗng (Hình 11.1b), 'spaceFill' = mô hình đặc, ion tiếp xúc (Hình 11.1a). */
export type CrystalMode = 'ballStick' | 'spaceFill';
export type CrystalPalette = 'book' | 'cpk';

export interface CrystalOptions {
  /** Kích thước khối theo ô mạng (NaCl: (nút/cạnh − 1)/2). */
  extent: number;
  /** Đơn vị cảnh / Å. */
  scale?: number;
  mode?: CrystalMode;
  palette?: CrystalPalette;
  /** Tỉ lệ bán kính ion khi ở mô hình rỗng. */
  ballFactor?: number;
  edges?: boolean;
  /** Bản "mẫu ma" trong suốt. */
  ghost?: boolean;
}

export interface CrystalView {
  preset: CrystalPreset;
  sites: Site[];
  pairs: [number, number][];
  group: THREE.Group;
  /** Mỗi loài một InstancedMesh. */
  meshes: Record<string, THREE.InstancedMesh>;
  sticks: THREE.InstancedMesh;
  edges: THREE.LineSegments;
  /** Vị trí đích (toạ độ group) & trạng thái hiện tại của từng nút. */
  targets: THREE.Vector3[];
  pos: THREE.Vector3[];
  /** Hệ số xuất hiện 0…1 của từng nút / que (do hoạt cảnh lắp ráp ghi). */
  appear: number[];
  /** Hệ số nhấn mạnh kích thước từng nút (1 = bình thường; tô sáng có thể thu nhỏ các nút khác). */
  focus: number[];
  stickAppear: number[];
  scale: number;
  readonly mode: CrystalMode;
  setMode(m: CrystalMode, animate?: boolean): void;
  setPalette(p: CrystalPalette): void;
  /** Đổi màu một loài ion (vd. người dùng chọn màu đại diện cho Na⁺). */
  setColor(species: string, color: THREE.ColorRepresentation): void;
  /** Nhân màu từng nút (1 = bình thường, nhỏ = mờ tối). */
  setTint(i: number, k: number): void;
  /** Ghi ma trận instance từ pos/appear (gọi sau khi sửa). */
  commit(): void;
  update(dt: number): void;
  dispose(): void;
}

/** Dựng tinh thể ion: InstancedMesh cho từng loại ion + que nối (InstancedMesh) + cạnh khối. */
export function createCrystal(ctx: Tracker, preset: CrystalPreset, o: CrystalOptions): CrystalView {
  const kit = microMaterials(ctx);
  const s = o.scale ?? 0.12;
  const sites = latticeSites(preset, o.extent);
  const pairs = neighborPairs(sites, preset.nearest);
  const group = new THREE.Group();
  group.name = `crystal-${preset.id}`;
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (own.push(x), ctx.track(x));

  const mkMat = (color: number) =>
    o.ghost
      ? keep(new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, transparent: true, opacity: 0.2, depthWrite: false }))
      : kit.atom(color);
  const meshes: Record<string, THREE.InstancedMesh> = {};
  const slot: number[] = [];
  const counts: Record<string, number> = {};
  for (const site of sites) {
    slot.push(counts[site.species] ?? 0);
    counts[site.species] = (counts[site.species] ?? 0) + 1;
  }
  for (const [sp, n] of Object.entries(counts)) {
    const m = new THREE.InstancedMesh(kit.sphere(), mkMat(preset.species[sp].color), n);
    m.name = `ions-${sp}`;
    m.castShadow = !o.ghost;
    m.frustumCulled = false;
    for (let i = 0; i < n; i++) m.setColorAt(i, new THREE.Color(1, 1, 1));
    meshes[sp] = m;
    group.add(m);
  }
  const stickMat = o.ghost ? mkMat(0xc8ced6) : kit.stick(0xc8ced6);
  const sticks = new THREE.InstancedMesh(kit.cylinder(), stickMat, Math.max(1, pairs.length));
  sticks.count = pairs.length;
  sticks.frustumCulled = false;
  group.add(sticks);

  const targets = sites.map((st) => new THREE.Vector3(...st.pos).multiplyScalar(s));
  const half = (o.extent * preset.a * s) / 2;
  const box = keep(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * half, 2 * half, 2 * half)));
  const edges = new THREE.LineSegments(box, keep(new THREE.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.45 })));
  edges.visible = o.edges ?? false;
  group.add(edges);

  let mode: CrystalMode = o.mode ?? 'ballStick';
  const ballF = o.ballFactor ?? 0.4;
  const rGoal = () => (mode === 'spaceFill' ? 1 : ballF);
  let rNow = rGoal();
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const tint = new THREE.Color();

  const view: CrystalView = {
    preset, sites, pairs, group, meshes, sticks, edges, targets,
    pos: targets.map((t) => t.clone()),
    appear: sites.map(() => 1),
    focus: sites.map(() => 1),
    stickAppear: pairs.map(() => 1),
    scale: s,
    get mode() {
      return mode;
    },
    setMode(m, animate = true) {
      mode = m;
      if (!animate) rNow = rGoal();
      view.commit();
    },
    setPalette(p) {
      for (const sp of Object.keys(meshes)) view.setColor(sp, p === 'cpk' ? preset.species[sp].cpk : preset.species[sp].color);
    },
    setColor(sp, c) {
      const m = meshes[sp];
      if (m) m.material = o.ghost ? mkMat(new THREE.Color(c).getHex()) : kit.atom(c);
    },
    setTint(i, k) {
      const m = meshes[sites[i].species];
      m.setColorAt(slot[i], tint.setScalar(k));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    },
    commit() {
      sites.forEach((st, i) => {
        const r = preset.species[st.species].radius * s * rNow * Math.max(1e-4, view.appear[i] * view.focus[i]);
        meshes[st.species].setMatrixAt(slot[i], M.compose(view.pos[i], Q.identity(), S.setScalar(r)));
      });
      for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
      const sr = 0.16 * s * (mode === 'spaceFill' ? 0 : 1);
      pairs.forEach(([a, b], j) => {
        // Que chưa mọc: thu hẳn về 0 (bề rộng 0 → pháp tuyến NaN → bloom làm đen cả khung).
        if (view.stickAppear[j] <= 0.001) return sticks.setMatrixAt(j, ZERO);
        V.subVectors(view.pos[b], view.pos[a]);
        const len = V.length() * view.stickAppear[j];
        Q.setFromUnitVectors(UP, V.normalize());
        sticks.setMatrixAt(j, M.compose(view.pos[a], Q, S.set(sr * Math.min(1, view.stickAppear[j] * 3), Math.max(1e-4, len), sr)));
      });
      sticks.instanceMatrix.needsUpdate = true;
      sticks.visible = sr > 0;
    },
    update(dt) {
      const g = rGoal();
      if (Math.abs(g - rNow) < 1e-3) return;
      rNow += (g - rNow) * (1 - Math.exp(-dt * 6));
      view.commit();
    },
    dispose() {
      group.removeFromParent();
      for (const m of Object.values(meshes)) m.dispose();
      sticks.dispose();
      for (const x of own) x.dispose();
    },
  };
  view.commit();
  return view;
}
