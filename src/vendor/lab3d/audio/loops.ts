/** Âm liên tục điều khiển được (createLoop) và nền nhiều lớp (createAmbient) trên một nút đích. */
import { createCrossLoop, type CrossLoop } from './crossLoop';
import { levelToGain } from './model';
import { loadSound, soundEntry } from './loader';
import { createPanner, placePanner } from './spatial';
import type { Ambient, AmbientLayer, LoopOptions, SoundAt, SoundLoop } from './types';

/** Phần SimAudio mà loop cần: đích, đăng kí nguồn định vị, gỡ khi dừng. */
export interface LoopHost {
  ctx: BaseAudioContext;
  bus: AudioNode;
  refDistance(): number;
  track(at: SoundAt, p: PannerNode): () => void;
  own(stop: (fade: number) => void): () => void;
}

/** Im (mức ≈ 0) quá lâu → dừng giải mã, bật lại khi mức > 0. */
const IDLE_STOP_S = 1.5;

export function createLoopOn(host: LoopHost, id: string, o: LoopOptions = {}, ambient = false): SoundLoop {
  const { ctx } = host;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  let out: AudioNode = gain;
  let untrack = () => {};
  if (o.at) {
    const p = createPanner(ctx, o.refDistance ?? host.refDistance());
    placePanner(p, o.at, ctx, true);
    gain.connect(p);
    out = p;
    untrack = host.track(o.at, p);
  }
  out.connect(host.bus);
  const smooth = o.smooth ?? 0.25;
  let level = o.level ?? 1;
  let rate = o.rate ?? 1;
  let base = o.volume ?? 1;
  let loop: CrossLoop | null = null;
  let stopped = false;
  let idleTimer = 0;
  const unown = host.own((fade) => api.stop(fade));

  const apply = () => {
    if (stopped) return;
    gain.gain.setTargetAtTime(base * levelToGain(level), ctx.currentTime, smooth / 3);
    window.clearTimeout(idleTimer);
    if (level <= 0.001) idleTimer = window.setTimeout(() => loop?.halt(), IDLE_STOP_S * 1000);
    else if (loop && !loop.playing) loop.start();
  };

  void (async () => {
    const [buf, e] = await Promise.all([loadSound(id), soundEntry(id)]);
    if (!buf || stopped) return;
    base *= e?.gain ?? 0.6;
    loop = createCrossLoop(ctx, buf, gain, ambient);
    loop.setRate(rate);
    if (level > 0.001) loop.start();
    apply();
  })();

  const api: SoundLoop = {
    get level() {
      return level;
    },
    set(v) {
      level = Math.max(0, Math.min(1.5, v));
      apply();
    },
    setRate(r) {
      rate = r;
      loop?.setRate(r);
    },
    stop(fade = 0.4) {
      if (stopped) return;
      stopped = true;
      unown();
      window.clearTimeout(idleTimer);
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fade / 4));
      window.setTimeout(() => {
        loop?.halt();
        untrack();
        out.disconnect();
        gain.disconnect();
      }, fade * 1000 + 60);
    },
  };
  return api;
}

export function createAmbientOn(host: LoopHost, layers: AmbientLayer[], fadeIn = 1.5): Ambient {
  const map = new Map<string, SoundLoop>();
  // Mỗi lớp mở dần (hằng thời gian fadeIn/3) rồi bám theo tham số với cùng độ mượt.
  for (const l of layers) map.set(l.key ?? l.id, createLoopOn(host, l.id, { level: l.level ?? 1, volume: l.volume, smooth: fadeIn }, true));
  return {
    set: (key, v) => map.get(key)?.set(v),
    level: (key) => map.get(key)?.level ?? 0,
    stop(fade = 1) {
      for (const lp of map.values()) lp.stop(fade);
      map.clear();
    },
  };
}
