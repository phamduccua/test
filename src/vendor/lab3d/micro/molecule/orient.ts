/** Định hướng phân tử (thuần): trục quán tính chính → x (dài nhất), z (giữa), y (ngắn nhất – pháp tuyến mặt phẳng). */
import type { MolAtom } from './types';

type M3 = number[][];

/** Trị riêng/vector riêng ma trận đối xứng 3×3 (Jacobi). Trả về cột vector riêng theo trị riêng giảm dần. */
export function eigenSym3(a: M3): { values: number[]; vectors: [number, number, number][] } {
  const A = a.map((r) => [...r]);
  const V: M3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += A[p][q] * A[p][q];
    if (off < 1e-14) break;
    for (let p = 0; p < 3; p++)
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(A[p][q]) < 1e-12) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
  }
  const idx = [0, 1, 2].sort((i, j) => A[j][j] - A[i][i]);
  return { values: idx.map((i) => A[i][i]), vectors: idx.map((i) => [V[0][i], V[1][i], V[2][i]] as [number, number, number]) };
}

/** Xoay toạ độ (đã căn tâm) vào hệ trục chính: dài nhất → x, giữa → z, ngắn nhất → y. Phân tử phẳng nằm ngang. */
export function principalOrient(atoms: MolAtom[]): MolAtom[] {
  const n = atoms.length || 1;
  const c = atoms.reduce((s, a) => [s[0] + a.x / n, s[1] + a.y / n, s[2] + a.z / n], [0, 0, 0]);
  const C: M3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const a of atoms) {
    const v = [a.x - c[0], a.y - c[1], a.z - c[2]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += v[i] * v[j];
  }
  const { vectors: [ex, ez0] } = eigenSym3(C);
  // Hệ phải: y = z × x.
  const ez = ez0;
  const ey: [number, number, number] = [ez[1] * ex[2] - ez[2] * ex[1], ez[2] * ex[0] - ez[0] * ex[2], ez[0] * ex[1] - ez[1] * ex[0]];
  const dot = (v: number[], e: number[]) => v[0] * e[0] + v[1] * e[1] + v[2] * e[2];
  return atoms.map((a) => {
    const v = [a.x - c[0], a.y - c[1], a.z - c[2]];
    return { ...a, x: dot(v, ex), y: dot(v, ey), z: dot(v, ez) };
  });
}
