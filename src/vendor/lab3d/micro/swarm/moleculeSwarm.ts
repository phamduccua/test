import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import { atomColor, atomRadius, type MolStyle } from '../molecule/style';
import type { MoleculeData } from '../molecule/types';

export interface SwarmOptions {
  /** Đơn vị cảnh / Å. */
  scale?: number;
  style?: Exclude<MolStyle, 'kit'>;
  /** Nhân bán kính nguyên tử (spaceFill thường 0,8–1). */
  radiusFactor?: number;
  /** Đổi màu theo nguyên tố (vd. { S: 0xf2d230 }). */
  colors?: Record<string, THREE.ColorRepresentation>;
  bondColor?: THREE.ColorRepresentation;
}

export interface MoleculeSwarm {
  group: THREE.Group;
  readonly count: number;
  data: MoleculeData;
  /** Đặt tư thế phân tử i (toạ độ group); scale 0 = ẩn. */
  setPose(i: number, pos: THREE.Vector3, quat: THREE.Quaternion, scale?: number): void;
  /** Ghi ma trận lên GPU sau khi đặt xong các tư thế (mỗi frame). */
  commit(): void;
}

/**
 * Nhiều bản sao một phân tử/ion (H2O2, SO4²⁻, S2O3²⁻, H2O…) bằng InstancedMesh: một mesh cho mỗi nguyên tố + một cho que.
 * Rẻ hơn hẳn createMolecule khi có hàng chục phân tử chuyển động Brown trong cảnh vi mô.
 */
export function createMoleculeSwarm(ctx: Tracker, data: MoleculeData, count: number, o: SwarmOptions = {}): MoleculeSwarm {
  const kit = microMaterials(ctx);
  const s = o.scale ?? 0.3;
  const style = o.style ?? 'ballStick';
  const rf = o.radiusFactor ?? 1;
  const group = new THREE.Group();
  group.name = `swarm-${data.id}`;
  const local = data.atoms.map((a) => new THREE.Vector3(a.x, a.y, a.z).multiplyScalar(s));
  const byEl = new Map<string, number[]>();
  data.atoms.forEach((a, k) => byEl.set(a.el, [...(byEl.get(a.el) ?? []), k]));
  const atomMeshes = [...byEl.entries()].map(([el, idx]) => {
    const color = o.colors?.[el] ?? atomColor(el, 'ballStick');
    const mesh = new THREE.InstancedMesh(kit.sphere('low'), kit.atom(color), count * idx.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    const local0 = idx.map((k) => new THREE.Matrix4().compose(local[k], new THREE.Quaternion(), new THREE.Vector3().setScalar(atomRadius(el, style) * s * rf)));
    group.add(mesh);
    return { mesh, local0 };
  });
  const bondMesh =
    style === 'ballStick' && data.bonds.length
      ? new THREE.InstancedMesh(kit.cylinder(), kit.stick(o.bondColor ?? 0xc9d1d9), count * data.bonds.length)
      : null;
  const up = new THREE.Vector3(0, 1, 0);
  const bondLocal = data.bonds.map((b) => {
    const d = local[b.b].clone().sub(local[b.a]);
    const q = new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize());
    const r = 0.11 * s * (b.order > 1 ? 1.25 : 1);
    return new THREE.Matrix4().compose(local[b.a], q, new THREE.Vector3(r, d.length(), r));
  });
  if (bondMesh) {
    bondMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    bondMesh.frustumCulled = false;
    group.add(bondMesh);
  }
  const M = new THREE.Matrix4();
  const T = new THREE.Matrix4();
  const S = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const swarm: MoleculeSwarm = {
    group,
    count,
    data,
    setPose(i, pos, quat, scale = 1) {
      if (scale <= 0) {
        for (const a of atomMeshes) a.local0.forEach((_, k) => a.mesh.setMatrixAt(i * a.local0.length + k, zero));
        bondLocal.forEach((_, k) => bondMesh?.setMatrixAt(i * bondLocal.length + k, zero));
        return;
      }
      M.compose(pos, quat, S.setScalar(scale));
      for (const a of atomMeshes) a.local0.forEach((L, k) => a.mesh.setMatrixAt(i * a.local0.length + k, T.multiplyMatrices(M, L)));
      if (bondMesh) bondLocal.forEach((L, k) => bondMesh.setMatrixAt(i * bondLocal.length + k, T.multiplyMatrices(M, L)));
    },
    commit() {
      for (const a of atomMeshes) a.mesh.instanceMatrix.needsUpdate = true;
      if (bondMesh) bondMesh.instanceMatrix.needsUpdate = true;
    },
  };
  for (let i = 0; i < count; i++) swarm.setPose(i, new THREE.Vector3(), new THREE.Quaternion(), 0);
  swarm.commit();
  return swarm;
}
