/**
 * CHỈ DEV: `window.__snd` – một probe âm cho mọi sim dùng `createSimSound`.
 * `log` = id mọi sfx ĐÃ PHÁT của phiên âm (cả âm UI của soundOnInteract: ui/wrong, ui/step-done, ui/procedure-done…).
 */
import type { SimAudio } from './simAudio';

export interface ProbeSource {
  sim: string | null;
  audio: SimAudio;
  paused(): boolean;
  ambient(): Record<string, number>;
  loops(): Record<string, { want: number; level: number; peak: number }>;
  resetPeaks(): void;
  /** Số liệu riêng của sim (`SimSound.expose`). */
  extra: (() => Record<string, unknown>) | null;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const map = <T, U>(o: Record<string, T>, f: (v: T) => U) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));

/** `ctx` = nơi đăng kí hàm dọn (`SimContext` của sim lab3d hoặc host của `useLabSound`). */
export function exposeSimSoundProbe(ctx: { track(dispose: () => void): unknown }, s: ProbeSource): void {
  if (!import.meta.env.DEV) return;
  const a = s.audio;
  const loopLevels = () => map(s.loops(), (l) => r3(l.level));
  const ambient = () => map(s.ambient(), r3);
  const probe = {
    sim: s.sim,
    /** Đã dựng âm (sau cử chỉ đầu). */
    live: () => a.live,
    paused: () => s.paused(),
    /** Mức đang áp của từng lớp nền. */
    ambient,
    /** Mức đang áp của từng loop quá trình. */
    loopLevels,
    /** `{ key: { want, level, peak } }` của loop quá trình. */
    loops: () => map(s.loops(), (l) => ({ want: r3(l.want), level: r3(l.level), peak: r3(l.peak) })),
    /** Nền + loop + số liệu riêng của sim (`expose`). */
    levels: () => ({ ...ambient(), ...loopLevels(), ...(s.extra?.() ?? {}) }),
    /** Mức lớn nhất mỗi loop (từ lần xoá trước); `clear` = đọc rồi đặt lại về mức hiện tại. */
    peaks(clear = false) {
      const r = map(s.loops(), (l) => r3(l.peak));
      if (clear) s.resetPeaks();
      return r;
    },
    resetPeaks: () => s.resetPeaks(),
    get log() {
      return a.history().log.map((e) => e.id);
    },
    times: () => a.history().log.map((e) => ({ ...e })),
    /** Số lần đã phát `id` (từ lần `clear` trước). */
    played: (id: string) => a.history().counts[id] ?? 0,
    counts: () => ({ ...a.history().counts }),
    clear: () => a.clearHistory(),
    stats: () => a.stats(),
    /** Ảnh chụp gộp (kịch bản kiểu bàn thí nghiệm). */
    state: () => ({
      sim: s.sim,
      ready: a.live,
      playing: !s.paused(),
      ambient: ambient(),
      loops: probe.loops(),
      sfx: probe.log,
      /** `[{ id, t }]`, t = giây (performance.now). */
      log: a.history().log.map((e) => ({ id: e.id, t: e.t / 1000 })),
    }),
  };
  const w = window as unknown as { __snd?: unknown };
  w.__snd = probe;
  ctx.track(() => {
    if (w.__snd === probe) delete w.__snd;
  });
}
