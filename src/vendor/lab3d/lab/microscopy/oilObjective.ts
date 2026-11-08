import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import type { Microscope } from './microscope';
import { labText } from '../../text';

export type Objective = 10 | 40 | 100;

/** Mâm vật kính 10× / 40× / 100× (dầu) cho `createMicroscope`, không sửa kit. */
export interface OilTurret {
  readonly objective: Objective;
  setObjective(obj: Objective): void;
  /** Thay cho `scope.update` (cùng xoay mâm). */
  update(dt: number): void;
}

/** Góc mâm: kit đặt 4× ở 0, 10× ở 2π/3, 40× ở 4π/3; ô 4× được đổi thành 100× (quay tiếp một vòng tới −2π). */
const TARGET: Record<Objective, number> = { 10: (-2 * Math.PI) / 3, 40: (-4 * Math.PI) / 3, 100: -2 * Math.PI };

/**
 * Đổi vật kính 4× của kit thành vật kính dầu 100× (dài hơn, vạch trắng + vòng đen "OIL") và tự xoay mâm.
 * Gọi `update` của đối tượng này thay vì `scope.update` (kit chỉ xoay mâm trong update).
 */
export function fitOilObjective(ctx: SimContext, scope: Microscope): OilTurret {
  const turret = scope.group.children.find((c) => c instanceof THREE.Group && Math.abs(c.position.y - 2.42) < 1e-3);
  if (!turret) throw new Error(labText('t_389ebf09c227'));
  const holder = turret.children.find((c) => c instanceof THREE.Group && Math.abs(c.rotation.y) < 1e-6)?.children[0];
  if (holder) {
    // 4× dài 0,34 → 100× ≈ 0,53 (vật kính dầu là vật kính dài nhất trên mâm).
    holder.scale.y = 1.55;
    const white = ctx.track(new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.35 }));
    const black = ctx.track(new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.5 }));
    holder.children.forEach((m, i) => {
      if (i === 1 && m instanceof THREE.Mesh) m.material = white;
    });
    const ring = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.078, 0.078, 0.014, 24)), black);
    ring.position.y = -0.34 * 0.42;
    holder.add(ring);
  }
  let obj: Objective = 10;
  turret.rotation.y = TARGET[obj];
  return {
    get objective() {
      return obj;
    },
    setObjective(o) {
      obj = o;
    },
    update(dt) {
      turret.rotation.y += (TARGET[obj] - turret.rotation.y) * (1 - Math.exp(-dt * 5));
    },
  };
}
