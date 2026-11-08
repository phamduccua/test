import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Vỏ tròn xoay bổ một múi (cutaway): mặt ngoài + mặt trong (Lathe quanh trục y, cùng góc φ) và hai mặt cắt phẳng nối chúng.
 * `outer`/`inner` là profile (x = bán kính, y) cùng số điểm, đi từ đáy lên đỉnh. Múi bị bỏ: φ ∉ [phiStart, phiStart + phiLength].
 * Dùng vật liệu `side: DoubleSide`. `inner` toàn bán kính 0 → khối đặc bổ múi (vd. tế bào chất).
 */
export function cutawayShell(outer: THREE.Vector2[], inner: THREE.Vector2[], phiStart: number, phiLength: number, segments = 48): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.LatheGeometry(outer, segments, phiStart, phiLength)];
  if (inner.some((p) => p.x > 1e-6)) parts.push(new THREE.LatheGeometry(inner, segments, phiStart, phiLength));
  for (const phi of [phiStart, phiStart + phiLength]) parts.push(cutFace(outer, inner, phi));
  parts.forEach((g) => g.deleteAttribute('uv'));
  const geo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  parts.forEach((g) => g.dispose());
  return geo;
}

function cutFace(outer: THREE.Vector2[], inner: THREE.Vector2[], phi: number): THREE.BufferGeometry {
  const [s, c] = [Math.sin(phi), Math.cos(phi)];
  const pos: number[] = [];
  const nor: number[] = [];
  const P = (p: THREE.Vector2) => [p.x * s, p.y, p.x * c];
  for (let i = 0; i < outer.length - 1; i++) {
    const quad = [P(outer[i]), P(outer[i + 1]), P(inner[i + 1]), P(inner[i])];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      pos.push(...quad[k]);
      nor.push(c, 0, -s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** Profile cầu (n + 1 điểm, đáy → đỉnh) bán kính r; `halfLen` > 0 → viên nang (trụ dài 2·halfLen giữa hai bán cầu). */
export function roundProfile(r: number, halfLen = 0, n = 24): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const half = Math.ceil(n / 2);
  for (let i = 0; i <= half; i++) {
    const a = -Math.PI / 2 + (i / half) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), r * Math.sin(a) - halfLen));
  }
  for (let i = 0; i <= half; i++) {
    const a = (i / half) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), r * Math.sin(a) + halfLen));
  }
  return pts;
}
