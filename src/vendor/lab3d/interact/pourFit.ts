import * as THREE from 'three';
import { innerR } from '../lab/geometry/clearance';
import { collectClearance, findClearance, inCavity, itemAtMouth, liftOver, type ClearanceItem } from '../lab/geometry/clearancePairs';
import { mm, UNIT_MM } from '../lab/units';

export interface PourFitOptions {
  scene: THREE.Object3D;
  /** Cha của khớp xoay (mặt bàn). */
  root: THREE.Object3D;
  /** Khớp nghiêng (`createLipPivot().tilt`, gốc ở môi rót) – nghiêng quanh trục `axis` cục bộ. */
  tilt: THREE.Object3D;
  /** Nhóm dụng cụ rót (proxy tìm trong con cháu – createVessel tự gắn). */
  vessel: THREE.Object3D;
  axis: 'x' | 'z';
  /** Góc nghiêng thêm tối đa khi kéo (rad) – kiểm cả khoảng 0…maxTilt. */
  maxTilt: number;
  /** Khe hở dưới vật rót (thế giới, mặc định 2 mm); môi rót lùi vào trong mép miệng nhận (mặc định 5 mm). */
  gap?: number;
  inset?: number;
  /** false = giữ đúng hướng ngả thân sim chọn (không thử hướng khác). */
  turn?: boolean;
}

export interface PourFit {
  /** Vị trí khớp xoay (môi rót) trong hệ `root` + tư thế nghiêng sẵn đã chọn. */
  pos: THREE.Vector3;
  rot: THREE.Euler;
  receiver: ClearanceItem;
  /** Bán kính trong ở miệng nhận (thế giới). */
  mouthR: number;
}

const ANGLES = 9;
/** Hướng ngả thân thử thêm quanh hướng sim chọn (rad) + phạt mỗi π/4 lệch (thế giới) – chỉ đổi hướng khi hạ được môi rót đáng kể. */
const TURNS = [0, -Math.PI / 4, Math.PI / 4, -Math.PI / 2, Math.PI / 2];
const TURN_COST = mm(8);
const unit = (it: ClearanceItem) => it.mm / UNIT_MM;

/**
 * Tư thế rót KHÔNG XUYÊN (createCarryPour): môi rót đặt ngay trên mép miệng vật nhận – lùi vào trong `inset` về phía thân vật rót,
 * rồi nhấc vừa đủ để mọi điểm của vật rót nằm trên khối bao vật nhận và các vật chứa lân cận (miệng coi như đậy; vật chứa đựng vật nhận
 * bên trong – cốc cách thuỷ – chỉ tính thành), ở mọi góc nghiêng 0…maxTilt quanh môi rót, cộng khe hở `gap`. `rotAt(d)` = tư thế
 * nghiêng sẵn khi thân ngả lệch thêm `d` (rad) quanh trục đứng: thử vài hướng (thân ngả qua giá ống, bình bên cạnh thì môi rót phải
 * nhấc rất cao) và giữ hướng có môi rót thấp nhất. Thiếu proxy (vật rót / nhận không dựng bằng createVessel) → null (tư thế cũ).
 */
export function fitPour(o: PourFitOptions, mouth: THREE.Vector3, rotAt: (turn: number) => THREE.Euler, minLift: number): PourFit | null {
  const pObj = findClearance(o.vessel);
  if (!pObj) return null;
  const items = collectClearance(o.scene);
  const recv = itemAtMouth(items, mouth, pObj);
  if (!recv) return null;
  const pourer = items.find((it) => it.obj === pObj)!;
  const inTilt = o.tilt.matrixWorld.clone().invert().multiply(pObj.matrixWorld); // khung proxy vật rót trong khớp nghiêng (không đổi theo góc)
  const carried = (it: ClearanceItem) => {
    for (let p: THREE.Object3D | null = it.obj; p; p = p.parent) if (p === o.tilt) return true;
    return false;
  };
  const obstacles = items.filter((it) => it === recv || !carried(it));
  const mouthR = innerR(recv.px, recv.px.top) * unit(recv);
  const rootQ = o.root.getWorldQuaternion(new THREE.Quaternion());
  const scale = o.root.getWorldScale(new THREE.Vector3());
  const axis = o.axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const turn = new THREE.Matrix4();
  const W = new THREE.Matrix4();
  const mid = new THREE.Vector3();
  let best: { lip: THREE.Vector3; lift: number; rot: THREE.Euler; cost: number } | null = null;
  for (const d of o.turn === false ? [0] : TURNS) {
    const rot = rotAt(d);
    // Hướng ngang từ môi rót về phía thân vật rót (trục proxy ở mặt miệng) sau khi xoay `rot` và theo `root`.
    const q = new THREE.Quaternion().setFromEuler(rot).premultiply(rootQ);
    const axisAt = new THREE.Vector3(0, pourer.px.top, 0).applyMatrix4(inTilt).setY(0).applyQuaternion(q).setY(0);
    const lip = new THREE.Vector3(recv.mouth.x, mouth.y, recv.mouth.z);
    if (axisAt.lengthSq() > mm(0.5) ** 2) lip.addScaledVector(axisAt.normalize(), Math.max(0, mouthR - (o.inset ?? mm(5))));
    const base = new THREE.Matrix4().compose(lip, q, scale);
    let need = 0;
    for (let k = 0; k < ANGLES; k++) {
      W.multiplyMatrices(base, turn.makeRotationAxis(axis, (o.maxTilt * k) / (ANGLES - 1))).multiply(inTilt);
      mid.set(0, (pourer.px.y0 + pourer.px.top) / 2, 0).applyMatrix4(W);
      for (const ob of obstacles)
        if (mid.distanceTo(ob.center) < pourer.radius + ob.radius + 0.6) need = Math.max(need, liftOver(pourer, ob, ob === recv || !inCavity(ob, recv.mouth), W));
    }
    const lift = Math.max(minLift, need + (o.gap ?? mm(2)));
    const cost = lift + (TURN_COST * Math.abs(d)) / (Math.PI / 4);
    if (!best || cost < best.cost) best = { lip, lift, rot, cost };
  }
  const b = best!;
  return { pos: o.root.worldToLocal(b.lip.setY(b.lip.y + b.lift)), rot: b.rot, receiver: recv, mouthR };
}

/** Điểm dòng chảy chạm: thẳng dưới môi rót ở độ cao `y` (thế giới; null = đáy trong), giữ trong lòng vật nhận (trừ bán kính dòng `r`). */
export function dropBelow(f: PourFit, lip: THREE.Vector3, y: number | null, r: number): THREE.Vector3 {
  const rc = f.receiver;
  if (y === null) y = new THREE.Vector3(0, rc.px.floor + mm(2), 0).applyMatrix4(rc.world).y;
  const local = new THREE.Vector3(rc.mouth.x, y, rc.mouth.z).applyMatrix4(rc.inv);
  const lim = Math.max(0, innerR(rc.px, Math.min(local.y, rc.px.top)) * unit(rc) - r - mm(1));
  const end = new THREE.Vector3(lip.x, y, lip.z);
  const dx = end.x - rc.mouth.x;
  const dz = end.z - rc.mouth.z;
  const d = Math.hypot(dx, dz);
  if (d > lim) end.set(rc.mouth.x + (dx / d) * lim, y, rc.mouth.z + (dz / d) * lim);
  return end;
}
