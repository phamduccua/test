/** Chuyển động Brown trong hộp (thuần, không three): Ornstein–Uhlenbeck cho vận tốc, phản xạ ở thành, dò va chạm. */
import { seeded } from '../atom/packing';

export interface BrownianOptions {
  count: number;
  /** Nửa kích thước hộp [hx, hy, hz] và tâm. */
  half: [number, number, number];
  center?: [number, number, number];
  /** Tốc độ trung bình (đv/s). */
  speed?: number;
  /** Thời gian "nhớ" vận tốc (s): nhỏ = rung lắc, lớn = bay thẳng. */
  relax?: number;
  /** Khoảng cách tối thiểu tới thành (bán kính hạt). */
  margin?: number;
  seed?: number;
}

export interface BrownianBox {
  readonly count: number;
  pos: Float32Array;
  vel: Float32Array;
  /** 0 = hạt bị "giữ" (không tự di chuyển – đang phản ứng/bám bề mặt). */
  free: Uint8Array;
  half: [number, number, number];
  center: [number, number, number];
  speed: number;
  step(dt: number): void;
  /** Đặt lại hạt i ở vị trí ngẫu nhiên (tuỳ chọn giới hạn y). */
  scatter(i: number, yMin?: number, yMax?: number): void;
  set(i: number, x: number, y: number, z: number): void;
}

export function createBrownian(o: BrownianOptions): BrownianBox {
  const rnd = seeded(o.seed ?? 11);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rnd()))) * Math.cos(2 * Math.PI * rnd());
  const n = o.count;
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const free = new Uint8Array(n).fill(1);
  const relax = o.relax ?? 0.6;
  const m = o.margin ?? 0;
  const box: BrownianBox = {
    count: n,
    pos,
    vel,
    free,
    half: o.half,
    center: o.center ?? [0, 0, 0],
    speed: o.speed ?? 0.5,
    scatter(i, yMin, yMax) {
      const [hx, hy, hz] = box.half;
      const [cx, cy, cz] = box.center;
      const lo = yMin ?? cy - hy + m;
      const hi = yMax ?? cy + hy - m;
      pos[i * 3] = cx + (rnd() * 2 - 1) * (hx - m);
      pos[i * 3 + 1] = lo + rnd() * (hi - lo);
      pos[i * 3 + 2] = cz + (rnd() * 2 - 1) * (hz - m);
      for (let k = 0; k < 3; k++) vel[i * 3 + k] = gauss() * box.speed * 0.6;
    },
    set(i, x, y, z) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    },
    step(dt) {
      if (dt <= 0) return;
      // OU chính xác: độ lệch chuẩn dừng mỗi trục = speed/√3.
      const decay = Math.exp(-dt / relax);
      const kick = (box.speed / Math.sqrt(3)) * Math.sqrt(1 - decay * decay);
      for (let i = 0; i < n; i++) {
        if (!free[i]) continue;
        for (let k = 0; k < 3; k++) {
          const j = i * 3 + k;
          vel[j] = vel[j] * decay + kick * gauss();
          pos[j] += vel[j] * dt;
          const lo = box.center[k] - box.half[k] + m;
          const hi = box.center[k] + box.half[k] - m;
          if (pos[j] < lo) {
            pos[j] = 2 * lo - pos[j];
            vel[j] = Math.abs(vel[j]);
          } else if (pos[j] > hi) {
            pos[j] = 2 * hi - pos[j];
            vel[j] = -Math.abs(vel[j]);
          }
        }
      }
    },
  };
  for (let i = 0; i < n; i++) box.scatter(i);
  return box;
}

/** Duyệt mọi cặp (i ∈ a, j ∈ b) tự do cách nhau < r; `same` = a và b là một hộp (bỏ i ≥ j). */
export function forContacts(a: BrownianBox, b: BrownianBox, r: number, cb: (i: number, j: number, d: number) => void): void {
  const same = a === b;
  const r2 = r * r;
  for (let i = 0; i < a.count; i++) {
    if (!a.free[i]) continue;
    for (let j = same ? i + 1 : 0; j < b.count; j++) {
      if (!b.free[j]) continue;
      const dx = a.pos[i * 3] - b.pos[j * 3];
      const dy = a.pos[i * 3 + 1] - b.pos[j * 3 + 1];
      const dz = a.pos[i * 3 + 2] - b.pos[j * 3 + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < r2) cb(i, j, Math.sqrt(d2));
    }
  }
}
