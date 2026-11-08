import type { Tracker } from '../../lab/types';

export interface Beeper {
  enabled: boolean;
  /** 'bad' = bíp trầm hai nhịp (vi phạm), 'good' = tiếng "ting" nhẹ, 'drop' = tích ngắn. */
  play(kind: 'bad' | 'good' | 'drop'): void;
}

/** Âm báo nhỏ bằng WebAudio (tạo lười ở lần phát đầu – sau thao tác người dùng), tự đóng khi huỷ mô phỏng. */
export function createBeeper(ctx: Tracker, enabled = true): Beeper {
  let ac: AudioContext | null = null;
  ctx.track(() => void ac?.close());
  const tone = (f: number, t0: number, dur: number, type: OscillatorType, vol: number) => {
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = f;
    const t = ac.currentTime + t0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  const b: Beeper = {
    enabled,
    play(kind) {
      if (!b.enabled) return;
      try {
        ac ??= new AudioContext();
        if (kind === 'bad') {
          tone(220, 0, 0.12, 'square', 0.05);
          tone(180, 0.15, 0.16, 'square', 0.05);
        } else if (kind === 'good') {
          tone(880, 0, 0.18, 'sine', 0.06);
          tone(1320, 0.06, 0.22, 'sine', 0.04);
        } else tone(640, 0, 0.06, 'triangle', 0.04);
      } catch {
        b.enabled = false;
      }
    },
  };
  return b;
}
