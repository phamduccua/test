import type { SimContext } from '../../sim/types';
import { isOpen, setOpen } from '../../ui/collapse';
import { iconSvg } from '../../ui/icons';
import '../../ui/tokens.css';
import { joinExclusive } from './exclusive';
import './resultCard.css';

/**
 * Thẻ nổi dùng chung cho bảng kết quả / báo cáo / đồ thị HTML của sim (thay cho thẻ đặt cứng `left:12px; bottom:58px`).
 * Tự đặt chỗ: trên dòng thuyết minh, dưới khối HUD + cảnh báo (đo đáy phần tử con thấp nhất của cột trái – `viewInsets().leftColumn`),
 * không lấn bảng tham số; giới hạn cao/rộng theo khoảng trống thật.
 * Mặc định THU GỌN thành chip có tên (kết quả không cần thao tác – mở khi cần); bấm tiêu đề để mở/thu gọn, nhớ trong phiên.
 * Bảng xám đậm theo token (.ui-dark – nội dung sim viết cho nền tối), chip thu gọn sáng như mọi chip.
 */
export interface ResultCardOptions {
  title: string;
  /** Bề rộng mong muốn (px), bị co lại khi khung hẹp. Mặc định 372. */
  width?: number;
  /** Góc neo. Mặc định 'bottom-left'. */
  corner?: 'bottom-left' | 'bottom-right' | 'top-right';
  /**
   * true / false / 'auto' (thu gọn khi khung < 1000 px). Mặc định true (thu gọn – thẻ chỉ để đọc); chỉ để false cho thẻ học sinh
   * đang thao tác ở bước hiện tại. Người dùng mở/đóng → nhớ trong phiên.
   */
  collapsed?: boolean | 'auto';
  /** Trần chiều cao khi mở: ≤ 1 = phần chiều cao khung (vd. 0,33 – thẻ không lên quá mặt bàn), > 1 = px. Mặc định: hết khoảng trống. */
  maxHeight?: number;
  /** Đặt đáy thẻ ngay trên bảng bước + thanh tua của kit/lab3d/interact (giữa đáy) khi chúng đang hiện. Mặc định false. */
  aboveSteps?: boolean;
  /** Bề rộng tối thiểu (px) khi khung hẹp. Mặc định 220; thẻ hẹp (dải ảnh) đặt nhỏ hơn. */
  minWidth?: number;
  /** Dời thẻ khỏi góc neo thêm (px, đọc mỗi lần đặt chỗ; trên phải → xuống, góc dưới → lên), trần cao trừ tương ứng. */
  offset?(): number;
  /** Thẻ / bảng khác cần tránh (vd. thẻ góc dưới bên kia): chồng nhau theo chiều ngang thì nâng thẻ này lên trên đỉnh nó. */
  avoid?(): readonly (HTMLElement | null | undefined)[];
  /** Tên nhóm "chỉ mở một": khung < 1000 px thì mở thẻ này thu gọn các thẻ khác cùng nhóm (không ghi vào phiên). */
  exclusive?: string;
}

export interface ResultCard {
  el: HTMLElement;
  /** Vùng nội dung – sim tự ghi innerHTML / appendChild. */
  body: HTMLElement;
  readonly collapsed: boolean;
  setCollapsed(on: boolean): void;
  setTitle(text: string): void;
  /** Ẩn hẳn (vd. ở chế độ vi mô, hoặc khi người dùng tắt "Bảng kết quả"). */
  setVisible(on: boolean): void;
  /** Đặt lại vị trí ngay (tự chạy định kì; gọi khi vừa đổi nội dung lớn). */
  layout(): void;
}

export function createResultCard(ctx: SimContext, o: ResultCardOptions): ResultCard {
  const el = document.createElement('div');
  el.className = 'rcard ui-dark';
  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'rcard__head';
  const arrow = document.createElement('span');
  arrow.className = 'rcard__icon';
  const title = document.createElement('span');
  title.className = 'rcard__title';
  title.textContent = o.title;
  head.append(arrow, title);
  const body = document.createElement('div');
  body.className = 'rcard__body';
  el.append(head, body);
  ctx.overlay.appendChild(el);
  const want = o.width ?? 372;
  const corner = o.corner ?? 'bottom-left';
  const key = `card:${o.title}`;
  const initial = o.collapsed === 'auto' ? ctx.viewInsets().width < 1000 : (o.collapsed ?? true);
  let collapsed = !isOpen(key, !initial);
  let visible = true;
  const group = o.exclusive
    ? joinExclusive(ctx.overlay, o.exclusive, { open: () => visible && !collapsed, fold: () => ((collapsed = true), apply()) })
    : null;
  /** Đáy (px từ mép dưới) để nằm trên các phần tử `avoid` đang hiện và chồng theo chiều ngang; 0 khi không cần. */
  const avoidLift = (frame: DOMRect, topInset: number) => {
    let lift = 0;
    const a = el.getBoundingClientRect();
    for (const x of o.avoid?.() ?? []) {
      if (!x?.offsetParent || x === el || getComputedStyle(x).visibility === 'hidden') continue;
      const b = x.getBoundingClientRect();
      if (a.left >= b.right + 6 || a.right <= b.left - 6) continue;
      const up = frame.bottom - b.top + 8;
      if (up + a.height <= frame.height - topInset - 8) lift = Math.max(lift, up);
    }
    return lift;
  };

  /** Chỉ ghi style khi đổi – sim/bọc ngoài nghe MutationObserver trên style không bị gọi dồn mỗi lượt. */
  const put = (k: 'width' | 'left' | 'right' | 'top' | 'bottom' | 'maxHeight', v: string) => {
    if (el.style[k] !== v) el.style[k] = v;
  };
  /** Đáy (px từ mép dưới khung) của bảng bước / thanh tua đang hiện + khoảng hở; 0 khi không có. */
  const stepsLift = () => {
    const tops = [...ctx.overlay.querySelectorAll<HTMLElement>('.ix-proc, .ix-scrub')].filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect().top);
    return tops.length ? ctx.overlay.getBoundingClientRect().bottom - Math.min(...tops) + 8 : 0;
  };
  const layout = () => {
    if (!visible) return;
    const ins = ctx.viewInsets();
    // Đáy khối HUD + cảnh báo ở cột trái: phần tử con thấp nhất (khung .simhost__left giãn gần hết chiều cao – không dùng được).
    const hud = Math.max(ins.top, ins.leftColumn?.bottom ?? 0);
    const gap = 10;
    const shift = o.offset?.() ?? 0;
    const lift = o.avoid && corner !== 'top-right' ? avoidLift(ctx.overlay.getBoundingClientRect(), ins.top) : 0;
    const bottom = Math.max(16, ins.bottom + gap, o.aboveSteps ? stepsLift() : 0, lift) + (corner === 'top-right' ? 0 : shift);
    const right = ins.right + 16;
    const w = Math.max(o.minWidth ?? 220, Math.min(want, ins.width - right - 32));
    const cap = o.maxHeight === undefined ? Infinity : o.maxHeight <= 1 ? o.maxHeight * ins.height : o.maxHeight;
    put('width', collapsed ? '' : `${w}px`);
    if (corner === 'top-right') {
      put('left', '');
      put('bottom', '');
      put('right', `${right}px`);
      put('top', `${ins.top + gap + shift}px`);
    } else {
      put('top', '');
      put(corner === 'bottom-left' ? 'right' : 'left', '');
      put(corner === 'bottom-left' ? 'left' : 'right', corner === 'bottom-left' ? '16px' : `${right}px`);
      put('bottom', `${bottom}px`);
    }
    const topLimit = (corner === 'bottom-left' ? hud : ins.top) + (corner === 'top-right' ? shift : 0);
    put('maxHeight', `${Math.round(Math.max(80, Math.min(cap, ins.height - bottom - topLimit - gap)))}px`);
    group?.enforce(ins.width);
  };
  const apply = () => {
    arrow.innerHTML = iconSvg(collapsed ? 'chevronDown' : 'chevronUp', 16);
    el.classList.toggle('is-collapsed', collapsed);
    head.setAttribute('aria-expanded', String(!collapsed));
    layout();
  };
  head.onclick = () => {
    collapsed = !collapsed;
    setOpen(key, !collapsed);
    if (!collapsed) group?.opened();
    apply();
  };
  apply();
  // Dòng thuyết minh, HUD, bảng tham số đổi kích thước liên tục → đặt lại chỗ định kì (rẻ: vài getBoundingClientRect).
  const id = window.setInterval(layout, 400);
  ctx.track(() => (window.clearInterval(id), group?.leave()));

  return {
    el,
    body,
    get collapsed() {
      return collapsed;
    },
    setCollapsed(on) {
      if (collapsed && !on) group?.opened();
      collapsed = on;
      apply();
    },
    setTitle(text) {
      title.textContent = text;
    },
    setVisible(on) {
      visible = on;
      el.style.display = on ? '' : 'none';
      if (on) layout();
    },
    layout,
  };
}
