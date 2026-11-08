import * as THREE from 'three';

/**
 * Hình dạng trùng giày (Paramecium caudatum) theo µm: dài 250 µm (trục x, đầu trước +x), rộng 64 µm (z), dày 48 µm (y, mặt lưng +y).
 * Đuôi thon hơn đầu, rãnh miệng lõm ở mặt bụng (+z) từ đầu trước tới giữa thân – dáng “chiếc giày”.
 */
export const PARAMECIUM_SIZE = { length: 250, width: 64, thickness: 48 } as const;

const A = PARAMECIUM_SIZE.length / 2;
const BZ = PARAMECIUM_SIZE.width / 2;
const BY = PARAMECIUM_SIZE.thickness / 2;
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Ánh xạ điểm trên mặt cầu đơn vị (trục cực = y) sang mặt tế bào. */
export function parameciumPoint(px: number, py: number, pz: number, out = new THREE.Vector3()): THREE.Vector3 {
  const u = py;
  // Đuôi (u < 0) thon dần; đầu trước tròn, hơi hẹp.
  const taper = (1 - 0.34 * smooth(-u * 1.1)) * (1 - 0.1 * Math.max(0, u) ** 2);
  let y = px * BY * taper;
  let z = pz * BZ * taper;
  // Rãnh miệng: lõm vào ở mặt bụng, sâu nhất quanh u ≈ 0,3, chạy chéo nhẹ.
  if (pz > 0) {
    const win = smooth((u + 0.1) / 0.3) * smooth((0.85 - u) / 0.3);
    const across = Math.exp(-(((px - 0.25 * u) / 0.42) ** 2));
    z -= 11 * win * across * pz;
  }
  // Thân hơi cong và xoắn như chiếc giày.
  z += 7 * (u * u - 0.35) - 4 * u;
  y += 3 * u;
  return out.set(u * A, y, z);
}

/** Lưới thân tế bào (đã tính pháp tuyến). */
export function parameciumGeometry(wSeg = 64, hSeg = 32): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, wSeg, hSeg);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    parameciumPoint(pos.getX(i), pos.getY(i), pos.getZ(i), v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Nhân lớn hình hạt đậu (µm), lõm ở phía −z để nhân bé nằm sát. */
export function macronucleusGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 32, 18);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    if (z < 0) z += 0.45 * Math.exp(-((x / 0.45) ** 2)) * -z * 1.2;
    pos.setXYZ(i, x * 27, y * 12, z * 15);
  }
  g.computeVertexNormals();
  return g;
}

export interface CiliaAnchor {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  /** Trục quay khi lông đập (vuông góc pháp tuyến và trục thân). */
  axis: THREE.Vector3;
  /** Vị trí dọc thân −1…1 (pha sóng đập lan truyền). */
  u: number;
}

/** Điểm mọc lông bơi phân bố đều trên mặt tế bào (Fibonacci), có pháp tuyến. */
export function ciliaAnchors(count: number): CiliaAnchor[] {
  const out: CiliaAnchor[] = [];
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  const r = new THREE.Vector3();
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const rad = Math.sqrt(1 - y * y);
    const th = i * golden;
    const x = Math.cos(th) * rad;
    const z = Math.sin(th) * rad;
    parameciumPoint(x, y, z, p);
    // Pháp tuyến bằng sai phân: hai hướng tiếp tuyến trên mặt cầu.
    const e = 1e-3;
    parameciumPoint(x + e * -Math.sin(th), y, z + e * Math.cos(th), q).sub(p);
    const t2 = new THREE.Vector3(x, y, z).cross(new THREE.Vector3(-Math.sin(th), 0, Math.cos(th))).normalize();
    parameciumPoint(x + e * t2.x, y + e * t2.y, z + e * t2.z, r).sub(p);
    const n = q.clone().cross(r).normalize();
    const out0 = p.clone().sub(parameciumPoint(0, y, 0, new THREE.Vector3())).add(new THREE.Vector3(y * 4, 0, 0));
    if (n.dot(out0) < 0) n.negate();
    const axis = n.clone().cross(new THREE.Vector3(1, 0, 0));
    if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1);
    out.push({ pos: p.clone(), normal: n, axis: axis.normalize(), u: y });
  }
  return out;
}
