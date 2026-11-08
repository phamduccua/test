/** Logic thuần của kit âm thanh (không Web Audio, không three) – dễ kiểm. */
import type { AudioSettings } from './types';

export const DEFAULT_SETTINGS: AudioSettings = { volume: 0.6, muted: false };
export const SETTINGS_KEY = 'hoa10.audio';

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Mức tham số 0…1 → hệ số gain (đường cong công suất ~ cảm nhận độ to). */
export function levelToGain(level: number, curve = 1.6): number {
  return Math.pow(clamp01(level), curve);
}

/** Âm lượng tổng (thanh trượt 0…1) → gain: bình phương để nửa thanh ≈ −12 dB. */
export function masterGain(s: AudioSettings): number {
  return s.muted ? 0 : clamp01(s.volume) ** 2;
}

/** Tốc độ phát kèm lệch ngẫu nhiên ±jitter. */
export function jitterRate(rate = 1, jitter = 0, rand: () => number = Math.random): number {
  return Math.max(0.25, rate * (1 + (rand() * 2 - 1) * Math.max(0, jitter)));
}

export function parseSettings(raw: string | null): AudioSettings {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<AudioSettings>) : {};
    return {
      volume: typeof v.volume === 'number' ? clamp01(v.volume) : DEFAULT_SETTINGS.volume,
      muted: typeof v.muted === 'boolean' ? v.muted : DEFAULT_SETTINGS.muted,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Định dạng ưu tiên: Opus/WebM nếu trình duyệt giải được, không thì MP3 (Safari cũ). */
export function pickFormat(canPlay: (mime: string) => string): 'webm' | 'mp3' {
  return canPlay('audio/webm; codecs="opus"') ? 'webm' : 'mp3';
}

/**
 * Lịch crossfade vòng lặp: mỗi bản phát đoạn [head, dur − tail] của bộ đệm; bản sau bắt đầu khi bản trước còn `xfade` s
 * (theo thời gian bộ đệm). Đệm đầu/đuôi nuốt khoảng lặng giải mã MP3 (encoder delay/padding).
 */
export interface LoopPlan {
  head: number;
  end: number;
  xfade: number;
}

export function loopPlan(duration: number, ambient: boolean): LoopPlan {
  const head = Math.min(0.06, duration * 0.02);
  const end = Math.max(head + 0.05, duration - Math.min(0.06, duration * 0.02));
  const span = end - head;
  const xfade = Math.min(ambient ? 1.5 : 0.3, span * 0.2);
  return { head, end, xfade };
}

/** Thời điểm (s, đồng hồ AudioContext) bản kế tiếp phải bắt đầu: khi vị trí bộ đệm chạm `end − xfade`. */
export function nextStartAt(now: number, pos: number, plan: LoopPlan, rate: number): number {
  return now + Math.max(0, plan.end - plan.xfade - pos) / Math.max(0.05, rate);
}

/** Đường cong crossfade công suất đều (n điểm) cho setValueCurveAtTime: lên (in) hoặc xuống (out). */
export function equalPowerCurve(n: number, dir: 'in' | 'out', peak = 1): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    c[i] = peak * (dir === 'in' ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2));
  }
  return c;
}

/** Nhóm của id âm (`lab/pour` → `lab`). */
export const groupOf = (id: string) => id.split('/')[0];
