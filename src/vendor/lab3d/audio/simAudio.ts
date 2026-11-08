/**
 * Âm thanh của MỘT phiên mô phỏng (`ctx.audio`): bus riêng → master; listener bám camera của sim; mọi loop/nền do sim
 * tạo tự tắt dần khi huỷ sim. Chưa được phép phát (trang chưa có cử chỉ) → không tạo AudioContext: loop/nền "hẹn trước"
 * (giữ mức, dựng ở cử chỉ đầu), sfx bỏ qua, preload hoãn. DEV: nhật kí mọi sfx đã phát (cả âm UI của soundOnInteract).
 */
import type * as THREE from 'three';
import { createAcoustics, type Acoustics, type AcousticsChain } from './acoustics';
import { audioCore, audioRunning, onAudioAllowed } from './context';
import { deferredAmbient, deferredLoop, type Deferred } from './deferred';
import { preloadSounds } from './loader';
import { clearVoiced, markVoiced } from './presence';
import { createAmbientOn, createLoopOn, type LoopHost } from './loops';
import { playSfxOn } from './playSfx';
import { syncListener, placePanner } from './spatial';
import type { Ambient, AmbientLayer, LoopOptions, SfxOptions, SoundAt, SoundLoop } from './types';

/** Một lần phát sfx (nhật kí dev). `t` = performance.now() ms. */
export interface PlayedSound {
  id: string;
  t: number;
}

export interface SimAudio {
  /** Phát âm sự kiện (bỏ qua nếu âm chưa mở khoá / đang tắt tiếng). */
  sfx(id: string, opts?: SfxOptions): void;
  /** Âm liên tục điều khiển mức/tốc độ (gọi được trước cử chỉ đầu – dựng thật khi được phép). */
  loop(id: string, opts?: LoopOptions): SoundLoop;
  /** Nền nhiều lớp (mỗi lớp loop crossfade), `fadeIn` s (gọi được trước cử chỉ đầu). */
  ambient(layers: AmbientLayer[], fadeIn?: number): Ambient;
  preload(ids: string[]): Promise<void>;
  /** Khoảng cách tham chiếu mặc định của âm định vị (đơn vị cảnh) (bàn lab 4–7, địa cầu ≈ 2). */
  setSpatialScale(refDistance: number): void;
  /** Hậu xử lý âm của sim (vang theo không gian, lọc tông, nén nhẹ) – `acoustics.ts`; null = nối thẳng master. */
  setAcoustics(a: Acoustics | null): void;
  /** Đã dựng âm (được phép phát, bus đã tạo). */
  readonly live: boolean;
  /** Tắt dần mọi âm của sim (gọi tự động khi huỷ sim). */
  dispose(fade?: number): void;
  /** Cho dev hook / kiểm thử: loop đang sống, loop/nền chờ cử chỉ, nguồn định vị, gain bus. */
  stats(): { loops: number; pending: number; spatial: number; bus: number | null };
  /** DEV: nhật kí sfx đã phát (≤ 500 mục gần nhất) + số lần theo id (từ lần xoá cuối). */
  history(): { log: readonly PlayedSound[]; counts: Readonly<Record<string, number>> };
  clearHistory(): void;
}

let current: SimAudio | null = null;
/** SimAudio của sim đang mở (playSfx toàn cục dùng camera + bus của nó). */
export const currentSimAudio = () => current;

export function createSimAudio(camera: THREE.Camera): SimAudio {
  let host: (LoopHost & { busGain: GainNode }) | null = null;
  let ref = 1;
  let disposed = false;
  let raf = 0;
  const spatial = new Map<PannerNode, SoundAt>();
  const owned = new Set<(fade: number) => void>();
  const pending = new Set<Deferred>();
  let cancelWait: (() => void) | null = null;
  const log: PlayedSound[] = [];
  let counts: Record<string, number> = {};

  const frame = () => {
    raf = 0;
    if (!host || disposed) return;
    syncListener(host.ctx, camera);
    for (const [p, at] of spatial) placePanner(p, at, host.ctx);
    if (spatial.size) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  };

  const ensure = () => {
    if (host || disposed) return host;
    const core = audioCore();
    if (!core) return null;
    const busGain = core.ctx.createGain();
    if (room) {
      chain = createAcoustics(core.ctx, core.master, room);
      busGain.connect(chain.input);
    } else busGain.connect(core.master);
    host = {
      ctx: core.ctx,
      bus: busGain,
      busGain,
      refDistance: () => ref,
      track(at, p) {
        spatial.set(p, at);
        kick();
        return () => void spatial.delete(p);
      },
      own(stop) {
        owned.add(stop);
        return () => void owned.delete(stop);
      },
    };
    // Được phép mà không qua sự kiện cử chỉ đang nghe (vd. kích hoạt từ công cụ tự động) → dựng luôn phần đang chờ.
    for (const p of [...pending]) p.bind();
    pending.clear();
    return host;
  };

  /** Hoãn tới khi được phép: dựng mọi loop/nền đang chờ ở cử chỉ đầu. */
  const defer = <T extends Deferred>(d: T): T => {
    pending.add(d);
    cancelWait ??= onAudioAllowed(() => {
      cancelWait = null;
      if (!disposed) ensure();
    });
    return d;
  };
  const undefer = (d: Deferred) => void pending.delete(d);

  let room: Acoustics | null = null;
  let chain: AcousticsChain | null = null;
  const api: SimAudio = {
    sfx(id, o = {}) {
      markVoiced(api);
      const h = ensure();
      if (!h || !audioRunning()) return;
      if (import.meta.env.DEV) {
        if (log.push({ id, t: Math.round(performance.now()) }) > 500) log.shift();
        counts[id] = (counts[id] ?? 0) + 1;
      }
      playSfxOn(h, camera, id, o, () => !disposed, (p) => spatial.delete(p));
    },
    loop(id, o = {}) {
      markVoiced(api);
      const h = ensure();
      if (h) {
        if (o.at) syncListener(h.ctx, camera);
        return createLoopOn(h, id, o);
      }
      if (disposed) return deferredLoop(() => silent, 0, 1, undefer);
      const make = (level: number, rate: number) => {
        if (o.at) syncListener(host!.ctx, camera);
        return createLoopOn(host!, id, { ...o, level, rate });
      };
      return defer(deferredLoop(make, o.level ?? 1, o.rate ?? 1, undefer));
    },
    ambient(layers, fadeIn) {
      markVoiced(api);
      const h = ensure();
      if (h) return createAmbientOn(h, layers, fadeIn);
      return defer(deferredAmbient((ls) => createAmbientOn(host!, ls, fadeIn), layers, undefer));
    },
    preload(ids) {
      markVoiced(api);
      if (ensure()) return preloadSounds(ids);
      return new Promise((done) => defer({ bind: () => void preloadSounds(ids).then(done) }));
    },
    setSpatialScale(r) {
      ref = Math.max(1e-3, r);
    },
    setAcoustics(a) {
      room = a;
      const core = audioCore();
      if (!host || !core) return;
      if (a && chain) return chain.set(a);
      host.busGain.disconnect();
      chain?.dispose();
      chain = a ? createAcoustics(core.ctx, core.master, a) : null;
      host.busGain.connect(chain ? chain.input : core.master);
    },
    get live() {
      return !!host && !disposed;
    },
    dispose(fade = 0.5) {
      if (disposed) return;
      for (const stop of [...owned]) stop(fade);
      owned.clear();
      pending.clear();
      cancelWait?.();
      disposed = true;
      clearVoiced(api);
      if (raf) cancelAnimationFrame(raf);
      if (current === api) current = null;
      const h = host;
      if (!h) return;
      h.busGain.gain.setTargetAtTime(0, h.ctx.currentTime, fade / 4);
      const c = chain;
      window.setTimeout(() => (h.busGain.disconnect(), c?.dispose()), fade * 1000 + 120);
      spatial.clear();
    },
    stats: () => ({ loops: owned.size, pending: pending.size, spatial: spatial.size, bus: host ? host.busGain.gain.value : null }),
    history: () => ({ log, counts }),
    clearHistory() {
      log.length = 0;
      counts = {};
    },
  };
  current = api;
  return api;
}

const silent: SoundLoop = { set() {}, setRate() {}, stop() {}, level: 0 };
