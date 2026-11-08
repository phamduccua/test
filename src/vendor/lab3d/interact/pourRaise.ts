import * as THREE from 'three';
import { clearanceItem, collectClearance, findClearance, itemAtMouth, liftOver } from '../lab/geometry/clearancePairs';
import { mm } from '../lab/units';
import { dampFactor } from './math';

const UP = new THREE.Vector3(0, 1, 0);
/** Nâng tối đa: đủ cho môi rót / vành chúc xuống khi nghiêng; tư thế đặt của sim lấn sâu hơn thì phải sửa ở sim (nâng xa làm vật rời tay cầm). */
const MAX_RAISE = mm(12);

/**
 * Nâng tự động cho createTiltPour: dụng cụ đang nghiêng (góc nghiêng hoặc tư thế đặt nghiêng) trên miệng vật nhận mà lọt vào khối bao
 * vật nhận → dời `node` lên theo y vừa đủ + khe `gap` (tối đa 12 mm); hết nghiêng → hạ về mượt. Chỉ tính VẬT NHẬN: tư thế đặt của sim chạm vật bên cạnh thì
 * sửa ở sim (hướng ngả, vị trí) – nâng qua vật cao bên cạnh làm dụng cụ lơ lửng, nhấn nhầm vật bên dưới (createCarryPour đã tự tránh). Chỉ cộng dời (sim tự đặt vị trí `node` một
 * lần như createLipPivot vẫn đúng). Không có proxy (vật không dựng bằng createVessel) → không làm gì.
 */
export function createPourRaise(scene: THREE.Object3D, node: THREE.Object3D, gap = mm(2)) {
  let pObj: THREE.Object3D | null | undefined;
  let recvObj: THREE.Object3D | null = null;
  const recvAt = new THREE.Vector3(Infinity, 0, 0);
  const up = new THREE.Vector3();
  const base = node.position.clone();
  let raise = 0;
  return {
    get raise() {
      return raise;
    },
    /** Gọi mỗi khung SAU khi xoay + updateMatrixWorld: `mouth` = tâm miệng vật nhận dưới môi rót (null = không có), `angle` = góc nghiêng. */
    update(mouth: THREE.Vector3 | null, angle: number, dt: number) {
      if (pObj === undefined) pObj = findClearance(node);
      let target = 0;
      const tilted = angle > 0.02 || up.copy(UP).transformDirection(node.matrixWorld).y < 0.995;
      if (!tilted) recvObj = null;
      // Rời miệng khi còn nghiêng (về chỗ, sang ống khác) vẫn giữ vật nhận cũ cho tới khi không còn điểm nào ở trên nó.
      if (pObj && tilted && (mouth || recvObj)) {
        if (mouth && (!recvObj || recvAt.distanceToSquared(mouth) > 1e-8)) {
          recvObj = itemAtMouth(collectClearance(scene), mouth, pObj)?.obj ?? null;
          recvAt.copy(mouth);
        }
        const p = clearanceItem(pObj);
        const rc = recvObj && clearanceItem(recvObj);
        const need = p && rc ? liftOver(p, rc) + raise : -Infinity; // tính từ tư thế chưa nâng
        if (need > -Infinity) target = THREE.MathUtils.clamp(need + gap, 0, MAX_RAISE);
      }
      if (raise === 0) base.copy(node.position); // chỗ gốc của `node` khi chưa nâng (sim tự đặt vẫn theo)
      if (raise === 0 && target === 0) return;
      raise = target > raise ? target : raise + (target - raise) * dampFactor(8, dt);
      if (raise < 1e-5) raise = 0;
      // Nâng theo phương THẲNG ĐỨNG thế giới tính lại mỗi khung (cha có thể đang nghiêng – khớp xoay tư thế rót), đổi sang hệ cha.
      node.position.copy(base);
      const p0 = node.parent ? node.parent.localToWorld(base.clone()) : base.clone();
      if (raise > 0) node.position.add((node.parent ? node.parent.worldToLocal(p0.setY(p0.y + raise)) : p0.setY(p0.y + raise)).sub(base));
      node.updateMatrixWorld();
    },
  };
}
