/**
 * Lõi âm chung (không phụ thuộc kiểu sim): nền + loop quá trình đặt tên + sfx giới hạn tần suất + tạm dừng + probe DEV.
 * `createSimSound` (sim lab3d, `ctx`) và `useLabSound` (lab R3F, React) chỉ khác chỗ lấy khung hình và chỗ dọn.
 */
import { useSim } from '../sim/simStore';
import { exposeSimSoundProbe, type ProbeSource } from './simSoundProbe';
import type { SimAudio } from './simAudio';
import type { SimSound, SimSoundOptions } from './simSoundTypes';
import type { LoopOptions, SoundLoop } from './types';

/** Nơi chạy lõi âm: SimAudio của phiên, chỗ đăng kí hàm dọn, nhịp khung hình. */
export interface SoundHost {
  audio: SimAudio;
  /** Đăng kí hàm dọn (chạy khi huỷ sim / gỡ lab). */
  track(dispose: () => void): unknown;
  /** Gọi `cb(dt)` mỗi khung (dt giây); trả hàm gỡ. */
  onFrame(cb: (dt: number) => void): () => void;
}

interface Slot {
  lp: SoundLoop;
  want: number;
  pulse: number;
  tau: number;
  applied: number;
  peak: number;
}

const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export function createSoundCore(host: SoundHost, o: SimSoundOptions = {}): SimSound {
  const a = host.audio;
  if (o.spatialScale) a.setSpatialScale(o.spatialScale);
  const layers = o.ambient ?? [];
  const pausedK = o.pausedAmbient ?? 0.5;
  const pauseMs = o.pauseMs ?? 250;
  const sfxDef = o.sfx ?? {};
  const follow = o.followPlayback !== false;
  const amb = layers.length ? a.ambient(layers.map((l) => ({ ...l, level: 0 })), o.ambientFade) : null;
  const ambWant = new Map(layers.map((l) => [l.key ?? l.id, l.level ?? 1]));
  const ambApplied = new Map<string, number>();
  const slots = new Map<string, Slot>();
  const last = new Map<string, number>();
  let playing = follow ? useSim.getState().playing : true;
  let ticked = false;
  let lastTick = performance.now();
  let paused = !playing;
  let wasPaused = paused;
  if (o.preload?.length) void a.preload(o.preload);

  const target = (s: Slot) => (paused ? 0 : Math.min(1, Math.max(s.want, s.pulse)) * api.scale);
  const push = (s: Slot, force = false) => {
    const v = target(s);
    const nv = v < 0.005 ? 0 : v;
    if (!force && Math.abs(nv - s.applied) < 0.005 && (nv > 0 || s.applied === 0)) return;
    s.applied = nv;
    if (nv > s.peak) s.peak = nv;
    s.lp.set(nv);
  };
  const pushAmb = (k: string) => {
    const v = (ambWant.get(k) ?? 0) * (paused ? pausedK : 1);
    if (ambApplied.get(k) === v) return;
    ambApplied.set(k, v);
    amb?.set(k, v);
  };
  const applyAll = () => {
    for (const s of slots.values()) push(s);
    for (const k of ambWant.keys()) pushAmb(k);
  };
  const detect = () => {
    const p = !playing || (ticked && performance.now() - lastTick > pauseMs);
    if (p === paused) return;
    paused = p;
    if (p) wasPaused = true;
    applyAll();
  };
  const addLoop = (key: string, id: string, lo: LoopOptions = {}) => {
    slots.get(key)?.lp.stop(0.2);
    slots.set(key, { lp: a.loop(id, { ...lo, level: 0 }), want: lo.level ?? 0, pulse: 0, tau: 0.3, applied: 0, peak: 0 });
    push(slots.get(key)!, true);
  };

  if (follow)
    host.track(
      useSim.subscribe((st) => {
        if (st.playing === playing) return;
        playing = st.playing;
        detect();
      }),
    );
  host.track(
    host.onFrame((dt) => {
      detect();
      for (const s of slots.values()) {
        if (s.pulse > 0) s.pulse = s.pulse < 1e-3 ? 0 : s.pulse * Math.exp(-dt / Math.max(0.02, s.tau));
        push(s);
      }
    }),
  );

  const api: SimSound = {
    audio: a,
    scale: 1,
    get paused() {
      return paused;
    },
    get live() {
      return a.live;
    },
    loop: addLoop,
    set(key, level) {
      const s = slots.get(key);
      if (!s) return;
      s.want = clamp(level);
      push(s);
    },
    setRate: (key, r) => slots.get(key)?.lp.setRate(r),
    pulse(key, peak = 1, tau = 0.3) {
      const s = slots.get(key);
      if (!s) return;
      s.pulse = Math.max(s.pulse, peak);
      s.tau = tau;
      push(s);
    },
    want: (key) => slots.get(key)?.want ?? 0,
    setAmbient(key, level) {
      ambWant.set(key, clamp(level));
      pushAmb(key);
    },
    sfx(id, so = {}) {
      if (paused && !sfxDef.whilePaused) return false;
      const now = performance.now() / 1000;
      const key = so.key ?? id;
      const gap = so.minGap ?? sfxDef.minGap ?? 0;
      if (gap && now - (last.get(key) ?? -1e9) < gap) return false;
      last.set(key, now);
      a.sfx(id, { pitchJitter: sfxDef.pitchJitter, ...so });
      return true;
    },
    tick() {
      lastTick = performance.now();
      ticked = true;
      detect();
      const resumed = !wasPaused;
      wasPaused = paused;
      return resumed;
    },
    expose(levels) {
      src.extra = levels;
    },
  };
  for (const [k, d] of Object.entries(o.loops ?? {})) addLoop(k, d.id, d);
  applyAll();

  const src: ProbeSource = {
    sim: o.id ?? null,
    audio: a,
    paused: () => paused,
    ambient: () => Object.fromEntries([...ambWant.keys()].map((k) => [k, ambApplied.get(k) ?? 0])),
    loops: () => Object.fromEntries([...slots].map(([k, s]) => [k, { want: s.want, level: s.applied, peak: s.peak }])),
    resetPeaks: () => slots.forEach((s) => (s.peak = s.applied)),
    extra: null,
  };
  exposeSimSoundProbe(host, src);
  return api;
}
