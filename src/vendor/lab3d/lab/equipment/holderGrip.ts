import * as THREE from 'three';
import { mm } from '../units';

export interface HolderGripOptions {
  /** Góc quay quanh trục đứng (rad): −1,3 = cán chĩa về phía người làm, hơi sang phải (mặc định). */
  yaw?: number;
  /** Má kẹp cách miệng ống (mm), mặc định 50 – khoảng 1/3 ống 160 mm tính từ miệng. */
  fromMouth?: number;
  /** Chỗ nắm trên cán, tính từ đầu kẹp (mm), mặc định 105. */
  gripAt?: number;
}

/** Tư thế kẹp gỗ `createTubeHolder` đang kẹp một ống nghiệm đứng thẳng – mọi vectơ theo toạ độ ống (gốc ở đáy ống, +y lên). */
export interface HolderGrip {
  /** Hướng kẹp (hệ ống). */
  quat: THREE.Quaternion;
  euler: THREE.Euler;
  /** Gốc kẹp (đầu má kẹp, gốc của createTubeHolder) so với đáy ống. */
  origin: THREE.Vector3;
  /** Tâm vòng má kẹp – điểm kẹp trên thân ống (trục lật ống "cổ tay xoay" đi qua đây). */
  jaw: THREE.Vector3;
  /** Chỗ nắm trên cán (con trỏ dẫn điểm này khi mang ống bằng kẹp). */
  grip: THREE.Vector3;
  /** Trục dài của kẹp (đơn vị, hướng về phía cán). */
  axis: THREE.Vector3;
}

/** Tâm vòng má kẹp trong toạ độ createTubeHolder (má cong Ø18 ở x = −6 mm, giữa hai thanh). */
const JAW = new THREE.Vector3(-mm(6), mm(7.5), 0);

/**
 * Kẹp gỗ kẹp ống nghiệm ở ~1/3 ống tính từ miệng, cán nằm ngang chĩa về phía người làm (TN-041-01, TN-040-01): hướng kẹp, gốc kẹp,
 * điểm kẹp, chỗ nắm trên cán và trục dài – để đặt kẹp lên ống (`holder.position = đáy ống + origin`) và dò vùng thả theo chỗ nắm.
 */
export function holderGrip(mouthY: number, o: HolderGripOptions = {}): HolderGrip {
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, o.yaw ?? -1.3, 0, 'YXZ'));
  const jaw = new THREE.Vector3(0, mouthY - mm(o.fromMouth ?? 50), 0);
  const origin = jaw.clone().sub(JAW.clone().applyQuaternion(quat));
  const grip = origin.clone().add(new THREE.Vector3(mm(o.gripAt ?? 105), mm(7), 0).applyQuaternion(quat));
  return { quat, euler: new THREE.Euler().setFromQuaternion(quat), origin, jaw, grip, axis: new THREE.Vector3(1, 0, 0).applyQuaternion(quat) };
}
