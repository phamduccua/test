/** Hàm tiện dụng theo đặc tả kit (định tuyến qua SimAudio của sim đang mở). */
import { currentSimAudio, type SimAudio } from './simAudio';
import type { Ambient, AmbientLayer, LoopOptions, SfxOptions, SoundLoop } from './types';

const noLoop: SoundLoop = { set() {}, setRate() {}, stop() {}, level: 0 };

/** Phát âm sự kiện ở sim đang mở (`at` → định vị 3D theo camera của sim). */
export function playSfx(id: string, opts?: SfxOptions): void {
  currentSimAudio()?.sfx(id, opts);
}

/** Âm liên tục điều khiển được ở sim đang mở (tự tắt dần khi huỷ sim). */
export function createLoop(id: string, opts?: LoopOptions): SoundLoop {
  return currentSimAudio()?.loop(id, opts) ?? noLoop;
}

/** Nền nhiều lớp cho sim: `createAmbient(ctx, [{ id: 'geo/rain-heavy', level: 0 }, …])`. */
export function createAmbient(ctx: { audio?: SimAudio }, layers: AmbientLayer[], fadeIn?: number): Ambient {
  const a = ctx.audio ?? currentSimAudio();
  return a ? a.ambient(layers, fadeIn) : { set() {}, level: () => 0, stop() {} };
}
