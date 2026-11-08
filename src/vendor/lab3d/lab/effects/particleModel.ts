/** Mô hình hạt thuần (khói, hơi, khí màu): sinh, trôi, nổi/chìm theo tỉ khối, nhiễu, tắt dần. */
export interface ParticleConfig {
  /** Hạt / giây. */
  rate: number;
  maxCount: number;
  life: [number, number];
  /** Kích thước (đơn vị cảnh) lúc sinh và lúc chết. */
  size: [number, number];
  /** Vận tốc ban đầu trung bình. */
  velocity: [number, number, number];
  /** Độ lệch ngẫu nhiên vận tốc. */
  spread: number;
  /** Gia tốc y: dương = nổi (hơi nước, H2), âm = chìm (Cl2, Br2). */
  buoyancy: number;
  /** Hệ số cản (1/s). */
  drag: number;
  /** Biên độ nhiễu xoáy (đơn vị/s²). */
  turbulence: number;
  /** Bán kính vùng phát. */
  emitRadius: number;
  /** Độ mờ cực đại 0…1. */
  opacity: number;
  /** Sàn (khí nặng loang ra): hạt không xuống thấp hơn. */
  floorY?: number;
}

export interface ParticleState {
  count: number;
  pos: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  rot: Float32Array;
  step(dt: number, origin: [number, number, number], emitting: boolean): void;
  clear(): void;
}

export function createParticleState(cfg: ParticleConfig, rand: () => number = Math.random): ParticleState {
  const n = cfg.maxCount;
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const alpha = new Float32Array(n);
  const rot = new Float32Array(n);
  const spin = new Float32Array(n);
  const age = new Float32Array(n);
  const life = new Float32Array(n);
  let acc = 0;
  let t = 0;
  const copy = (i: number, j: number) => {
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = pos[j * 3 + k];
      vel[i * 3 + k] = vel[j * 3 + k];
    }
    size[i] = size[j]; alpha[i] = alpha[j]; rot[i] = rot[j]; spin[i] = spin[j]; age[i] = age[j]; life[i] = life[j];
  };
  const st: ParticleState = {
    count: 0,
    pos,
    size,
    alpha,
    rot,
    clear() {
      st.count = 0;
      acc = 0;
    },
    step(dt, o, emitting) {
      t += dt;
      if (emitting) acc += cfg.rate * dt;
      while (acc >= 1 && st.count < n) {
        acc -= 1;
        const i = st.count++;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * cfg.emitRadius;
        pos[i * 3] = o[0] + Math.cos(a) * r;
        pos[i * 3 + 1] = o[1];
        pos[i * 3 + 2] = o[2] + Math.sin(a) * r;
        for (let k = 0; k < 3; k++) vel[i * 3 + k] = cfg.velocity[k] + (rand() - 0.5) * 2 * cfg.spread;
        age[i] = 0;
        life[i] = cfg.life[0] + (cfg.life[1] - cfg.life[0]) * rand();
        rot[i] = rand() * 6.28;
        spin[i] = (rand() - 0.5) * 1.2;
      }
      if (st.count >= n) acc = 0;
      const damp = Math.exp(-cfg.drag * dt);
      for (let i = 0; i < st.count; i++) {
        age[i] += dt;
        const u = age[i] / life[i];
        if (u >= 1) {
          copy(i, --st.count);
          i--;
          continue;
        }
        const px = pos[i * 3];
        const py = pos[i * 3 + 1];
        const pz = pos[i * 3 + 2];
        const tx = Math.sin(py * 7.1 + t * 1.3 + i) * cfg.turbulence;
        const tz = Math.cos(px * 6.3 - t * 1.1 + i * 0.7) * cfg.turbulence;
        vel[i * 3] = (vel[i * 3] + tx * dt) * damp;
        vel[i * 3 + 1] = (vel[i * 3 + 1] + cfg.buoyancy * dt) * damp;
        vel[i * 3 + 2] = (vel[i * 3 + 2] + tz * dt) * damp;
        pos[i * 3] = px + vel[i * 3] * dt;
        pos[i * 3 + 1] = py + vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] = pz + vel[i * 3 + 2] * dt;
        if (cfg.floorY !== undefined && pos[i * 3 + 1] < cfg.floorY) {
          pos[i * 3 + 1] = cfg.floorY;
          vel[i * 3 + 1] = 0;
          // loang ngang khi chạm sàn
          vel[i * 3] += Math.sign(vel[i * 3] || 1) * 0.02;
        }
        size[i] = cfg.size[0] + (cfg.size[1] - cfg.size[0]) * Math.sqrt(u);
        alpha[i] = cfg.opacity * Math.min(1, u * 5) * (1 - u) * (1.4 - u);
        rot[i] += spin[i] * dt;
      }
    },
  };
  return st;
}
