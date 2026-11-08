import * as THREE from 'three';

/**
 * Bản lề nắp đĩa quay quanh MÉP DƯỚI vành sau. `pivot` là nhóm bản lề đặt ở mép sau MẶT nắp (createAgarPlate, đĩa nuôi tự dựng),
 * nắp úp có vành cao `rim`, hé = quay `pivot.rotation.x = −a`. Quay quanh mép mặt nắp thì vành sau lùa vào trong thành đáy (~2 mm khi
 * hé 0,95 rad); ở đây bản lề dời theo góc để mép dưới vành sau đứng yên, nắp chỉ nhấc ra sau. Dời theo HIỆU so với lần trước: sim dời cả
 * bản lề (tháo nắp, đặt nắp sau đĩa) thì chỗ mới được giữ.
 */
interface RimState {
  rim: number;
  applied: THREE.Vector3;
  last: THREE.Vector3;
}

const offset = (a: number, rim: number, out = new THREE.Vector3()) => out.set(0, -rim * (1 - Math.cos(a)), -rim * Math.sin(a));
const tmp = new THREE.Vector3();

/** Hé nắp góc `a` (rad, 0 = đậy) quanh mép dưới vành sau (vành cao `rim`, đơn vị cảnh). */
export function setRimHinge(pivot: THREE.Object3D, a: number, rim: number): void {
  let s = pivot.userData.rimHinge as RimState | undefined;
  if (!s) pivot.userData.rimHinge = s = { rim, applied: new THREE.Vector3(), last: pivot.position.clone() };
  s.rim = rim;
  // Sim vừa tự dời bản lề (tháo / đặt lại nắp): lấy chỗ mới làm gốc.
  if (!pivot.position.equals(s.last)) s.applied.set(0, 0, 0);
  offset(a, rim, tmp);
  pivot.position.add(tmp).sub(s.applied);
  s.applied.copy(tmp);
  s.last.copy(pivot.position);
  pivot.rotation.x = -a;
}

/** Chỗ bản lề (hệ cha của `pivot`) khi hé góc `a` – để tính điểm nắm mép nắp; bản lề thường (không qua setRimHinge) = chỗ hiện tại. */
export function rimHingeAt(pivot: THREE.Object3D, a: number, out = new THREE.Vector3()): THREE.Vector3 {
  out.copy(pivot.position);
  const s = pivot.userData.rimHinge as RimState | undefined;
  if (!s) return out;
  if (pivot.position.equals(s.last)) out.sub(s.applied);
  return out.add(offset(a, s.rim, tmp));
}
