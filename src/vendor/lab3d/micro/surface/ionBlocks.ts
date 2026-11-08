import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import type { SurfaceSim } from './surfaceModel';

export interface IonBlocksOptions {
  /** Cạnh ô (đv cảnh) – trùng `a` của SurfaceSim. */
  a: number;
  /** Màu ion loại 0 (cation, vd. Ca²⁺) và nguyên tử của anion đa nguyên tử loại 1 (vd. C, O của CO₃²⁻). */
  cation?: THREE.ColorRepresentation;
  center?: THREE.ColorRepresentation;
  ligand?: THREE.ColorRepresentation;
  /** Độ tối ion bên trong (không lộ ra) 0…1. */
  interiorDim?: number;
}

export interface IonBlocks {
  group: THREE.Group;
  /** Tính lại ion lộ/khuất (gọi sau khi `sim.remove`). */
  refresh(): void;
  /** Ion bị tách khỏi bề mặt co lại mượt; ion lộ ra sáng dần. */
  update(dt: number): void;
}

/**
 * Tinh thể ion dạng khối từ SurfaceSim: ô loại 0 = cầu cation, ô loại 1 = anion phẳng tam giác (1 tâm + 3 phối tử, kiểu CO₃²⁻/NO₃⁻).
 * Ion ở bề mặt (chạm được) sáng rõ, ion bên trong tối đi – thấy ngay phần "diện tích tiếp xúc".
 */
export function createIonBlocks(ctx: Tracker, sim: SurfaceSim, o: IonBlocksOptions): IonBlocks {
  const kit = microMaterials(ctx);
  const a = o.a;
  const group = new THREE.Group();
  group.name = 'ion-blocks';
  const cat = sim.cells.map((c, i) => (c.kind === 0 ? i : -1)).filter((i) => i >= 0);
  const an = sim.cells.map((c, i) => (c.kind === 1 ? i : -1)).filter((i) => i >= 0);
  const mat = kit.atom(0xffffff);
  const mk = (n: number) => {
    const m = new THREE.InstancedMesh(kit.sphere('low'), mat, Math.max(1, n));
    m.count = n;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
    return m;
  };
  const caMesh = mk(cat.length);
  const cMesh = mk(an.length);
  const oMesh = mk(an.length * 3);
  // Nhóm phẳng song song (như mặt CO₃ trong calcit), chỉ xoay quanh trục y xen kẽ 60°.
  const rot = an.map((ci) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ((sim.cells[ci].y / a) | 0) % 2 ? Math.PI / 3 : 0, 0)));
  const legs = [0, 1, 2].map((k) => new THREE.Vector3(Math.cos((k * 2 * Math.PI) / 3), 0, Math.sin((k * 2 * Math.PI) / 3)).multiplyScalar(0.22 * a));
  const vis = new Float32Array(sim.cells.length).fill(1);
  const glow = new Float32Array(sim.cells.length);
  const exposed = new Uint8Array(sim.cells.length);
  const cols = {
    ca: new THREE.Color(o.cation ?? 0xb8d4f0),
    c: new THREE.Color(o.center ?? 0x3a3a3a),
    o: new THREE.Color(o.ligand ?? 0xe0453a),
  };
  const dim = o.interiorDim ?? 0.45;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  const I = new THREE.Quaternion();
  const write = () => {
    cat.forEach((ci, k) => {
      const c = sim.cells[ci];
      caMesh.setMatrixAt(k, m.compose(p.set(c.x, c.y, c.z), I, s.setScalar(0.28 * a * vis[ci])));
      caMesh.setColorAt(k, col.copy(cols.ca).multiplyScalar(dim + (1 - dim) * glow[ci]));
    });
    an.forEach((ci, k) => {
      const c = sim.cells[ci];
      const v = vis[ci];
      const g = dim + (1 - dim) * glow[ci];
      p.set(c.x, c.y, c.z);
      cMesh.setMatrixAt(k, m.compose(p, I, s.setScalar(0.1 * a * v)));
      cMesh.setColorAt(k, col.copy(cols.c).multiplyScalar(0.6 + 0.4 * g));
      legs.forEach((l, j) => {
        const q = new THREE.Vector3().copy(l).applyQuaternion(rot[k]).multiplyScalar(v).add(p);
        oMesh.setMatrixAt(k * 3 + j, m.compose(q, I, s.setScalar(0.14 * a * v)));
        oMesh.setColorAt(k * 3 + j, col.copy(cols.o).multiplyScalar(g));
      });
    });
    for (const mesh of [caMesh, cMesh, oMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };
  const api: IonBlocks = {
    group,
    refresh() {
      sim.cells.forEach((_, i) => (exposed[i] = sim.isExposed(i) ? 1 : 0));
    },
    update(dt) {
      let moved = false;
      sim.cells.forEach((c, i) => {
        const tv = c.alive ? 1 : 0;
        const tg = exposed[i];
        if (vis[i] !== tv) {
          vis[i] = tv > vis[i] ? Math.min(1, vis[i] + dt * 3) : Math.max(0, vis[i] - dt * 2.5);
          moved = true;
        }
        if (glow[i] !== tg) {
          glow[i] = tg > glow[i] ? Math.min(1, glow[i] + dt * 2) : Math.max(0, glow[i] - dt * 2);
          moved = true;
        }
      });
      if (moved) write();
    },
  };
  api.refresh();
  glow.set(exposed);
  write();
  return api;
}
