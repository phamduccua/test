/**
 * Quỹ đạo tán xạ Coulomb (thuần TS, không three): tích phân Verlet bước thích nghi cho một hạt mang điện dương
 * bay qua một nhóm "tâm tán xạ". Dùng cho thí nghiệm Rutherford (hạt nhân điểm) và mô hình Thomson (quả cầu tích điện đều).
 */
export type Vec3 = [number, number, number];

/** 'point' = hạt nhân điểm (lực ∝ 1/r², bị vỏ electron chắn ngoài bán kính R);
 *  'sphere' = điện tích dương phân bố đều trong quả cầu bán kính R (Thomson: lực ∝ r trong cầu, 0 ngoài cầu). */
export type FieldModel = 'point' | 'sphere';

export interface PathOptions {
  start: Vec3;
  /** Hướng bay ban đầu (tự chuẩn hoá). */
  dir: Vec3;
  /** Tốc độ ban đầu (đv/s). */
  speed?: number;
  centers: readonly Vec3[];
  /** Khoảng cách tiếp cận gần nhất khi bắn trực diện (đv cảnh) – tỉ lệ Z/E. */
  d: number;
  field: FieldModel;
  /** Bán kính nguyên tử (chắn / quả cầu Thomson). */
  R: number;
  /** Dừng khi rời vùng quanh `origin`: số = hình cầu bán kính đó, Vec3 = hộp nửa cạnh (x, y, z). */
  origin?: Vec3;
  bounds: number | Vec3;
  /** Khoảng cách tối thiểu giữa 2 điểm ghi lại. */
  minSeg?: number;
  maxSteps?: number;
}

export interface ScatterPath {
  /** xyz liên tiếp. */
  points: Float32Array;
  /** Thời điểm (s) tại mỗi điểm. */
  times: Float32Array;
  count: number;
  duration: number;
  /** Góc lệch giữa hướng đầu và hướng cuối (rad). */
  deflection: number;
  /** Khoảng cách nhỏ nhất tới một tâm. */
  closest: number;
}

/** Góc lệch theo công thức Rutherford: tan(θ/2) = d / (2b). */
export const rutherfordAngle = (b: number, d: number): number => 2 * Math.atan2(d, 2 * Math.abs(b));
/** Tham số va chạm cho góc lệch θ. */
export const impactForAngle = (theta: number, d: number): number => d / (2 * Math.tan(theta / 2));

export function scatterPath(o: PathOptions): ScatterPath {
  const v0 = o.speed ?? 1;
  const K = (v0 * v0 * o.d) / 2; // kQq/m: ½mv² = kQq/d
  const R = o.R;
  const org = o.origin ?? [0, 0, 0];
  const minSeg = o.minSeg ?? 0.01;
  const maxSteps = o.maxSteps ?? 40000;
  const n0 = Math.hypot(...o.dir) || 1;
  const p: Vec3 = [...o.start];
  const v: Vec3 = [(o.dir[0] / n0) * v0, (o.dir[1] / n0) * v0, (o.dir[2] / n0) * v0];
  const a: Vec3 = [0, 0, 0];
  let near = Infinity;
  let closest = Infinity;
  const accel = () => {
    a[0] = a[1] = a[2] = 0;
    near = Infinity;
    for (const c of o.centers) {
      const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2];
      const r = Math.max(1e-5, Math.hypot(dx, dy, dz));
      near = Math.min(near, r);
      if (r >= R) continue;
      const f = o.field === 'point' ? K / (r * r * r) : K / (R * R * R);
      a[0] += f * dx;
      a[1] += f * dy;
      a[2] += f * dz;
    }
    closest = Math.min(closest, near);
  };
  const B = o.bounds;
  const outside = (q: Vec3) =>
    typeof B === 'number'
      ? Math.hypot(q[0] - org[0], q[1] - org[1], q[2] - org[2]) > B
      : Math.abs(q[0] - org[0]) > B[0] || Math.abs(q[1] - org[1]) > B[1] || Math.abs(q[2] - org[2]) > B[2];
  const pts: number[] = [...p];
  const ts: number[] = [0];
  let t = 0;
  let last: Vec3 = [...p];
  accel();
  for (let i = 0; i < maxSteps; i++) {
    const sp = Math.hypot(...v) || 1e-6;
    // Bước thích nghi: nhỏ khi ở gần một tâm (chỗ lực đổi nhanh).
    // Ngoài mọi vùng lực: bay thẳng, bước lớn (không vượt quá minSeg để vệt vẫn mịn).
    const dt = near > R ? Math.min(Math.max(near - R, 0.004), minSeg * 2) / sp : Math.min(0.015, (0.02 * Math.max(near, o.d * 0.05)) / sp);
    for (let k = 0; k < 3; k++) {
      v[k] += 0.5 * dt * a[k];
      p[k] += dt * v[k];
    }
    accel();
    for (let k = 0; k < 3; k++) v[k] += 0.5 * dt * a[k];
    t += dt;
    const far = outside(p);
    if (far || Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) >= minSeg) {
      pts.push(...p);
      ts.push(t);
      last = [...p];
    }
    if (far) break;
  }
  const sp = Math.hypot(...v) || 1;
  const cos = (v[0] * o.dir[0] + v[1] * o.dir[1] + v[2] * o.dir[2]) / (sp * n0);
  return {
    points: Float32Array.from(pts),
    times: Float32Array.from(ts),
    count: ts.length,
    duration: t,
    deflection: Math.acos(Math.max(-1, Math.min(1, cos))),
    closest,
  };
}

/** Nội suy vị trí trên quỹ đạo tại thời điểm `t` (ghi vào `out`); trả chỉ số đoạn. */
export function pathPointAt(path: ScatterPath, t: number, out: Vec3): number {
  const { times, points, count } = path;
  if (t <= 0) {
    out[0] = points[0]; out[1] = points[1]; out[2] = points[2];
    return 0;
  }
  let i = 1;
  while (i < count - 1 && times[i] < t) i++;
  const t0 = times[i - 1], t1 = times[i];
  const f = t1 > t0 ? Math.min(1, (t - t0) / (t1 - t0)) : 1;
  for (let k = 0; k < 3; k++) out[k] = points[(i - 1) * 3 + k] + f * (points[i * 3 + k] - points[(i - 1) * 3 + k]);
  return i;
}
