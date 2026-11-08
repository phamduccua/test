import * as THREE from 'three';

/**
 * Số đo + giải tư thế bàn tay (thuần toán, mm, tay PHẢI; tay trái = soi gương x).
 * Khung tay: cổ tay ở gốc, ngón duỗi theo +y, lòng bàn tay quay −z, ngón cái phía −x.
 * Vật nắm (tư thế 'grip') nằm dọc trục x, tâm G trước lòng bàn tay.
 */
export interface FingerSpec {
  /** Khớp gốc ngón (MCP). */
  base: [number, number, number];
  /** Dài 3 đốt (gần → xa). */
  len: [number, number, number];
  radius: number;
}

/** Trỏ, giữa, nhẫn, út – tay người lớn dài ~185 mm, rộng ~84 mm. */
export const FINGERS: FingerSpec[] = [
  { base: [-27, 93, 0], len: [40, 24, 20], radius: 9 },
  { base: [-9, 97, 0], len: [44, 28, 21], radius: 9.2 },
  { base: [9, 94, 0], len: [41, 27, 21], radius: 8.7 },
  { base: [26, 86, 0], len: [33, 20, 18], radius: 7.6 },
];
export const THUMB: FingerSpec = { base: [-24, 14, -3], len: [44, 32, 27], radius: 10.5 };
/** Nửa bề dày lòng bàn tay. */
export const PALM_HALF = 13;
/** Biên độ gập tối đa từng khớp (rad). */
const MAX = [1.6, 1.85, 1.4];

/** Gập 3 khớp của ngón (rad, dương = gập về lòng bàn tay) + xoè (rad, dương = về phía ngón cái). */
export interface FingerPose {
  curl: [number, number, number];
  spread: number;
}
export interface ThumbPose {
  /** Đích đặt tâm đầu ngón cái (mm, khung tay). */
  target: THREE.Vector3;
  /** Hướng muốn bụng ngón cái quay về (khung tay). */
  bendToward: THREE.Vector3;
}
export interface PoseSolution {
  fingers: FingerPose[];
  thumb: ThumbPose;
  /** Tâm vật nắm (mm). */
  grip: THREE.Vector3;
  /** Giữa hai bụng ngón cái–trỏ + pháp tuyến (từ ngón trỏ sang ngón cái). */
  pinch: { point: THREE.Vector3; normal: THREE.Vector3 };
}

/**
 * Ngón quấn quanh trụ trục x tâm (cy, cz) bán kính `rho` (= bán kính vật + bán kính ngón), trong mặt phẳng yz của ngón, gốc ở MCP.
 * Mỗi đốt: điểm đầu đốt kế nằm trên đường tròn; không cắt được thì gập hết cỡ về phía tâm.
 */
export function wrapCurl(len: [number, number, number], cy: number, cz: number, rho: number): [number, number, number] {
  let py = 0;
  let pz = 0;
  let dy = 1;
  let dz = 0;
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const L = len[i];
    const ex = cy - py;
    const ez = cz - pz;
    const d = Math.hypot(ex, ez);
    let best = Infinity;
    if (d > 1e-6 && d <= L + rho && d >= Math.abs(L - rho)) {
      // Giao hai đường tròn (P, L) và (C, rho).
      const a = (L * L - rho * rho + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, L * L - a * a));
      const my = py + (a * ex) / d;
      const mz = pz + (a * ez) / d;
      for (const s of [1, -1]) {
        const qy = my + (s * h * -ez) / d - py;
        const qz = mz + (s * h * ex) / d - pz;
        const bend = Math.atan2(-(dy * qz - dz * qy), dy * qy + dz * qz);
        if (bend > -0.05 && bend < best) best = bend;
      }
    }
    if (best === Infinity) best = d > L + rho ? Math.atan2(-(dy * ez - dz * ex), dy * ex + dz * ez) : MAX[i];
    const bend = THREE.MathUtils.clamp(best, 0, MAX[i]);
    out[i] = bend;
    // Quay hướng đốt theo chiều gập (về −z) rồi đi hết đốt.
    const c = Math.cos(bend);
    const s = Math.sin(bend);
    [dy, dz] = [dy * c + dz * s, dz * c - dy * s];
    py += dy * L;
    pz += dz * L;
  }
  return out;
}

/** Tâm đầu ngón + điểm bụng ngón (mm, khung tay) theo tư thế – dùng cho neo 'tip' / 'pinch'. */
export function fingerTip(f: FingerSpec, p: FingerPose, pad = 0): THREE.Vector3 {
  const v = new THREE.Vector3(0, 0, 0);
  let a = 0;
  for (let i = 0; i < 3; i++) {
    a += p.curl[i];
    const L = i === 2 ? f.len[i] - f.radius * 0.85 : f.len[i];
    v.y += Math.cos(a) * L;
    v.z -= Math.sin(a) * L;
  }
  // Bụng ngón: lệch về phía gập (pháp tuyến −z của đốt xa).
  v.y -= Math.sin(a) * pad;
  v.z -= Math.cos(a) * pad;
  v.applyAxisAngle(new THREE.Vector3(0, 0, 1), p.spread);
  return v.add(new THREE.Vector3(...f.base));
}

/** Pháp tuyến bụng đốt xa (khung tay). */
export function padNormal(p: FingerPose): THREE.Vector3 {
  const a = p.curl[0] + p.curl[1] + p.curl[2];
  return new THREE.Vector3(0, -Math.sin(a), -Math.cos(a)).applyAxisAngle(new THREE.Vector3(0, 0, 1), p.spread);
}

