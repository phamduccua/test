/**
 * Phát một bộ đệm lặp vô hạn bằng các bản chồng nhau crossfade công suất đều (độc lập codec: MP3 có đệm lặng ở hai đầu
 * vẫn liền). Lập lịch theo đồng hồ AudioContext, hẹn giờ 100 ms (lookahead ≥ 0.6 s – chịu được tab bị bóp hẹn giờ).
 */
import { equalPowerCurve, loopPlan, nextStartAt, type LoopPlan } from './model';

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  /** Thời điểm (đồng hồ ctx) bản này bắt đầu ở vị trí plan.head. */
  startAt: number;
}

export interface CrossLoop {
  setRate(rate: number): void;
  readonly playing: boolean;
  start(): void;
  /** Dừng ngay (gain ngoài đã tắt dần). */
  halt(): void;
}

const CURVE_N = 64;
const LOOKAHEAD = 0.6;

export function createCrossLoop(ctx: BaseAudioContext, buffer: AudioBuffer, out: AudioNode, ambient: boolean): CrossLoop {
  const plan: LoopPlan = loopPlan(buffer.duration, ambient);
  const fadeIn = equalPowerCurve(CURVE_N, 'in');
  const fadeOut = equalPowerCurve(CURVE_N, 'out');
  let rate = 1;
  let cur: Voice | null = null;
  let next: Voice | null = null;
  let timer = 0;

  const spawn = (at: number, first: boolean): Voice => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    src.connect(gain).connect(out);
    const xf = plan.xfade / rate;
    if (first) gain.gain.value = 1;
    else {
      gain.gain.value = 0;
      gain.gain.setValueCurveAtTime(fadeIn, at, xf);
    }
    src.start(at, plan.head);
    return { src, gain, startAt: at };
  };

  const retire = (v: Voice, at: number) => {
    const xf = plan.xfade / rate;
    try {
      v.gain.gain.setValueCurveAtTime(fadeOut, at, xf);
      v.src.stop(at + xf + 0.02);
    } catch {
      v.src.stop();
    }
    v.src.onended = () => v.gain.disconnect();
  };

  const tick = () => {
    if (!cur) return;
    const now = ctx.currentTime;
    if (next && now >= next.startAt) {
      cur = next;
      next = null;
    }
    if (next) return;
    const pos = plan.head + Math.max(0, now - cur.startAt) * rate;
    const at = nextStartAt(now, pos, plan, rate);
    if (at - now > LOOKAHEAD) return;
    next = spawn(at, false);
    retire(cur, at);
  };

  const kill = (v: Voice | null) => {
    if (!v) return;
    try {
      v.src.stop();
    } catch {
      /* chưa start */
    }
    v.gain.disconnect();
  };

  return {
    get playing() {
      return cur !== null;
    },
    start() {
      if (cur) return;
      cur = spawn(ctx.currentTime + 0.01, true);
      timer = window.setInterval(tick, 100);
    },
    halt() {
      window.clearInterval(timer);
      kill(cur);
      kill(next);
      cur = next = null;
    },
    setRate(r) {
      const nr = Math.max(0.25, Math.min(4, r));
      if (nr === rate) return;
      // Đổi gốc thời gian để vị trí bộ đệm tính đúng sau khi đổi tốc độ.
      const now = ctx.currentTime;
      if (cur && !next) {
        const pos = plan.head + Math.max(0, now - cur.startAt) * rate;
        cur.startAt = now - (pos - plan.head) / nr;
      }
      rate = nr;
      for (const v of [cur, next]) v?.src.playbackRate.setTargetAtTime(nr, now, 0.05);
    },
  };
}
