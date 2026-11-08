import { pointerHub, procLift, type InteractCtx } from '../../interact/index';
import './scopeDock.css';

export interface ScopeDockOptions {
  /** Lớp riêng của sim (kịch bản kiểm thử tìm theo lớp này). */
  cls: string;
  /** Góc neo, mặc định 'bottom-left'; luôn đứng ngay trên bảng bước + dải đáy. */
  corner?: 'bottom-left' | 'bottom-right';
  /** Hướng xếp các vòng / thanh, mặc định 'column'. */
  direction?: 'row' | 'column';
  /** Hiện khi nào (đọc mỗi frame), vd. đang nhìn qua thị kính và có tiêu bản trên bàn kính. */
  visible(): boolean;
}

export interface ScopeDock {
  el: HTMLElement;
  /** Thêm vòng / thanh (`createScrub({ place: 'inline' })` hoặc phần tử bất kì) vào hộp, theo thứ tự. */
  add(...items: (HTMLElement | { element: HTMLElement })[]): void;
  /** Hàng ngang trong hộp dọc (vd. hai vòng cạnh nhau, thanh thời gian bên dưới). */
  row(...items: (HTMLElement | { element: HTMLElement })[]): HTMLElement;
}

const node = (x: HTMLElement | { element: HTMLElement }) => (x instanceof HTMLElement ? x : x.element);

/**
 * Bảng kính hiển vi (vòng ốc to / ốc nhỏ / mâm vật kính, thanh thời gian…) ở góc dưới khung, ngay trên bảng bước của kit/lab3d/interact:
 * một hộp xếp các `ix-scrub` theo dòng chảy (không `position: static !important`), đứng yên khi đang vặn (bảng bước đổi cao không
 * làm vòng dời dưới con trỏ). Dùng bởi `createScopeControls` và các sim có bảng kính hiển vi riêng.
 */
export function createScopeDock(ctx: InteractCtx, o: ScopeDockOptions): ScopeDock {
  const el = document.createElement('div');
  el.className = `ix-dock ix-dock--${o.direction ?? 'column'} ${o.cls}`;
  ctx.overlay.appendChild(el);
  ctx.track(() => el.remove());
  const right = o.corner === 'bottom-right';
  ctx.track(
    pointerHub(ctx).onFrame(() => {
      const show = o.visible();
      el.style.display = show ? 'flex' : 'none';
      if (!show || el.querySelector('.ix-scrub.drag')) return;
      const ins = ctx.viewInsets();
      el.style.left = right ? '' : `${ins.left + 16}px`;
      el.style.right = right ? `${ins.right + 16}px` : '';
      el.style.bottom = `${ins.bottom + 12 + procLift(ctx.overlay)}px`;
    }),
  );
  return {
    el,
    add: (...items) => el.append(...items.map(node)),
    row(...items) {
      const r = document.createElement('div');
      r.className = 'ix-dock__row';
      r.append(...items.map(node));
      el.appendChild(r);
      return r;
    },
  };
}
