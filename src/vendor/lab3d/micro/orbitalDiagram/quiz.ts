import type { SimContext } from '../../sim/types';
import './diagram.css';
import { labText } from '../../text';

export interface QuizItem {
  question: string;
  options: string[];
  correct: number;
  /** Giải thích hiện sau khi trả lời. */
  explain?: string;
  /** Đáp án ngắn → xếp nút thành một hàng. */
  row?: boolean;
}

export interface QuizCard {
  el: HTMLElement;
  show(index: number): void;
  setVisible(v: boolean): void;
  /** Chiều cao hiện tại (px) – để chừa chỗ khi đặt camera. */
  height(): number;
  readonly index: number;
}

/**
 * Thẻ câu hỏi trắc nghiệm (HTML trong ctx.overlay, góc dưới trái): bấm đáp án → tô đúng/sai + giải thích,
 * "Câu tiếp" chuyển câu. `onAnswer` để mô phỏng minh hoạ đáp án. Bấm tiêu đề để thu gọn.
 */
export function createQuizCard(
  ctx: Pick<SimContext, 'overlay' | 'viewInsets' | 'track'>,
  items: QuizItem[],
  o: { title?: string; onAnswer?(index: number, choice: number, ok: boolean): void; style?: Partial<CSSStyleDeclaration> } = {},
): QuizCard {
  const el = document.createElement('div');
  el.className = 'od-card';
  Object.assign(el.style, o.style ?? {});
  const head = document.createElement('div');
  head.className = 'od-card__head';
  const body = document.createElement('div');
  body.className = 'od-card__body';
  el.append(head, body);
  ctx.overlay.appendChild(el);
  head.onclick = () => el.classList.toggle('is-collapsed');
  // Luôn nằm trên dòng thuyết minh (caption đổi chiều cao theo nội dung).
  const lift = () => {
    if (!o.style?.bottom) el.style.bottom = `${Math.max(14, ctx.viewInsets().bottom) + 10}px`;
  };
  const timer = window.setInterval(lift, 400);
  ctx.track(() => window.clearInterval(timer));
  lift();
  let index = 0;

  const show = (i: number) => {
    index = (i + items.length) % items.length;
    const it = items[index];
    head.innerHTML = `<span>${o.title ?? labText('t_0b18f8ea8ed1')}${items.length > 1 ? ` · ${index + 1}/${items.length}` : ''}</span><span>▾</span>`;
    body.innerHTML = '';
    const q = document.createElement('p');
    q.className = 'od-card__q';
    q.textContent = it.question;
    const opts = document.createElement('div');
    opts.className = `od-card__opts${it.row ? ' od-card__opts--row' : ''}`;
    const ex = document.createElement('p');
    ex.className = 'od-card__explain';
    ex.hidden = true;
    it.options.forEach((label, k) => {
      const b = document.createElement('button');
      b.className = 'od-btn';
      b.textContent = label;
      b.onclick = () => {
        const ok = k === it.correct;
        opts.querySelectorAll('.od-btn').forEach((x, j) => x.classList.toggle('is-right', j === it.correct && ok));
        b.classList.toggle('is-wrong', !ok);
        ex.hidden = false;
        ex.textContent = ok ? `${labText('t_7509c5af3207')}${it.explain ?? ''}` : labText('t_b1b20b9471df');
        o.onAnswer?.(index, k, ok);
      };
      opts.appendChild(b);
    });
    body.append(q, opts, ex);
    if (items.length > 1) {
      const nav = document.createElement('div');
      nav.className = 'od-card__nav';
      const prev = document.createElement('button');
      prev.className = 'od-btn';
      prev.textContent = labText('t_c4a35de9a251');
      prev.onclick = () => show(index - 1);
      const next = document.createElement('button');
      next.className = 'od-btn';
      next.textContent = labText('t_c6a5e2b9113d');
      next.onclick = () => show(index + 1);
      nav.append(prev, next);
      body.appendChild(nav);
    }
  };
  show(0);
  return {
    el,
    show,
    setVisible(v) {
      el.hidden = !v;
    },
    height: () => (el.hidden ? 0 : el.getBoundingClientRect().height),
    get index() {
      return index;
    },
  };
}
