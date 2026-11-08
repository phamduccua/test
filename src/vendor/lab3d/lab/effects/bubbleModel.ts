/** Mô hình bọt khí thuần (không three): sinh Poisson, nổi theo cỡ, lắc ngang, vỡ ở mặt thoáng. */
export interface BubbleSource {
  /** Tâm vùng sinh (toạ độ cục bộ dụng cụ). */
  x: number;
  y: number;
  z: number;
  /** Bán kính đĩa sinh (0 = một điểm). */
  radius: number;
}

export interface BubbleConfig {
  /** Số bọt / giây. */
  rate: number;
  sizeMin: number;
  sizeMax: number;
  /** Vận tốc nổi của bọt lớn nhất (đơn vị/s). */
  rise: number;
  /** Biên độ lắc ngang (đơn vị). */
  wobble: number;
  maxCount: number;
  source: BubbleSource;
  /** Bán kính lòng tại độ cao y. */
  radiusAt(y: number): number;
  /** Độ cao mặt thoáng hiện tại. */
  surface(): number;
}

export interface BubbleState {
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  size: Float32Array;
  step(dt: number): number;
  clear(): void;
}

export function createBubbleState(cfg: BubbleConfig, rand: () => number = Math.random): BubbleState {
  const n = cfg.maxCount;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const z = new Float32Array(n);
  const size = new Float32Array(n);
  const bx = new Float32Array(n);
  const bz = new Float32Array(n);
  const phase = new Float32Array(n);
  const freq = new Float32Array(n);
  const age = new Float32Array(n);
  let acc = 0;
  const st: BubbleState = {
    count: 0,
    x,
    y,
    z,
    size,
    clear() {
      st.count = 0;
      acc = 0;
    },
    step(dt) {
      // Sinh mới
      acc += cfg.rate * dt;
      while (acc >= 1 && st.count < n) {
        acc -= 1;
        const i = st.count++;
        const a = rand() * Math.PI * 2;
        const rr = Math.sqrt(rand()) * cfg.source.radius;
        bx[i] = cfg.source.x + Math.cos(a) * rr;
        bz[i] = cfg.source.z + Math.sin(a) * rr;
        y[i] = cfg.source.y;
        size[i] = cfg.sizeMin + (cfg.sizeMax - cfg.sizeMin) * rand() ** 2;
        phase[i] = rand() * 6.28;
        freq[i] = 5 + rand() * 6;
        age[i] = 0;
      }
      if (st.count >= n) acc = 0;
      // Chuyển động + vỡ
      const top = cfg.surface();
      let pops = 0;
      for (let i = 0; i < st.count; i++) {
        age[i] += dt;
        const k = size[i] / cfg.sizeMax;
        y[i] += cfg.rise * (0.45 + 0.55 * k) * Math.min(1, age[i] * 6) * dt;
        const w = cfg.wobble * (0.3 + k) * Math.min(1, age[i] * 2);
        let px = bx[i] + Math.sin(phase[i] + age[i] * freq[i]) * w;
        let pz = bz[i] + Math.cos(phase[i] * 1.3 + age[i] * freq[i] * 0.8) * w;
        const lim = Math.max(0, cfg.radiusAt(y[i]) - size[i] * 1.2);
        const d = Math.hypot(px, pz);
        if (d > lim && d > 0) {
          px *= lim / d;
          pz *= lim / d;
        }
        x[i] = px;
        z[i] = pz;
        if (y[i] > top - size[i] * 0.6) {
          pops++;
          const j = --st.count;
          x[i] = x[j]; y[i] = y[j]; z[i] = z[j]; size[i] = size[j];
          bx[i] = bx[j]; bz[i] = bz[j]; phase[i] = phase[j]; freq[i] = freq[j]; age[i] = age[j];
          i--;
        }
      }
      return pops;
    },
  };
  return st;
}
