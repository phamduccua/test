import type { ScalarGrid } from './grid';

/** Kết quả dựng mặt: tam giác rời (không chỉ số), pháp tuyến theo gradient trường (mượt). */
export interface SurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  triangles: number;
}

// Khối lập phương chia 6 tứ diện quanh đường chéo 0–7 (góc b: dx = b&1, dy = b>>1 &1, dz = b>>2 &1) → không nứt giữa các ô.
const TETS = [
  [0, 1, 3, 7],
  [0, 3, 2, 7],
  [0, 2, 6, 7],
  [0, 6, 4, 7],
  [0, 4, 5, 7],
  [0, 5, 1, 7],
];

class Buf {
  a = new Float32Array(1 << 15);
  len = 0;
  push3(x: number, y: number, z: number) {
    if (this.len + 3 > this.a.length) {
      const b = new Float32Array(this.a.length * 2);
      b.set(this.a);
      this.a = b;
    }
    this.a[this.len++] = x;
    this.a[this.len++] = y;
    this.a[this.len++] = z;
  }
  out() {
    return this.a.slice(0, this.len);
  }
}

/**
 * Marching tetrahedra (thuần): mặt `sign·f = level` của lưới; miền trong là `sign·f > level`.
 * `sign = −1` để lấy thuỳ âm của ψ. Toạ độ đầu ra = toạ độ lưới (−half…half).
 */
export function polygonize(g: ScalarGrid, level: number, sign: 1 | -1 = 1): SurfaceMesh {
  const { n, data, step, half } = g;
  const n2 = n * n;
  const pos = new Buf();
  const nor = new Buf();
  const val = (i: number, j: number, k: number) => sign * data[i + n * j + n2 * k];
  const grad = (i: number, j: number, k: number, out: number[], o: number) => {
    const c = (a: number) => Math.min(n - 1, Math.max(0, a));
    out[o] = val(c(i + 1), j, k) - val(c(i - 1), j, k);
    out[o + 1] = val(i, c(j + 1), k) - val(i, c(j - 1), k);
    out[o + 2] = val(i, j, c(k + 1)) - val(i, j, c(k - 1));
  };
  const v = new Array<number>(8);
  const cg = new Array<number>(24);
  const ex: number[] = new Array(12); // tối đa 4 đỉnh cắt × (vị trí 3)
  const en: number[] = new Array(12);
  const ins = [0, 0, 0, 0];
  const outs = [0, 0, 0, 0];
  let ne = 0;
  let ci = 0;
  let cj = 0;
  let ck = 0;
  const edge = (a: number, b: number) => {
    const t = (level - v[a]) / (v[b] - v[a]);
    const p = (c: number, ax: number) => ((c >> ax) & 1);
    for (let ax = 0; ax < 3; ax++) {
      const base = ax === 0 ? ci : ax === 1 ? cj : ck;
      ex[ne * 3 + ax] = -half + (base + p(a, ax) + t * (p(b, ax) - p(a, ax))) * step;
      en[ne * 3 + ax] = -(cg[a * 3 + ax] + t * (cg[b * 3 + ax] - cg[a * 3 + ax]));
    }
    ne++;
  };
  const emit = (q: number) => {
    pos.push3(ex[q * 3], ex[q * 3 + 1], ex[q * 3 + 2]);
    const L = Math.hypot(en[q * 3], en[q * 3 + 1], en[q * 3 + 2]) || 1;
    nor.push3(en[q * 3] / L, en[q * 3 + 1] / L, en[q * 3 + 2] / L);
  };
  const tri = (a: number, b: number, c: number) => {
    const ux = ex[b * 3] - ex[a * 3], uy = ex[b * 3 + 1] - ex[a * 3 + 1], uz = ex[b * 3 + 2] - ex[a * 3 + 2];
    const wx = ex[c * 3] - ex[a * 3], wy = ex[c * 3 + 1] - ex[a * 3 + 1], wz = ex[c * 3 + 2] - ex[a * 3 + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const s = nx * (en[a * 3] + en[b * 3] + en[c * 3]) + ny * (en[a * 3 + 1] + en[b * 3 + 1] + en[c * 3 + 1]) + nz * (en[a * 3 + 2] + en[b * 3 + 2] + en[c * 3 + 2]);
    emit(a);
    emit(s >= 0 ? b : c);
    emit(s >= 0 ? c : b);
  };
  for (ck = 0; ck < n - 1; ck++)
    for (cj = 0; cj < n - 1; cj++)
      for (ci = 0; ci < n - 1; ci++) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let b = 0; b < 8; b++) {
          v[b] = val(ci + (b & 1), cj + ((b >> 1) & 1), ck + ((b >> 2) & 1));
          lo = Math.min(lo, v[b]);
          hi = Math.max(hi, v[b]);
        }
        if (lo > level || hi <= level) continue;
        for (let b = 0; b < 8; b++) grad(ci + (b & 1), cj + ((b >> 1) & 1), ck + ((b >> 2) & 1), cg, b * 3);
        for (const T of TETS) {
          let ni = 0;
          let no = 0;
          for (let q = 0; q < 4; q++) {
            if (v[T[q]] > level) ins[ni++] = T[q];
            else outs[no++] = T[q];
          }
          ne = 0;
          if (ni === 1 || ni === 3) {
            const lone = ni === 1 ? ins[0] : outs[0];
            const others = ni === 1 ? outs : ins;
            edge(lone, others[0]);
            edge(lone, others[1]);
            edge(lone, others[2]);
            tri(0, 1, 2);
          } else if (ni === 2) {
            edge(ins[0], outs[0]);
            edge(ins[0], outs[1]);
            edge(ins[1], outs[1]);
            edge(ins[1], outs[0]);
            tri(0, 1, 2);
            tri(0, 2, 3);
          }
        }
      }
  const positions = pos.out();
  return { positions, normals: nor.out(), triangles: positions.length / 9 };
}
