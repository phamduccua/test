import type { InteractCtx } from './types';
import './pickQuiz.css';

/**
 * Khung hỏi nhanh cạnh chỗ bấm (vd. "Tế bào này đang ở kì nào?" của TN-103-01 / TN-109-01): một hàng nút lựa chọn, chọn xong thì báo
 * Đúng / Chưa đúng + lời giải của sim, tự ẩn sau vài giây. Câu hỏi, nhãn lựa chọn và lời giải do sim đưa (chữ của môn).
 */
export interface PickQuizOptions<K extends string | number> {
  /** Tiêu đề khung (câu hỏi). */
  question: string;
  options: readonly { key: K; label: string }[];
  /** Bề rộng (px), mặc định 260. */
  width?: number;
  /** Lớp thêm cho khung (kịch bản / CSS riêng của sim). Nút luôn là `button.ui-btn[data-k]`. */
  className?: string;
  /** Tự ẩn sau khi hiện lời giải (ms), mặc định 4500. */
  hideAfter?: number;
  /** Đầu lời giải (HTML) khi chọn đúng, vd. `<b class="ok">Đúng!</b> ` – chữ do sim đưa (kit không chứa chữ môn). */
  right: string;
  /** Đầu lời giải (HTML) khi chọn sai, nhận nhãn đã chọn (chữ thường), vd. (l) => `<b class="warn">Chưa đúng</b> (em chọn ${l}). `. */
  wrong(label: string): string;
}

export interface PickQuizAsk<K> {
  truth: K;
  /** Lời giải (HTML) – hiện sau phần Đúng / Chưa đúng. */
  explain(truth: K): string;
  /** false → không hỏi, hiện ngay lời giải và báo `answered(truth)`. Mặc định true. */
  quiz?: boolean;
  answered?(guess: K): void;
}

export interface PickQuiz<K> {
  el: HTMLElement;
  readonly open: boolean;
  /** Hỏi cạnh điểm (x, y) – px trong ctx.overlay. */
  ask(x: number, y: number, a: PickQuizAsk<K>): void;
  hide(): void;
}

export function createPickQuiz<K extends string | number>(ctx: InteractCtx, o: PickQuizOptions<K>): PickQuiz<K> {
  const el = document.createElement('div');
  el.className = `ix-quiz ui-panel${o.className ? ` ${o.className}` : ''}`;
  el.style.width = `${o.width ?? 260}px`;
  ctx.overlay.appendChild(el);
  let hideT: ReturnType<typeof setTimeout> | undefined;
  let open = false;
  let at = { x: 0, y: 0 };
  /** Giữ khung trong khung nhìn theo cỡ thật (lời giải dài hơn câu hỏi). */
  const place = () => {
    const { width, height } = ctx.viewInsets();
    el.style.left = `${Math.max(8, Math.min(width - el.offsetWidth - 8, at.x + 14))}px`;
    el.style.top = `${Math.max(8, Math.min(height - el.offsetHeight - 8, at.y - 30))}px`;
  };
  const label = (k: K) => o.options.find((x) => x.key === k)?.label ?? String(k);
  const reveal = (a: PickQuizAsk<K>, guess: K | null) => {
    const head = guess === null ? '' : guess === a.truth ? o.right : o.wrong(label(guess).toLowerCase());
    el.innerHTML = head + a.explain(a.truth);
    place();
    clearTimeout(hideT);
    hideT = setTimeout(api.hide, o.hideAfter ?? 4500);
  };
  const api: PickQuiz<K> = {
    el,
    get open() {
      return open;
    },
    ask(x, y, a) {
      clearTimeout(hideT);
      at = { x, y };
      el.style.display = 'block';
      open = true;
      if (a.quiz === false) {
        a.answered?.(a.truth);
        return reveal(a, null);
      }
      el.innerHTML = `<div class="ui-panel__title">${o.question}</div>`;
      for (const opt of o.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ui-btn';
        b.dataset.k = String(opt.key);
        b.textContent = opt.label;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          a.answered?.(opt.key);
          reveal(a, opt.key);
        });
        el.appendChild(b);
      }
      place();
    },
    hide() {
      clearTimeout(hideT);
      el.style.display = 'none';
      open = false;
    },
  };
  ctx.track(() => (clearTimeout(hideT), el.remove()));
  return api;
}
