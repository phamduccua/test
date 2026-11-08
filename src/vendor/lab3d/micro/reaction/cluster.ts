import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import { atomColor, atomRadius } from '../molecule/style';

/** Một khung hình của phản ứng: vị trí từng nguyên tử + các liên kết đang tồn tại [a, b, bậc]. */
export interface ClusterFrame {
  pos: THREE.Vector3[];
  bonds: [number, number, (1 | 2)?][];
}

export interface ReactionCluster {
  group: THREE.Group;
  atoms: THREE.Mesh[];
  readonly frames: ClusterFrame[];
  /** Tiến trình liên tục 0 … frames.length − 1 (nội suy mượt giữa các khung). */
  setProgress(p: number): void;
  /** Vị trí hiện tại của nguyên tử i (toạ độ group). */
  atomPos(i: number): THREE.Vector3;
}

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * "Biên đạo" một phản ứng ở mức nguyên tử: các nguyên tử dời giữa các khung hình, liên kết cũ mờ/co lại và đỏ lên khi đứt,
 * liên kết mới mọc ra (vd. 2H2O2 → 2H2O + O2 trên bề mặt xúc tác). Dọn bằng disposeMicroObject.
 */
export function createReactionCluster(
  ctx: Tracker,
  o: { elements: string[]; frames: ClusterFrame[]; scale?: number; colors?: Record<string, THREE.ColorRepresentation> },
): ReactionCluster {
  const kit = microMaterials(ctx);
  const s = o.scale ?? 0.3;
  const group = new THREE.Group();
  group.name = 'reaction-cluster';
  const atoms = o.elements.map((el) => {
    const m = new THREE.Mesh(kit.sphere('low'), kit.atom(o.colors?.[el] ?? atomColor(el, 'ballStick')));
    m.scale.setScalar(atomRadius(el, 'ballStick') * s);
    group.add(m);
    return m;
  });
  // Mọi liên kết xuất hiện trong ít nhất một khung → một que (vật liệu riêng để tô màu khi đứt).
  const all = new Map<string, { a: number; b: number; order: number; mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial }>();
  for (const f of o.frames) {
    for (const [a, b, order] of f.bonds) {
      if (all.has(key(a, b))) continue;
      const mat = new THREE.MeshPhysicalMaterial({ color: 0xc9d1d9, roughness: 0.4, clearcoat: 0.5, emissive: 0xff3a1a, emissiveIntensity: 0 });
      const mesh = new THREE.Mesh(kit.cylinder(), mat);
      group.add(mesh);
      all.set(key(a, b), { a, b, order: order ?? 1, mesh, mat });
    }
  }
  const sets = o.frames.map((f) => new Set(f.bonds.map(([a, b]) => key(a, b))));
  const cur = o.elements.map(() => new THREE.Vector3());
  const up = new THREE.Vector3(0, 1, 0);
  const d = new THREE.Vector3();
  const api: ReactionCluster = {
    group,
    atoms,
    frames: o.frames,
    atomPos: (i) => cur[i],
    setProgress(p) {
      const last = o.frames.length - 1;
      const pc = THREE.MathUtils.clamp(p, 0, last);
      const f = Math.min(last - 1, Math.floor(pc));
      const e = last === 0 ? 0 : ease(pc - f);
      const A = o.frames[f];
      const B = o.frames[Math.min(last, f + 1)];
      atoms.forEach((m, i) => {
        cur[i].lerpVectors(A.pos[i], B.pos[i], e);
        m.position.copy(cur[i]);
      });
      for (const [k, b] of all) {
        const inA = sets[f].has(k) ? 1 : 0;
        const inB = sets[Math.min(last, f + 1)].has(k) ? 1 : 0;
        // Liên kết đứt: giữ đến giữa khung rồi co nhanh (căng ra, đỏ lên); liên kết mới: mọc ở nửa sau.
        const str = inA && !inB ? 1 - ease(Math.min(1, Math.max(0, (e - 0.35) / 0.4))) : !inA && inB ? ease(Math.max(0, (e - 0.45) / 0.55)) : inA;
        b.mesh.visible = str > 0.04;
        if (!b.mesh.visible) continue;
        b.mat.emissiveIntensity = inA && !inB ? 1.4 * Math.min(1, e * 2) : 0;
        d.subVectors(cur[b.b], cur[b.a]);
        const len = d.length();
        const r = 0.11 * s * (b.order > 1 ? 1.35 : 1) * (0.35 + 0.65 * str);
        b.mesh.position.copy(cur[b.a]);
        b.mesh.quaternion.setFromUnitVectors(up, d.normalize());
        b.mesh.scale.set(r, len, r);
      }
    },
  };
  api.setProgress(0);
  return api;
}
