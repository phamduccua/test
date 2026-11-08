/**
 * Hỗ trợ động học thuần (không three): tích phân theo bước con, chuỗi số liệu theo thời gian, Arrhenius.
 * Dùng chung cho các thí nghiệm tốc độ phản ứng (H2O2/MnO2, Na2S2O3 + H2SO4, Fe + CuSO4…).
 */

/** R (J·mol⁻¹·K⁻¹). */
export const GAS_R = 8.314;
/** Thể tích mol khí ở 25 °C, 1 bar (L/mol) – SGK dùng 24,79. */
export const MOLAR_VOLUME_25 = 24.79;

/** Hệ số Arrhenius k(T)/k(Tref) với Ea (kJ/mol). */
export function arrheniusFactor(T: number, Ea: number, Tref = 25): number {
  const a = 1 / (Tref + 273.15) - 1 / (T + 273.15);
  return Math.exp(((Ea * 1000) / GAS_R) * a);
}

/**
 * Bước tích phân Euler chia nhỏ (ổn định cho tua nhanh): gọi `step(h)` nhiều lần với h ≤ maxStep.
 * Trả về số bước con đã chạy.
 */
export function substep(dt: number, maxStep: number, step: (h: number) => void): number {
  if (dt <= 0) return 0;
  const n = Math.max(1, Math.ceil(dt / maxStep));
  const h = dt / n;
  for (let i = 0; i < n; i++) step(h);
  return n;
}

/** Chuỗi (t, y) có giới hạn số điểm: tự gộp đôi (bỏ xen kẽ) khi đầy → giữ toàn bộ lịch sử ở độ phân giải giảm dần. */
export interface TimeSeries {
  readonly t: number[];
  readonly y: number[];
  /** Thêm điểm nếu cách điểm trước ≥ minDt. */
  push(t: number, y: number): void;
  last(): number | undefined;
  clear(): void;
}

export function createTimeSeries(maxPoints = 400, minDt = 0): TimeSeries {
  const t: number[] = [];
  const y: number[] = [];
  return {
    t,
    y,
    push(tt, yy) {
      if (t.length && tt - t[t.length - 1] < minDt) return;
      t.push(tt);
      y.push(yy);
      if (t.length > maxPoints) {
        for (let i = 1, j = 1; i < t.length; i += 2, j++) {
          t[j] = t[i];
          y[j] = y[i];
        }
        t.length = y.length = Math.ceil(t.length / 2);
      }
    },
    last: () => y[y.length - 1],
    clear() {
      t.length = 0;
      y.length = 0;
    },
  };
}

/** Đồng hồ bấm giờ thuần (chạy theo thời gian mô phỏng). */
export interface Stopwatch {
  readonly time: number;
  readonly running: boolean;
  start(): void;
  stop(): void;
  reset(): void;
  tick(dt: number): void;
}

export function createStopwatchModel(): Stopwatch {
  let time = 0;
  let running = false;
  return {
    get time() {
      return time;
    },
    get running() {
      return running;
    },
    start: () => void (running = true),
    stop: () => void (running = false),
    reset() {
      time = 0;
      running = false;
    },
    tick(dt) {
      if (running) time += dt;
    },
  };
}

/** Định dạng giây → "m:ss,s" (đồng hồ bấm giờ). */
export function formatClock(s: number, decimals = 1): string {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  const sec = r.toFixed(decimals).padStart(decimals ? 3 + decimals : 2, '0');
  return `${m}:${sec.replace('.', ',')}`;
}

/** Số tiếng Việt: dấu phẩy thập phân. */
export function viNum(v: number, decimals = 2): string {
  return v.toFixed(decimals).replace('.', ',');
}
