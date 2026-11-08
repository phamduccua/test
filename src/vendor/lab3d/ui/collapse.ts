import './tokens.css';
import './chip.css';
import { iconSvg, type IconName } from './icons';

/**
 * Thu gọn dùng chung của lớp phủ mô phỏng: trạng thái mở/đóng theo `id`, nhớ trong PHIÊN (sessionStorage) khi người dùng bấm,
 * báo cho mọi nơi đang nghe (React `useCollapse`, chip DOM `collapsible`).
 * id của kit: 'gui' (bảng Tham số), 'hud' (số đo), 'caption' (giải thích bước), 'labels' (hiện mọi nhãn).
 * id của sim: '<MÃ>:<bảng>' (vd. 'TN-073-05:results') – mặc định THU GỌN, trừ bảng đang cần thao tác.
 */
const PREFIX = 'lab3d:open:';
const live = new Map<string, boolean>();
const subs = new Map<string, Set<() => void>>();

function stored(id: string): boolean | undefined {
  try {
    const v = sessionStorage.getItem(PREFIX + id);
    return v === null ? undefined : v === '1';
  } catch {
    return undefined;
  }
}

/** Đang mở? (trạng thái hiện tại → lựa chọn đã nhớ trong phiên → `fallback`). */
export function isOpen(id: string, fallback = false): boolean {
  return live.get(id) ?? stored(id) ?? fallback;
}

/** Mở/thu gọn; `remember` = nhớ cho các lần mở sim sau trong phiên (mặc định true – lựa chọn của người dùng). */
export function setOpen(id: string, open: boolean, remember = true): void {
  if (remember) {
    try {
      sessionStorage.setItem(PREFIX + id, open ? '1' : '0');
    } catch {
      /* chế độ riêng tư: chỉ nhớ trong trang */
    }
  }
  if (live.get(id) === open) return;
  live.set(id, open);
  for (const fn of [...(subs.get(id) ?? [])]) fn();
}

/** Nghe thay đổi của `id`; trả hàm gỡ. */
export function onOpenChange(id: string, fn: () => void): () => void {
  let set = subs.get(id);
  if (!set) subs.set(id, (set = new Set()));
  set.add(fn);
  return () => void set.delete(fn);
}

/** Bỏ trạng thái tạm (mở tự động, không nhớ) khi huỷ sim – sim sau bắt đầu theo lựa chọn đã nhớ. */
export function resetTransient(): void {
  for (const id of [...live.keys()]) {
    const s = stored(id);
    if (s === undefined) live.delete(id);
    else if (live.get(id) !== s) setOpen(id, s, false);
  }
}

export interface CollapsibleOptions {
  /** Khoá nhớ trong phiên ('<MÃ>:<bảng>'). */
  id: string;
  /** Nhãn chip khi thu gọn ("Kết quả", "Chú giải"…) – ngắn, 1–2 từ. */
  label: string;
  /** Icon chip (mặc định 'chevronDown'). */
  icon?: IconName;
  /** Mặc định mở? (false – bảng không cần thao tác thì thu gọn). */
  open?: boolean;
  /** Chữ phụ trên chip (vd. số chính) – gọi lại mỗi `refresh()`. */
  meta?: () => string;
  onToggle?(open: boolean): void;
}

export interface Collapsible {
  readonly open: boolean;
  readonly chip: HTMLButtonElement;
  /** Mở/thu gọn bằng mã (vd. tự mở khi xong bài: `set(true, false)` – không ghi đè lựa chọn của người dùng). */
  set(open: boolean, remember?: boolean): void;
  toggle(): void;
  /** Cập nhật chữ phụ trên chip. */
  refresh(): void;
  dispose(): void;
}

/**
 * Gắn thu gọn cho một bảng HTML của sim: thêm chip có nhãn ở đầu bảng; thu gọn → chỉ còn chip, mở → chip thành nút ⌃ ở góc phải trên.
 * Bảng giữ nguyên vị trí (neo của bảng là neo của chip). CSS: `.ui-collapsible.is-collapsed` (kit/lab3d/ui/chip.css).
 */
export function collapsible(panel: HTMLElement, o: CollapsibleOptions): Collapsible {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'ui-chip ui-collapse__chip';
  chip.innerHTML = `${iconSvg(o.icon ?? 'chevronDown', 16)}<span class="ui-chip__label"></span><span class="ui-chip__meta"></span>${iconSvg('chevronUp', 16)}`;
  const [label, meta] = [chip.querySelector('.ui-chip__label')!, chip.querySelector('.ui-chip__meta')!];
  label.textContent = o.label;
  chip.title = o.label;
  panel.classList.add('ui-collapsible');
  panel.prepend(chip);
  const get = () => isOpen(o.id, o.open ?? false);
  const apply = () => {
    const open = get();
    panel.classList.toggle('is-collapsed', !open);
    chip.setAttribute('aria-expanded', String(open));
    o.onToggle?.(open);
  };
  const api: Collapsible = {
    get open() {
      return get();
    },
    chip,
    set: (open, remember = true) => setOpen(o.id, open, remember),
    toggle: () => setOpen(o.id, !get()),
    refresh() {
      meta.textContent = o.meta?.() ?? '';
    },
    dispose() {
      off();
      chip.remove();
      panel.classList.remove('ui-collapsible', 'is-collapsed');
    },
  };
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    api.toggle();
  });
  const off = onOpenChange(o.id, apply);
  api.refresh();
  apply();
  return api;
}
