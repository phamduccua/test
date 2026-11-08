import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Tracker } from '../../lab/types';

/**
 * A-PHAGE: thể thực khuẩn dạng phức tạp (T4, H 24.1d SGK Sinh 10) cho nhiều hạt cùng lúc – mỗi bộ phận là một InstancedMesh.
 * Kích thước thật (µm, Leiman 2003): đầu 0,111 × 0,078, đuôi 0,100 × 0,024 (co còn ~0,045 × 0,033), 6 sợi đuôi dài ~0,145.
 * Hệ toạ độ một phage: gốc ở tâm tấm đáy (đầu mút đuôi), +y hướng lên đầu. `size` = đơn vị cảnh / µm.
 */
export const PHAGE_UM = { headH: 0.111, headW: 0.078, tail: 0.1, tailR: 0.012, plate: 0.012, collar: 0.006, fiber: 0.145 };

export interface PhagePose {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  /** Hệ số phóng (1 = thật; 0 = ẩn). */
  scale?: number;
  /** Bao đuôi co 0…1 (tiêm DNA): đuôi ngắn lại, lõi đâm xuống dưới tấm đáy. */
  contract?: number;
  /** Sợi đuôi duỗi 0…1: 0 = gập như chân nhện, 1 = xoè sát bề mặt khi bám. */
  spread?: number;
  /** Đầu rỗng (đã tiêm hết DNA) → nhạt màu. */
  empty?: boolean;
  /** Chỉ vẽ một số bộ phận (phage đang lắp ráp trong tế bào). */
  parts?: { head?: boolean; tail?: boolean; fibers?: boolean };
}

export interface PhageSwarm {
  group: THREE.Group;
  max: number;
  set(i: number, p: PhagePose): void;
  hide(i: number): void;
  commit(): void;
}

export interface PhageSwarmOptions {
  max: number;
  /** Đơn vị cảnh / µm. */
  size: number;
  head?: THREE.ColorRepresentation;
  tail?: THREE.ColorRepresentation;
  fiber?: THREE.ColorRepresentation;
}

function sheathGeometry(): THREE.BufferGeometry {
  // Bao đuôi khía vòng: 8 khoanh xếp chồng, cao tổng 1, bán kính 1, đáy y = 0.
  const rings: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 8; k++) {
    const g = new THREE.CylinderGeometry(1, 1, 0.1, 14, 1);
    g.translate(0, (k + 0.5) / 8, 0);
    const lip = new THREE.CylinderGeometry(1.12, 1.12, 0.035, 14, 1);
    lip.translate(0, (k + 0.85) / 8, 0);
    rings.push(g, lip);
  }
  const m = mergeGeometries(rings)!;
  rings.forEach((g) => g.dispose());
  return m;
}

export function createPhageSwarm(ctx: Tracker, o: PhageSwarmOptions): PhageSwarm {
  const S = o.size;
  const group = new THREE.Group();
  group.name = 'phage-swarm';
  const mat = (c: THREE.ColorRepresentation, flat = false) =>
    ctx.track(new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, flatShading: flat }));
  const head = new THREE.IcosahedronGeometry(1, 0);
  head.rotateZ(Math.atan(1 / 1.618));
  const mk = (geo: THREE.BufferGeometry, m: THREE.Material, n: number) => {
    const mesh = new THREE.InstancedMesh(ctx.track(geo), m, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = n;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const cylUnit = (r: number, seg: number) => new THREE.CylinderGeometry(r, r, 1, seg, 1).translate(0, 0.5, 0);
  const parts = {
    head: mk(head, mat('#ffffff', true), o.max),
    collar: mk(new THREE.CylinderGeometry(1, 1, 1, 14, 1), mat(o.tail ?? '#5fbf3f'), o.max),
    sheath: mk(sheathGeometry(), mat(o.tail ?? '#5fbf3f'), o.max),
    core: mk(cylUnit(1, 8), mat('#d8e9c4'), o.max),
    plate: mk(new THREE.CylinderGeometry(1, 1, 1, 6, 1), mat(o.tail ?? '#5fbf3f', true), o.max),
    fiber: mk(cylUnit(1, 5), mat(o.fiber ?? '#b6e04a'), o.max * 12),
  };
  const headFull = new THREE.Color(o.head ?? '#27b39a');
  const headEmpty = headFull.clone().lerp(new THREE.Color('#e8f4f0'), 0.6);
  const M = new THREE.Matrix4();
  const L = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const UP = new THREE.Vector3(0, 1, 0);
  const put = (mesh: THREE.InstancedMesh, i: number, pos: THREE.Vector3, rot: THREE.Quaternion, s: THREE.Vector3) => {
    L.compose(pos, rot, s);
    mesh.setMatrixAt(i, L.premultiply(M));
  };
  const ident = new THREE.Quaternion();
  const knee = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const seg = (j: number, a: THREE.Vector3, b: THREE.Vector3, r: number) => {
    v.subVectors(b, a);
    const len = v.length();
    q.setFromUnitVectors(UP, v.divideScalar(len || 1));
    put(parts.fiber, j, a, q, sc.set(r, len, r));
  };
  const api: PhageSwarm = {
    group,
    max: o.max,
    set(i, p) {
      const s = (p.scale ?? 1) * S;
      if (s <= 0) return api.hide(i);
      M.compose(p.pos, p.quat, sc.set(s, s, s));
      const c = p.contract ?? 0;
      const sp = p.spread ?? 0;
      const show = { head: p.parts?.head ?? true, tail: p.parts?.tail ?? true, fibers: p.parts?.fibers ?? true };
      const U = PHAGE_UM;
      const tail = U.tail * (1 - 0.55 * c);
      const tailR = U.tailR * (1 + 0.38 * c);
      const top = U.plate + tail + U.collar;
      if (show.head) {
        put(parts.head, i, v.set(0, top + U.headH / 2 - 0.004, 0), ident, sc.set(U.headW / 2 / 0.85, U.headH / 2 / 0.95, U.headW / 2 / 0.85));
        parts.head.setColorAt(i, p.empty ? headEmpty : headFull);
      } else parts.head.setMatrixAt(i, zero);
      if (show.tail) {
        put(parts.collar, i, v.set(0, U.plate + tail + U.collar / 2, 0), ident, sc.set(0.022, U.collar, 0.022));
        put(parts.sheath, i, v.set(0, U.plate, 0), ident, sc.set(tailR, tail, tailR));
        put(parts.plate, i, v.set(0, U.plate / 2, 0), ident, sc.set(0.03, U.plate, 0.03));
        if (c > 0.05) put(parts.core, i, v.set(0, -0.04 * c, 0), ident, sc.set(0.0045, 0.04 * c + U.plate, 0.0045));
        else parts.core.setMatrixAt(i, zero);
      } else [parts.collar, parts.sheath, parts.plate, parts.core].forEach((m) => m.setMatrixAt(i, zero));
      for (let k = 0; k < 6; k++) {
        const j = i * 12 + k * 2;
        if (!show.fibers || !show.tail) {
          parts.fiber.setMatrixAt(j, zero);
          parts.fiber.setMatrixAt(j + 1, zero);
          continue;
        }
        const a = (k / 6) * Math.PI * 2 + 0.3;
        const [ca, sa] = [Math.cos(a), Math.sin(a)];
        const root = v.set(ca * 0.028, U.plate * 0.4, sa * 0.028).clone();
        // Đoạn gần: chếch lên (gập) → xoè ngang khi bám; đoạn xa: chúi xuống chạm bề mặt.
        const h1 = 0.55 + 0.35 * sp;
        const up1 = 0.83 - 0.75 * sp;
        knee.set(ca * h1, up1, sa * h1).normalize().multiplyScalar(0.072).add(root);
        const h2 = 0.32 + 0.3 * sp;
        tip.set(ca * h2, -1, sa * h2).normalize().multiplyScalar(0.075).add(knee);
        if (sp > 0) tip.y = THREE.MathUtils.lerp(tip.y, -0.002, sp);
        seg(j, root, knee, 0.0032);
        seg(j + 1, knee, tip, 0.0028);
      }
    },
    hide(i) {
      for (const m of [parts.head, parts.collar, parts.sheath, parts.core, parts.plate]) m.setMatrixAt(i, zero);
      for (let k = 0; k < 12; k++) parts.fiber.setMatrixAt(i * 12 + k, zero);
    },
    commit() {
      for (const m of Object.values(parts)) m.instanceMatrix.needsUpdate = true;
      if (parts.head.instanceColor) parts.head.instanceColor.needsUpdate = true;
    },
  };
  for (let i = 0; i < o.max; i++) api.hide(i);
  api.commit();
  return api;
}
