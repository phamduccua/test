import './interact.css';
import '../ui/tokens.css';
import '../ui/chip.css';
import { isOpen, onOpenChange, setOpen } from '../ui/collapse';
import { iconSvg, type IconName } from '../ui/icons';
import type { SimContext } from '../sim/types';
import { labText } from '../text';

const button = (cls: string, title: string, icon: IconName, text = '') => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `ui-btn ${cls}`;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.innerHTML = iconSvg(icon, 16);
  if (text) b.append(Object.assign(document.createElement('span'), { textContent: text }));
  return b;
};

/**
 * Thanh bước gọn (một dòng) ở giữa đáy khung: "Bước 2/4 · tên bước" + ⓘ (giải thích = caption, ẩn mặc định) + Tự động / ↶ / ↺.
 * Lớp CSS cho Playwright: .ix-proc-demo/-undo/-restart (+ .ix-proc-info). Thanh tua (scrub) tự xếp lên trên bảng này.
 */
export function createProcedurePanel(
  ctx: Pick<SimContext, 'overlay' | 'viewInsets' | 'track'>,
  h: { demo(): void; undo(): void; restart(): void; left?(): number | null },
) {
  const el = document.createElement('div');
  el.className = 'ix-proc';
  const n = Object.assign(document.createElement('b'), { className: 'ix-proc-n' });
  const title = Object.assign(document.createElement('span'), { className: 't ix-proc-title' });
  const info = button('ix-proc-info', labText('t_f6d8782887a8'), 'info');
  const demo = button('ix-proc-demo', labText('t_8ce34922b7d0'), 'forward', labText('t_31dcad619d5d'));
  const undo = button('ix-proc-undo', labText('t_7e7d88afa386'), 'undo');
  const restart = button('ix-proc-restart', labText('t_4649c38ed370'), 'reset');
  const sep = Object.assign(document.createElement('i'), { className: 'ix-proc-sep' });
  el.append(n, title, info, sep, demo, undo, restart);
  demo.onclick = h.demo;
  undo.onclick = h.undo;
  restart.onclick = h.restart;
  // ⓘ mở/thu gọn phần giải thích (caption) – cùng trạng thái 'caption' với nút ⌃ của caption, nhớ trong phiên.
  const syncInfo = () => {
    if (!el.isConnected && el.dataset.mounted) return offInfo();
    info.classList.toggle('is-on', isOpen('caption'));
    info.setAttribute('aria-expanded', String(isOpen('caption')));
    // Caption vừa hiện/ẩn (React vẽ lại ở frame sau) → đặt lại chỗ ngay, không chờ nhịp định kì của procedure.
    if (el.dataset.mounted) window.setTimeout(() => requestAnimationFrame(place), 0);
  };
  info.onclick = () => setOpen('caption', !isOpen('caption'));
  const offInfo = onOpenChange('caption', syncInfo);
  ctx.track(offInfo);
  syncInfo();
  ctx.overlay.appendChild(el);
  el.dataset.mounted = '1';
  function place() {
    const ins = ctx.viewInsets();
    el.style.bottom = `${(ins.bottom || 8) + 8}px`;
    const fit = h.left ? { x: h.left(), room: 0 } : avoidPanels(ctx.overlay, el, ins);
    el.style.left = fit.x == null ? '' : `${fit.x}px`;
    // Bảng bên trái/phải chiếm chỗ → thanh bước co vào phần trống (tên bước cắt bớt), tối thiểu 300 px.
    el.style.maxWidth = fit.room ? `${Math.max(300, fit.room)}px` : '';
  }
  place();
  return {
    element: el,
    /** Đặt lại theo caption (gọi định kì – caption đổi chiều cao). */
    place,
    render(i: number, total: number, name: string, demoing: boolean, canUndo: boolean) {
      // Chế độ giao diện Cổ Phong đổi nhãn "Bước x/y" thành "Thẻ x/y" (thẻ tre); âm chuông xong bước do giao diện nghe sự kiện tiến độ.
      const isAncient = document.documentElement.dataset.theme === 'dai-viet';
      const done = i >= total;
      n.innerHTML = done ? iconSvg('check', 16) : '';
      if (isAncient) {
        n.append(done ? labText('t_519159b46105') : `${labText('t_9300ab8c4f54')}${i + 1}/${total}`);
      } else {
        n.append(done ? labText('t_c20f44926612') : `${labText('t_15ee30ad0abe')}${i + 1}/${total}`);
      }
      el.classList.toggle('is-done', done);
      title.textContent = name;
      title.title = name;
      demo.innerHTML = iconSvg(demoing ? 'stop' : 'forward', 16);
      demo.append(Object.assign(document.createElement('span'), { textContent: demoing ? labText('t_7832a7002fbf') : labText('t_31dcad619d5d') }));
      demo.classList.toggle('on', demoing);
      undo.disabled = !canUndo || demoing;
    },
  };
}

/**
 * Tâm ngang (px overlay) + bề rộng còn trống cho bảng bước khi KHÔNG có `panelLeft`: né các bảng HTML của sim (con trực tiếp của overlay, nhận chuột,
 * hẹp hơn 55 % khung) nằm cùng dải cao với bảng bước – bảng ở nửa trái đẩy sang phải, nửa phải đẩy sang trái; giữ trong khung.
 * Không có bảng nào chạm → x null (giữa khung như cũ). Khung hẹp ~1016 px: bảng bước không đè đáy bảng trái/phải.
 */
function avoidPanels(overlay: HTMLElement, el: HTMLElement, ins: { left: number; right: number }): { x: number | null; room: number } {
  const none = { x: null, room: 0 };
  const o = overlay.getBoundingClientRect();
  const p = el.getBoundingClientRect();
  if (!o.width || !p.height) return none;
  let lo = ins.left, hi = o.width - ins.right;
  const L0 = lo, H0 = hi;
  for (const k of overlay.children) {
    if (k === el || !(k instanceof HTMLElement) || /(^|\s)ix-/.test(k.className)) continue;
    const r = k.getBoundingClientRect();
    if (!r.width || !r.height || r.width > o.width * 0.55 || r.bottom <= p.top + 2 || r.top >= p.bottom - 2) continue;
    if (getComputedStyle(k).pointerEvents === 'none') continue;
    if ((r.left + r.right) / 2 - o.left < o.width / 2) lo = Math.max(lo, r.right - o.left + 8);
    else hi = Math.min(hi, r.left - o.left - 8);
  }
  if (lo === L0 && hi === H0) return none;
  const room = Math.max(0, hi - lo - 8);
  const half = Math.min(p.width, Math.max(300, room)) / 2;
  return { x: Math.min(Math.max((lo + hi) / 2, L0 + half + 4), H0 - half - 4), room };
}

const STEP_NO = new RegExp(`^\\s*${labText('t_15ee30ad0abe').trim()}\\s*\\d+[a-z]?(?:\\s*\\([^)]*\\))?\\s*[·:.\\-–]\\s*`, 'i');

/**
 * Bỏ tiền tố "Bước N · " / "Bước 3a · " / "Bước 2 (tiếp) – " ở đầu lời thuyết minh: khi có thanh bước, số bước thật nằm trên thanh – số tự ghi trong caption
 * (thường theo kịch bản thuyết minh cũ) dễ lệch, vd. thanh "Bước 1/6" mà caption "Bước 3 · …".
 */
export function stripStepNo(text: string): string {
  return text.replace(STEP_NO, '');
}

/**
 * Phần cần nâng (px) để một bảng HTML của sim nằm NGAY TRÊN bảng bước quy trình (`.ix-proc`, giữa đáy): chiều cao bảng + `gap`,
 * 0 khi không có/đang ẩn. Dùng: `el.style.bottom = `${ctx.viewInsets().bottom + 10 + procLift(ctx.overlay)}px``.
 */
export function procLift(overlay: HTMLElement, gap = 8): number {
  const el = overlay.querySelector<HTMLElement>('.ix-proc');
  return el && el.offsetParent ? el.offsetHeight + gap : 0;
}
