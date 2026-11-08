/**
 * Loop / nền "hẹn trước": sim tạo lúc mở (chưa có cử chỉ người dùng → chưa được tạo AudioContext), giữ mức/tốc độ đã đặt,
 * dựng thật khi được phép (`bind`). Dừng trước khi dựng → không dựng nữa.
 */
import type { Ambient, AmbientLayer, SoundLoop } from './types';

export interface Deferred {
  /** Dựng âm thật (gọi một lần khi được phép phát). */
  bind(): void;
}

export function deferredLoop(make: (level: number, rate: number) => SoundLoop, level0: number, rate0: number, done: (d: Deferred) => void) {
  let level = level0;
  let rate = rate0;
  let real: SoundLoop | null = null;
  let stopped = false;
  const d: SoundLoop & Deferred = {
    bind() {
      if (!stopped && !real) real = make(level, rate);
    },
    get level() {
      return real?.level ?? level;
    },
    set(v) {
      level = Math.max(0, Math.min(1.5, v));
      real?.set(v);
    },
    setRate(r) {
      rate = r;
      real?.setRate(r);
    },
    stop(fade) {
      if (stopped) return;
      stopped = true;
      real?.stop(fade);
      done(d);
    },
  };
  return d;
}

export function deferredAmbient(make: (layers: AmbientLayer[]) => Ambient, layers: AmbientLayer[], done: (d: Deferred) => void) {
  const lv = new Map(layers.map((l) => [l.key ?? l.id, l.level ?? 1]));
  let real: Ambient | null = null;
  let stopped = false;
  const d: Ambient & Deferred = {
    bind() {
      if (!stopped && !real) real = make(layers.map((l) => ({ ...l, level: lv.get(l.key ?? l.id) ?? 0 })));
    },
    set(key, v) {
      if (lv.has(key)) lv.set(key, v);
      real?.set(key, v);
    },
    level: (key) => (real ? real.level(key) : (lv.get(key) ?? 0)),
    stop(fade) {
      if (stopped) return;
      stopped = true;
      real?.stop(fade);
      done(d);
    },
  };
  return d;
}
