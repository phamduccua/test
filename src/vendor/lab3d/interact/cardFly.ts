import { easeInOut } from './math';
import type { PointerHub } from './pointerTypes';
import { ghostOf, place } from './cardTarget';

type XY = { x: number; y: number };

/**
 * Hoạt cảnh demo của `createCardDrop`: bóng thẻ bay theo cung từ thẻ tới `to()` (toạ độ overlay) trong 1,1 s rồi `land()`.
 * `fly` trả false khi không tìm thấy thẻ; `stop` huỷ hoạt cảnh đang chạy (gỡ bóng thẻ); `busy` cho `hub.busy`.
 */
export function createCardFly(hub: PointerHub, overlay: HTMLElement, find: (item: string) => HTMLElement | undefined, centerOf: (el: HTMLElement) => XY) {
  let anim: (() => void) | null = null;
  const stop = () => anim?.();
  const fly = (item: string, to: () => XY, land: (a: XY, ghost: HTMLElement) => void, near?: (on: boolean) => void) => {
    const el = find(item);
    if (!el) return false;
    const a = centerOf(el);
    const ghost = ghostOf(overlay, el);
    place(ghost, a.x, a.y);
    let t = 0;
    stop();
    const off = hub.onFrame((dt) => {
      t = Math.min(1, t + dt / 1.1);
      const b = to();
      const k = easeInOut(t);
      place(ghost, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - Math.sin(Math.PI * k) * 40);
      near?.(t > 0.7 && t < 1);
      if (t < 1) return;
      off();
      anim = null;
      land(a, ghost);
    });
    anim = () => {
      off();
      anim = null;
      near?.(false);
      ghost.remove();
    };
    return true;
  };
  return { fly, stop, busy: () => !!anim };
}
