import type { PointerHub } from './pointer';

export interface HtmlTargetOptions {
  /** Bộ chọn CSS của đích HTML (ô trích dẫn, ô dữ liệu…) – phần tử dưới con trỏ khớp thì nhận thẻ. */
  selector: string;
  /** true = nhận; chuỗi = lí do sai (toast, thẻ bay về). Bỏ qua = luôn nhận. */
  accepts?(item: string, el: HTMLElement): true | string;
  onDrop(item: string, el: HTMLElement): void;
}

/** Đích HTML cho createCardDrop: dò phần tử dưới con trỏ, tô sáng (`ix-card-target`), chấm khi thả. */
export function createHtmlTarget(hub: PointerHub, o: HtmlTargetOptions | undefined) {
  let cur: HTMLElement | null = null;
  return {
    at: (cx: number, cy: number) => (o ? (document.elementFromPoint(cx, cy)?.closest<HTMLElement>(o.selector) ?? null) : null),
    set(el: HTMLElement | null) {
      if (el === cur) return;
      cur?.classList.remove('ix-card-target');
      cur = el;
      cur?.classList.add('ix-card-target');
    },
    /** Thả vào `el`: đúng → onDrop, sai → toast lí do. Trả true khi nhận. */
    drop(item: string, el: HTMLElement) {
      const v = o?.accepts ? o.accepts(item, el) : true;
      if (v !== true) hub.toast.show(v, 'error', 2600);
      else o?.onDrop(item, el);
      return v === true;
    },
  };
}

/** Sau khi kéo thẻ (pointer capture) trình duyệt vẫn bắn click vào thẻ – chặn đúng cú click đó để bấm chỉ là phím tắt khi KHÔNG kéo. */
export function swallowNextClick() {
  const kill = (ev: Event) => {
    ev.stopPropagation();
    ev.preventDefault();
  };
  window.addEventListener('click', kill, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', kill, { capture: true }), 0);
}

/** Bóng thẻ (bản sao, không bắt chuột) trong overlay. */
export function ghostOf(overlay: HTMLElement, el: HTMLElement) {
  const g = el.cloneNode(true) as HTMLElement;
  g.classList.add('ix-card-ghost');
  // giữ bề rộng thẻ gốc (bản sao định vị tuyệt đối sẽ giãn theo chữ khi bay ra giữa khung)
  if (el.offsetWidth) g.style.width = `${el.offsetWidth}px`;
  g.removeAttribute('id');
  overlay.appendChild(g);
  return g;
}
export function place(g: HTMLElement, x: number, y: number) {
  g.style.left = `${x}px`;
  g.style.top = `${y}px`;
}
/** Thả xong: đúng → mờ tại chỗ; sai → bay về `back` rồi mờ. */
export function fade(g: HTMLElement, ok: boolean, back?: { x: number; y: number }) {
  g.classList.add(ok ? 'ok' : 'back');
  if (back) place(g, back.x, back.y);
  window.setTimeout(() => g.remove(), ok ? 380 : 420);
}

/** Khung cuộn được gần nhất chứa `el` (bảng báo cáo dài…) – null nếu không có. */
function scroller(el: Element | null): HTMLElement | null {
  for (let e = el as HTMLElement | null; e && e !== document.body; e = e.parentElement) {
    const st = getComputedStyle(e);
    if (/(auto|scroll)/.test(st.overflowY) && e.scrollHeight > e.clientHeight + 1) return e;
  }
  return null;
}

/**
 * Tự cuộn khung chứa đích HTML khi đang kéo thẻ gần mép trên/dưới của nó (ô cần thả nằm ngoài phần đang thấy).
 * `at(cx, cy)` mỗi lần con trỏ di chuyển; `tick(dt)` mỗi frame; `stop()` khi nhả.
 */
export function createAutoScroll(edge = 40, speed = 520) {
  let box: HTMLElement | null = null;
  let v = 0;
  return {
    at(cx: number, cy: number) {
      box = scroller(document.elementFromPoint(cx, cy));
      if (!box) return void (v = 0);
      const r = box.getBoundingClientRect();
      if (cx < r.left || cx > r.right) return void (v = 0);
      v = cy < r.top + edge ? -(1 - (cy - r.top) / edge) : cy > r.bottom - edge ? 1 - (r.bottom - cy) / edge : 0;
    },
    tick(dt: number) {
      if (box && v) box.scrollTop += Math.max(-1, Math.min(1, v)) * speed * dt;
    },
    stop() {
      box = null;
      v = 0;
    },
  };
}
