import './interact.css';
import { clamp, invLerp, lerp, snapStep } from './math';
import { pointerHub } from './pointer';
import type { Binding, InteractCtx } from './types';

export interface ScrubOptions {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: Binding<number>;
  format?(v: number): string;
  /** 'bar' thanh kéo ngang | 'dial' vòng quay (giờ trong ngày, ngày trong năm, mùa…). */
  kind?: 'bar' | 'dial';
  /** Vòng: quay quá max quay lại min. */
  wrap?: boolean;
  /**
   * Vị trí: 'bottom' (giữa, trên caption) | 'bottom-left' | 'bottom-right' | 'top' | 'inline' (không tự đặt chỗ – nằm trong hộp của sim /
   * kit, vd. `createScopeDock`, xếp theo dòng chảy; không cần luật `position: static !important`).
   */
  place?: 'bottom' | 'bottom-left' | 'bottom-right' | 'top' | 'inline';
  /** Rộng (px) của thanh, mặc định 320. */
  width?: number;
  enabled?(): boolean;
  onChange?(v: number, final: boolean): void;
}

export interface Scrub {
  element: HTMLElement;
  setVisible(v: boolean): void;
  /** Demo: kéo mượt tới `v` trong `s` giây (cùng đường set/commit như tay). */
  animateTo(v: number, s?: number, onDone?: () => void): void;
}

/**
 * Thanh tua / vòng quay thời gian bằng HTML (chuột + cảm ứng, không xoay camera) trong ctx.overlay, đồng bộ hai chiều với
 * tham số (đọc `value.get()` mỗi frame). Kéo = `set`, nhả = `commit`.
 */
export function createScrub(ctx: InteractCtx, o: ScrubOptions): Scrub {
  const hub = pointerHub(ctx);
  const kind = o.kind ?? 'bar';
  const el = document.createElement('div');
  el.className = `ix-scrub ${kind}${o.place === 'inline' ? ' ix-scrub--inline' : ''}`;
  el.innerHTML = `<span class="lbl"></span><div class="track"><div class="fill"></div><div class="thumb"></div></div><span class="val"></span>`;
  (el.querySelector('.lbl') as HTMLElement).textContent = o.label;
  const track = el.querySelector('.track') as HTMLElement;
  const fill = el.querySelector('.fill') as HTMLElement;
  const thumb = el.querySelector('.thumb') as HTMLElement;
  const val = el.querySelector('.val') as HTMLElement;
  if (kind === 'bar') track.style.width = `${o.width ?? 320}px`;
  ctx.overlay.appendChild(el);
  const fmt = o.format ?? ((v: number) => v.toFixed(1).replace('.', ','));
  let shown = NaN;
  let drag = -1;
  let lastAngle = 0;
  let acc = 0;
  const show = (v: number) => {
    shown = v;
    const k = clamp(invLerp(o.min, o.max, v), 0, 1);
    if (kind === 'bar') {
      thumb.style.left = `${k * 100}%`;
      fill.style.width = `${k * 100}%`;
    } else thumb.style.transform = `rotate(${k * 360}deg)`;
    val.textContent = fmt(v);
  };
  const norm = (v: number) => {
    const r = o.max - o.min;
    return o.wrap ? o.min + ((((v - o.min) % r) + r) % r) : clamp(v, o.min, o.max);
  };
  const emit = (v: number, final: boolean) => {
    const q = norm(snapStep(v, o.step, o.min));
    if (final && o.value.commit) o.value.commit(q);
    else o.value.set(q);
    show(q);
    o.onChange?.(q, final);
    return q;
  };
  const fromEvent = (e: PointerEvent) => {
    const r = track.getBoundingClientRect();
    if (kind === 'bar') return lerp(o.min, o.max, clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1));
    const a = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2)));
    let d = a - lastAngle;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    lastAngle = a;
    acc += (d / (2 * Math.PI)) * (o.max - o.min);
    return o.wrap ? acc : clamp(acc, o.min, o.max);
  };
  track.addEventListener('pointerdown', (e) => {
    if (o.enabled && !o.enabled()) return;
    drag = e.pointerId;
    track.setPointerCapture(e.pointerId);
    el.classList.add('drag');
    if (kind === 'dial') {
      const r = track.getBoundingClientRect();
      lastAngle = Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2)));
      acc = o.value.get();
    } else emit(fromEvent(e), false);
  });
  track.addEventListener('pointermove', (e) => {
    if (e.pointerId === drag) emit(fromEvent(e), false);
  });
  const up = (e: PointerEvent) => {
    if (e.pointerId !== drag) return;
    drag = -1;
    el.classList.remove('drag');
    emit(kind === 'bar' ? fromEvent(e) : o.value.get(), true);
  };
  track.addEventListener('pointerup', up);
  track.addEventListener('pointercancel', up);
  const layout = () => {
    const p = o.place ?? 'bottom';
    if (p === 'inline') return;
    const ins = ctx.viewInsets();
    // Xếp trên bảng bước quy trình (nếu có) – cùng cột giữa đáy.
    const proc = p === 'bottom' ? ctx.overlay.querySelector<HTMLElement>('.ix-proc') : null;
    const lift = proc && proc.offsetParent ? proc.offsetHeight + 8 : 0;
    el.style.top = p === 'top' ? `${ins.top + 52}px` : '';
    el.style.bottom = p === 'top' ? '' : `${ins.bottom + 12 + lift}px`;
    el.style.left = p === 'bottom-right' ? '' : p === 'bottom-left' ? `${(ins.leftColumn?.width ?? ins.left) + 12}px` : '50%';
    el.style.right = p === 'bottom-right' ? `${ins.right + 12}px` : '';
    el.style.transform = p === 'bottom' || p === 'top' ? 'translateX(-50%)' : '';
  };
  let tick = 0;
  let anim: { a: number; b: number; t: number; s: number; done?: () => void } | null = null;
  ctx.track(
    hub.onFrame((dt) => {
      if (anim) {
        const a = anim;
        a.t = Math.min(1, a.t + dt / a.s);
        emit(lerp(a.a, a.b, a.t * a.t * (3 - 2 * a.t)), a.t >= 1);
        if (a.t >= 1) {
          anim = null;
          a.done?.();
        }
      } else if (drag < 0 && o.value.get() !== shown) show(o.value.get());
      el.classList.toggle('off', !!o.enabled && !o.enabled());
      if (++tick % 15 === 1) layout();
    }),
  );
  ctx.track(hub.busy(() => !!anim));
  layout();
  show(o.value.get());
  return {
    element: el,
    setVisible: (v) => void (el.style.display = v ? '' : 'none'),
    animateTo(v, s = 1.5, onDone) {
      anim = { a: o.value.get(), b: v, t: 0, s, done: onDone };
    },
  };
}
