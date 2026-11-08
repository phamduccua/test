import './interact.css';

export interface Tooltip {
  /** Hiện `text` cạnh điểm (px, theo khung canvas). */
  show(text: string, x: number, y: number): void;
  hide(): void;
  readonly element: HTMLElement;
}

/** Nhãn nhỏ đi theo con trỏ ("Kéo để …") trong `overlay` (tự xoá cùng overlay khi huỷ sim). */
export function createTooltip(overlay: HTMLElement): Tooltip {
  const el = document.createElement('div');
  el.className = 'ix-tip';
  overlay.appendChild(el);
  return {
    element: el,
    show(text, x, y) {
      if (el.textContent !== text) el.textContent = text;
      // Kẹp trong khung: lật sang trái khi sát mép phải, lên trên khi sát đáy (không bị cắt).
      const w = overlay.clientWidth, h = overlay.clientHeight;
      const tw = el.offsetWidth || 200, th = el.offsetHeight || 24;
      const left = x + 14 + tw > w - 6 ? Math.max(6, x - 14 - tw) : x + 14;
      const top = y + 16 + th > h - 6 ? Math.max(6, y - 12 - th) : y + 16;
      el.style.transform = `translate(${left}px, ${top}px)`;
      el.classList.add('on');
    },
    hide() {
      el.classList.remove('on');
    },
  };
}

/**
 * Thông báo nhanh (sai thao tác / hoàn thành bước) ngay cạnh chỗ vừa thao tác (`anchor()` = điểm con trỏ cuối, px khung);
 * không có (demo) → giữa khung, 30 % chiều cao. Tự tắt.
 */
export function createToast(overlay: HTMLElement, anchor: () => { x: number; y: number } | null) {
  const el = document.createElement('div');
  el.className = 'ix-toast';
  overlay.appendChild(el);
  let timer = 0;
  const api = {
    show(text: string, tone: 'error' | 'ok' | 'info' = 'error', ms = 2600) {
      el.textContent = text;
      el.className = `ix-toast ${tone === 'error' ? '' : tone}`;
      const w = overlay.clientWidth, h = overlay.clientHeight;
      const a = anchor() ?? { x: w / 2, y: h * 0.3 + 60 };
      const half = Math.min(260, w * 0.4);
      el.style.left = `${Math.min(w - half - 8, Math.max(half + 8, a.x))}px`;
      // Con trỏ ở nửa trên → hiện bên dưới (tránh toolbar/HUD), còn lại → bên trên.
      const top = a.y < h * 0.45 ? a.y + 40 : Math.max(8, a.y - 80);
      el.style.top = `${Math.min(top, Math.max(8, h - (el.offsetHeight || 40) - 8))}px`;
      void el.offsetWidth;
      el.classList.add('on');
      clearTimeout(timer);
      timer = window.setTimeout(() => el.classList.remove('on'), ms);
    },
    hide() {
      clearTimeout(timer);
      el.classList.remove('on');
    },
    dispose() {
      clearTimeout(timer);
    },
  };
  return api;
}
export type Toast = ReturnType<typeof createToast>;
