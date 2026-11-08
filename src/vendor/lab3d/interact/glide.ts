import * as THREE from 'three';
import type { PointerHub } from './pointer';

/**
 * Gắn `o` vào `parent` (giữ nguyên chỗ trên màn hình) rồi trượt mượt tới tư thế cục bộ `pos`/`rot` trong `s` giây – vòng frame thời gian
 * thực của hub (chạy cả khi tạm dừng; `__ix.idle()` thấy qua tween). Dùng cho mẫu rời panh vào ống, lên lam, phần bỏ đi trượt ra… Trả hàm huỷ.
 */
export function glide(hub: PointerHub, o: THREE.Object3D, parent: THREE.Object3D, pos: THREE.Vector3, rot: THREE.Euler, s: number, done?: () => void) {
  parent.attach(o);
  const p0 = o.position.clone();
  const q0 = o.quaternion.clone();
  const q1 = new THREE.Quaternion().setFromEuler(rot);
  return hub.tween(s, (k) => {
    o.position.lerpVectors(p0, pos, k);
    o.quaternion.slerpQuaternions(q0, q1, k);
  }, done);
}

/** Đặt ngay vào `parent` ở tư thế cục bộ (dựng lại cảnh khi làm lại / hoàn tác). */
export function setAt(o: THREE.Object3D, parent: THREE.Object3D, pos: THREE.Vector3, rot: THREE.Euler) {
  parent.add(o);
  o.position.copy(pos);
  o.rotation.copy(rot);
}
