/**
 * Trường nồng độ chất tan 3D trong lòng dụng cụ hình trụ (thuần, không three).
 * Lưới đều nx×ny×nz phủ hộp [-R,R]×[y0,y1]×[-R,R]; ô ngoài bán kính R bị khoá (biên không thông lượng).
 * Mỗi bước: khuếch tán hiệu dụng (phân tử + rối) + đối lưu do chênh khối lượng riêng (phần đặc hơn trung bình chìm xuống,
 * phần loãng nổi lên – dòng NaOH loang từ mặt xuống đáy) + xoáy ngang nhẹ.
 * Nguồn: chép từ nhánh tạm dừng sim/TN-038-01 (TN-097-02 thêm `mask` cho đáy tròn ống nghiệm, `meanWhere`).
 */
export interface DyeFieldOptions {
  nx?: number;
  ny?: number;
  nz?: number;
  /** Bán kính lòng (đv cảnh). */
  radius: number;
  /** Đáy và đỉnh hộp lưới (đv cảnh, toạ độ cục bộ dụng cụ). */
  y0: number;
  y1: number;
  /** Hệ số khuếch tán hiệu dụng (đv²/s). */
  diffusion?: number;
  /** Vận tốc chìm cực đại (đv/s), đạt khi nồng độ vượt trung bình ≥ `scale`. */
  sink?: number;
  /** Tốc độ góc xoáy ngang (rad/s) – dòng đối lưu chậm. */
  swirl?: number;
  /** Nồng độ tham chiếu để chuẩn hoá đối lưu. */
  scale?: number;
  /** Ô có tâm (x,y,z) thuộc lòng chất lỏng? Mặc định: trong trụ bán kính R (vd. thêm đáy bán cầu ống nghiệm). */
  mask?: (x: number, y: number, z: number) => boolean;
}

export interface DyeField {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly radius: number;
  readonly y0: number;
  readonly y1: number;
  /** Nồng độ từng ô (x nhanh nhất, rồi y, rồi z). */
  readonly c: Float32Array;
  diffusion: number;
  sink: number;
  swirl: number;
  scale: number;
  /** Thêm `amount` (nồng độ·ô) phân bố Gauss bán kính `spread` quanh (x,y,z); `cap` = nồng độ bão hoà (bỏ qua nếu vượt). */
  add(x: number, y: number, z: number, amount: number, spread?: number, cap?: number): void;
  step(dt: number): void;
  /** Nồng độ trung bình trong lòng (tới mực `level` nếu có). */
  mean(level?: number): number;
  /** Trung bình `f(c)` trên các ô trong lòng thoả `where(x,y,z)`. */
  meanWhere(f: (c: number) => number, where: (x: number, y: number, z: number) => boolean): number;
  sample(x: number, y: number, z: number): number;
  clear(): void;
}

export function createDyeField(o: DyeFieldOptions): DyeField {
  const nx = o.nx ?? 24;
  const ny = o.ny ?? 18;
  const nz = o.nz ?? 24;
  const R = o.radius;
  const hx = (2 * R) / nx;
  const hy = (o.y1 - o.y0) / ny;
  const N = nx * ny * nz;
  const c = new Float32Array(N);
  const tmp = new Float32Array(N);
  const inside = new Uint8Array(N);
  const cx = (i: number) => -R + (i + 0.5) * hx;
  const cz = (k: number) => -R + (k + 0.5) * hx;
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  let cells = 0;
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++)
        if (Math.hypot(cx(i), cz(k)) < R && (!o.mask || o.mask(cx(i), o.y0 + (j + 0.5) * hy, cz(k)))) {
          inside[idx(i, j, k)] = 1;
          cells++;
        }
  const sx = 1;
  const sy = nx;
  const sz = nx * ny;

  const f: DyeField = {
    nx, ny, nz, radius: R, y0: o.y0, y1: o.y1, c,
    diffusion: o.diffusion ?? 0.004,
    sink: o.sink ?? 0.05,
    swirl: o.swirl ?? 0,
    scale: o.scale ?? 1,
    add(x, y, z, amount, spread = hx, cap = Infinity) {
      const s2 = 2 * spread * spread;
      const r = Math.ceil((spread * 2) / hx);
      const i0 = Math.floor((x + R) / hx);
      const j0 = Math.floor((y - o.y0) / hy);
      const k0 = Math.floor((z + R) / hx);
      let wsum = 0;
      const ws: [number, number][] = [];
      for (let k = k0 - r; k <= k0 + r; k++)
        for (let j = j0 - r; j <= j0 + r; j++)
          for (let i = i0 - r; i <= i0 + r; i++) {
            if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) continue;
            const n = idx(i, j, k);
            if (!inside[n]) continue;
            const d2 = (cx(i) - x) ** 2 + (o.y0 + (j + 0.5) * hy - y) ** 2 + (cz(k) - z) ** 2;
            const w = Math.exp(-d2 / s2);
            wsum += w;
            ws.push([n, w]);
          }
      if (!wsum) return;
      for (const [n, w] of ws) c[n] += Math.max(0, Math.min(amount * (w / wsum), cap - c[n]));
    },
    step(dt) {
      if (dt <= 0) return;
      // Ổn định explicit: tổng hệ số khuếch tán + đối lưu (upwind) của một ô ≤ 0,9.
      const rate = (D0: number, k: number) => 2 * D0 * k * (2 / (hx * hx) + 1 / (hy * hy)) + k * ((2 * f.swirl * R) / hx + f.sink / hy);
      const need = rate(f.diffusion, 1) / 0.9;
      const steps = Math.max(1, Math.min(160, Math.ceil(dt * need)));
      const h = dt / steps;
      // Bước quá lớn (tua rất nhanh): giảm đồng thời D và vận tốc để vẫn ổn định.
      const k = Math.min(1, 0.9 / (rate(f.diffusion, 1) * h));
      const D = f.diffusion * k;
      velK = k;
      for (let s = 0; s < steps; s++) sub(h, D);
    },
    mean(level) {
      return f.meanWhere((v) => v, (_x, y) => level === undefined || y < level);
    },
    meanWhere(fn, where) {
      let sum = 0;
      let n = 0;
      for (let k = 0; k < nz; k++)
        for (let j = 0; j < ny; j++)
          for (let i = 0; i < nx; i++) {
            const q = idx(i, j, k);
            if (inside[q] && where(cx(i), o.y0 + (j + 0.5) * hy, cz(k))) {
              sum += fn(c[q]);
              n++;
            }
          }
      return n ? sum / n : 0;
    },
    sample(x, y, z) {
      const i = Math.floor((x + R) / hx);
      const j = Math.floor((y - o.y0) / hy);
      const k = Math.floor((z + R) / hx);
      if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return 0;
      return c[idx(i, j, k)];
    },
    clear() {
      c.fill(0);
    },
  };

  /** Vận tốc dọc (âm = chìm), bão hoà ở ±sink để giữ ổn định CFL. */
  let velK = 1;
  const vel = (v: number, avg: number) => -f.sink * velK * Math.max(-1, Math.min(1, (v - avg) / f.scale));

  function sub(h: number, D: number) {
    let total = 0;
    for (let n = 0; n < N; n++) total += c[n];
    const avg = total / cells;
    const ax = (D * h) / (hx * hx);
    const ay = (D * h) / (hy * hy);
    for (let k = 0; k < nz; k++)
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++) {
          const n = idx(i, j, k);
          if (!inside[n]) continue;
          const v = c[n];
          const nb = (m: number, ok: boolean) => (ok && inside[m] ? c[m] : v);
          const xm = nb(n - sx, i > 0), xp = nb(n + sx, i < nx - 1);
          const ym = nb(n - sy, j > 0), yp = nb(n + sy, j < ny - 1);
          const zm = nb(n - sz, k > 0), zp = nb(n + sz, k < nz - 1);
          let d = ax * (xm + xp + zm + zp - 4 * v) + ay * (ym + yp - 2 * v);
          // Đối lưu dọc (upwind): w < 0 = chìm khi đặc hơn trung bình.
          const w = vel(v, avg);
          const wUp = vel(yp, avg);
          const wDn = vel(ym, avg);
          if (j < ny - 1 && inside[n + sy] && wUp < 0) d += (-wUp * yp * h) / hy;
          if (j > 0 && inside[n - sy] && wDn > 0) d += (wDn * ym * h) / hy;
          if ((w < 0 && j > 0 && inside[n - sy]) || (w > 0 && j < ny - 1 && inside[n + sy])) d -= (Math.abs(w) * v * h) / hy;
          // Xoáy ngang: vận chuyển theo phương tiếp tuyến (upwind đơn giản).
          if (f.swirl) {
            const ux = -f.swirl * velK * cz(k);
            const uz = f.swirl * velK * cx(i);
            d -= (h / hx) * (ux > 0 ? ux * (v - xm) : ux * (xp - v));
            d -= (h / hx) * (uz > 0 ? uz * (v - zm) : uz * (zp - v));
          }
          tmp[n] = Math.max(0, v + d);
        }
    c.set(tmp);
  }
  return f;
}
