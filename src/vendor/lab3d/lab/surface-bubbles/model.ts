/**
 * Bọt khí sinh trên BỀ MẶT vật rắn (thuần, không three): nảy mầm tại điểm ngẫu nhiên (do `sample` cung cấp),
 * bám và lớn dần, tách ra nổi lên (lắc ngang), dừng lăn tăn ở mặt thoáng rồi vỡ.
 */
export interface SurfacePoint {
  x: number;
  y: number;
  z: number;
  /** Pháp tuyến ngoài (để bọt nằm sát bề mặt). */
  nx: number;
  ny: number;
  nz: number;
}

export interface SurfaceBubbleConfig {
  /** Số bọt mới / giây. */
  rate: number;
  sizeMin: number;
  sizeMax: number;
  /** Thời gian bám bề mặt (s) [min, max] – bọt lớn bám lâu hơn. */
  cling: [number, number];
  /** Vận tốc nổi của bọt lớn nhất (đv/s). */
  rise: number;
  wobble: number;
  /** Thời gian đọng ở mặt thoáng trước khi vỡ (s). */
  linger: [number, number];
  maxCount: number;
  /** Ghi một điểm ngẫu nhiên trên bề mặt vào `out`; trả về false nếu không có chỗ sinh. */
  sample(out: SurfacePoint): boolean;
  radiusAt(y: number): number;
  surface(): number;
}

export interface SurfaceBubbleState {
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  /** Bán kính hiện tại. */
  size: Float32Array;
  /** Số bọt vỡ ở bước vừa rồi. */
  step(dt: number): number;
  clear(): void;
}

const FIELDS = 12;

export function createSurfaceBubbleState(cfg: SurfaceBubbleConfig, rand: () => number = Math.random): SurfaceBubbleState {
  const n = cfg.maxCount;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const z = new Float32Array(n);
  const size = new Float32Array(n);
  // Trạng thái riêng: [px, py, pz, nx, nz, target, phase, freq, age, mode, until, bx/bz…]
  const f = new Float32Array(n * FIELDS);
  const sp: SurfacePoint = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 };
  let acc = 0;
  const kill = (i: number, st: SurfaceBubbleState) => {
    const j = --st.count;
    x[i] = x[j]; y[i] = y[j]; z[i] = z[j]; size[i] = size[j];
    f.copyWithin(i * FIELDS, j * FIELDS, j * FIELDS + FIELDS);
  };
  const st: SurfaceBubbleState = {
    count: 0, x, y, z, size,
    clear() {
      st.count = 0;
      acc = 0;
    },
    step(dt) {
      acc += cfg.rate * dt;
      while (acc >= 1 && st.count < n) {
        acc -= 1;
        if (!cfg.sample(sp)) break;
        const i = st.count++;
        const o = i * FIELDS;
        const target = cfg.sizeMin + (cfg.sizeMax - cfg.sizeMin) * rand() ** 2.2;
        const k = (target - cfg.sizeMin) / Math.max(1e-9, cfg.sizeMax - cfg.sizeMin);
        f.set([sp.x, sp.y, sp.z, sp.nx, sp.nz, target, rand() * 6.28, 5 + rand() * 6, 0, 0,
          cfg.cling[0] + (cfg.cling[1] - cfg.cling[0]) * (0.4 * rand() + 0.6 * k), 0], o);
        x[i] = sp.x; y[i] = sp.y; z[i] = sp.z;
        size[i] = target * 0.25;
      }
      if (st.count >= n) acc = 0;
      const top = cfg.surface();
      let pops = 0;
      for (let i = 0; i < st.count; i++) {
        const o = i * FIELDS;
        const target = f[o + 5];
        f[o + 8] += dt;
        const age = f[o + 8];
        const mode = f[o + 9];
        if (mode === 0) {
          // Bám: lớn dần, tâm lùi ra theo pháp tuyến.
          const g = Math.min(1, age / f[o + 10]);
          size[i] = target * (0.25 + 0.75 * Math.sqrt(g));
          x[i] = f[o] + f[o + 3] * size[i];
          y[i] = f[o + 1];
          z[i] = f[o + 2] + f[o + 4] * size[i];
          if (g >= 1) {
            f[o + 9] = 1;
            f[o + 8] = 0;
            f[o] = x[i];
            f[o + 2] = z[i];
          }
        } else if (mode === 1) {
          const k = target / cfg.sizeMax;
          y[i] += cfg.rise * (0.4 + 0.6 * k) * Math.min(1, age * 5) * dt;
          // Trôi nhẹ ra xa bề mặt trong 0,3 s đầu rồi lắc ngang.
          const push = Math.min(age, 0.3) * target * 2.5;
          const w = cfg.wobble * (0.3 + k) * Math.min(1, age * 2);
          let px = f[o] + f[o + 3] * push + Math.sin(f[o + 6] + age * f[o + 7]) * w;
          let pz = f[o + 2] + f[o + 4] * push + Math.cos(f[o + 6] * 1.3 + age * f[o + 7] * 0.8) * w;
          const lim = Math.max(0, cfg.radiusAt(y[i]) - target * 1.2);
          const d = Math.hypot(px, pz);
          if (d > lim && d > 0) {
            px *= lim / d;
            pz *= lim / d;
          }
          x[i] = px;
          z[i] = pz;
          if (y[i] > top - target * 0.55) {
            f[o + 9] = 2;
            f[o + 8] = 0;
            f[o + 10] = cfg.linger[0] + (cfg.linger[1] - cfg.linger[0]) * rand();
            f[o] = x[i];
            f[o + 2] = z[i];
          }
        } else {
          // Lăn tăn ở mặt thoáng: nhấp nhô, co lại rồi vỡ.
          const g = age / f[o + 10];
          y[i] = top - target * (0.5 - 0.15 * Math.sin(age * 25 + f[o + 6]));
          size[i] = target * (1 - 0.4 * g * g);
          if (g >= 1) {
            pops++;
            kill(i, st);
            i--;
          }
        }
      }
      return pops;
    },
  };
  return st;
}
