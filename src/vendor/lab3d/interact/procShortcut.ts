import { pointerHub } from './pointer';
import type { Procedure } from './procedure';
import type { InteractCtx } from './types';

/**
 * Phím tắt lil-gui cho quy trình (nút cũ "1) …", "2) …" của sim): bước hiện tại thuộc `ids` → chạy `auto` của bước (CÙNG action
 * với thao tác tay, như demo), xong thì `complete` rồi làm tiếp các bước sau còn trong `ids`; không thì toast `why`
 * (chưa tới lượt / đã làm). Trả hàm gắn vào nút. Hẹn giờ giữa các bước tự huỷ khi đổi sim.
 */
export function procShortcut(ctx: InteractCtx, proc: Procedure, ids: string[], why: string | (() => string), gap = 0.5): () => void {
  const hub = pointerHub(ctx);
  let timer = 0;
  ctx.track(() => window.clearTimeout(timer));
  const run = () => {
    const s = proc.current;
    if (!s || !s.auto || !ids.includes(s.id) || proc.demoing) return hub.toast.show(typeof why === 'function' ? why() : why, 'info');
    s.auto(() => {
      proc.complete(s.id);
      const n = proc.current;
      if (n && ids.includes(n.id)) timer = window.setTimeout(run, gap * 1000);
    });
  };
  return run;
}
