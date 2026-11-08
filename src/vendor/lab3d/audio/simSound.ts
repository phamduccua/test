/**
 * `createSimSound` – lớp âm chung cho mọi sim lab3d (Hoá + Sinh + Địa) trên `ctx.audio`. Lõi: `soundCore.ts` (dùng chung với
 * `useLabSound` của lab R3F); kiểu: `simSoundTypes.ts`; probe DEV: `simSoundProbe.ts`.
 */
import { pointerHub } from '../interact/index';
import type { SimContext } from '../sim/types';
import { soundOnInteract } from './interact';
import { createSoundCore } from './soundCore';
import type { SimSound, SimSoundOptions } from './simSoundTypes';

export function createSimSound(ctx: SimContext, o: SimSoundOptions = {}): SimSound {
  const hub = pointerHub(ctx);
  const s = createSoundCore({ audio: ctx.audio, track: (f) => ctx.track(f), onFrame: (cb) => hub.onFrame(cb) }, o);
  if (o.interact) ctx.track(soundOnInteract(hub, { ...o.interact, audio: ctx.audio }));
  return s;
}
