import * as THREE from 'three';
import type { Rotor } from './rotor';

/** Tư thế (vị trí + quaternion) trong hệ của một vật cha – cùng dạng `Pose` của kit/lab3d/interact. */
export interface RotorPose {
  pos: THREE.Vector3;
  rot: THREE.Quaternion;
}

/**
 * Tư thế ống trong lỗ rotor theo GÓC QUAY HIỆN TẠI, tính trong hệ `root` (mặt bàn) – để ống đứng riêng (createGrabbable quản lí) mà vẫn
 * đi theo rotor đang quay: mỗi frame đặt ống = `slot(s)`. Dùng chung cho mọi sim li tâm (machine của kit, kể cả khi máy được scale).
 */
export function createRotorPoses(root: THREE.Object3D, rotor: Rotor) {
  const q = new THREE.Quaternion();
  const slot = (s: number): RotorPose => {
    const o = rotor.slots[s];
    o.updateWorldMatrix(true, false);
    return {
      pos: root.worldToLocal(o.getWorldPosition(new THREE.Vector3())),
      rot: root.getWorldQuaternion(q).invert().multiply(o.getWorldQuaternion(new THREE.Quaternion())),
    };
  };
  const axis = (s: number) => new THREE.Vector3(0, 1, 0).applyQuaternion(slot(s).rot);
  const n = rotor.slots.length;
  return {
    slot,
    /** Trục ống trong lỗ `s` (hệ root) – rút ra / cắm vào dọc trục này. */
    axis,
    /** Tư thế ống nhấc khỏi lỗ `s` một đoạn `k` (đv root) dọc trục lỗ. */
    above(s: number, k = 1): RotorPose {
      const p = slot(s);
      return { pos: p.pos.clone().addScaledVector(axis(s), k), rot: p.rot };
    },
    /** Miệng lỗ `s` (thế giới) – tâm vùng thả: cách đáy lỗ `along` (đv cục bộ rotor) dọc trục. */
    mouth: (s: number, along = 0.62) => rotor.slots[s].localToWorld(new THREE.Vector3(0, along, 0)),
    /** Hai lỗ đối xứng qua trục quay (rotor cân bằng khi hai ống bằng nhau nằm ở đây). */
    opposite: (a: number, b: number) => n % 2 === 0 && a >= 0 && b >= 0 && (a - b + n) % n === n / 2,
    /** Lỗ đối diện lỗ `s`. */
    across: (s: number) => (s + n / 2) % n,
  };
}

export type RotorPoses = ReturnType<typeof createRotorPoses>;
