import type * as THREE from 'three';
import { pointerHub } from './pointer';
import { createPoseTween, type PoseTween } from './poseTween';
import type { InteractCtx, Pose } from './types';

export interface Tweens {
  /** Hoạt cảnh tư thế cho `obj` (hệ cha) – chạy thời gian thực theo vòng frame của hub; gọi lại khi đang chạy = đổi lộ trình. */
  play(obj: THREE.Object3D, poses: Pose[], durations: number[] | number, onDone?: () => void): void;
  /** Gọi `fn` sau `sec` giây (thời gian thực, huỷ khi `cancel()` / đổi sim). */
  after(sec: number, fn: () => void): void;
  /** Dừng mọi hoạt cảnh + hẹn giờ (không gọi onDone). */
  cancel(): void;
  /** Còn hoạt cảnh/hẹn giờ đang chạy (cũng báo hub bận → `__ix.idle()` chờ). */
  readonly busy: boolean;
}

/**
 * Nhiều hoạt cảnh cầm–đặt phụ cùng lúc (sợi rau rơi vào bát, nắp máy đóng, ống tự vào giá…) cho thao tác tay: mỗi vật một
 * `createPoseTween`, chung một `hub.onFrame` (chạy cả khi sim tạm dừng như cử chỉ của kit), đăng kí `hub.busy`.
 */
export function createTweens(ctx: InteractCtx): Tweens {
  const hub = pointerHub(ctx);
  const map = new Map<THREE.Object3D, PoseTween>();
  let timers: { t: number; fn: () => void }[] = [];
  ctx.track(
    hub.onFrame((dt) => {
      map.forEach((tw) => tw.update(dt));
      if (!timers.length) return;
      const due = timers.filter((x) => (x.t -= dt) <= 0);
      timers = timers.filter((x) => x.t > 0);
      due.forEach((x) => x.fn());
    }),
  );
  const api: Tweens = {
    play(obj, poses, durations, onDone) {
      let tw = map.get(obj);
      if (!tw) map.set(obj, (tw = createPoseTween(obj)));
      tw.play(poses, durations, onDone);
    },
    after(sec, fn) {
      timers.push({ t: sec, fn });
    },
    cancel() {
      map.forEach((tw) => tw.cancel());
      timers = [];
    },
    get busy() {
      return timers.length > 0 || [...map.values()].some((tw) => tw.active);
    },
  };
  ctx.track(hub.busy(() => api.busy));
  return api;
}
