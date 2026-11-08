import type * as THREE from 'three';
import { smooth } from './math';
import { createFrameLoop, createRaycast } from './raycast';
import type { Tooltip } from './tooltip';
import type { PointerHit, PointerInfo, PointerTarget } from './types';
import { focusLabels } from '../engine/labelFocus';

/** Một khung nhận con trỏ của hub: khung chính (canvas + OrbitControls) hoặc khung phụ (ô lồng có camera riêng – `hub.addFrame`). */
export interface Frame {
  name: string;
  el: HTMLElement;
  /** Phần tử nhận sự kiện hợp lệ (canvas/ô). */
  accepts(e: PointerEvent): boolean;
  rc: ReturnType<typeof createRaycast>;
  /** Phần tử đo toạ độ cục bộ (khung chính = canvas). */
  box: HTMLElement;
}

export const mainFrame = (canvas: HTMLElement, el: HTMLElement, camera: THREE.Camera): Frame => ({
  name: '', el, box: canvas, accepts: (e) => e.target === canvas || e.target === el, rc: createRaycast(canvas, camera),
});

export const subFrame = (name: string, element: HTMLElement, camera: THREE.Camera): Frame => ({
  name, el: element, box: element, accepts: (e) => element.contains(e.target as Node), rc: createRaycast(element, camera, true),
});

/** Target của khung `f` trúng tia: chỉ vật đang bật; target `opaque` đang tắt che con cháu của nó. */
export function pickIn(f: Frame, targets: PointerTarget[], live: (t: PointerTarget) => boolean, ray: THREE.Ray): PointerHit | null {
  const mine = targets.filter((t) => (t.frame ?? '') === f.name);
  const on = mine.filter(live);
  const off = new Set(mine.filter((t) => t.opaque && !on.includes(t)).map((t) => t.object));
  return f.rc.pick(ray, on, off);
}

/** Toạ độ px của sự kiện trong khung. */
export function localXY(f: Frame, e: PointerEvent) {
  const r = f.box.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

/** Điểm px trong khung `f` → px trong khung chính `main` (khung phụ → cộng lệch ô). */
export function toMain(f: Frame, main: Frame, p: { x: number; y: number }) {
  if (f === main) return { x: p.x, y: p.y };
  const a = f.el.getBoundingClientRect(), b = main.box.getBoundingClientRect();
  return { x: p.x + a.left - b.left, y: p.y + a.top - b.top };
}

export interface FrameHandlers {
  down(e: PointerEvent): void;
  move(e: PointerEvent): void;
  finish(e: PointerEvent, cancelled: boolean): void;
  leave(): void;
}

/** Nghe pointer ở pha capture trên khung (đứng trước OrbitControls); trả hàm gỡ. */
export function listenFrame(f: Frame, h: FrameHandlers) {
  const opts = { capture: true };
  const map = {
    pointerdown: h.down,
    pointermove: h.move,
    pointerup: (e: PointerEvent) => h.finish(e, false),
    pointercancel: (e: PointerEvent) => h.finish(e, true),
  };
  for (const [k, fn] of Object.entries(map)) f.el.addEventListener(k, fn as EventListener, opts);
  f.el.addEventListener('pointerleave', h.leave);
  return () => {
    for (const [k, fn] of Object.entries(map)) f.el.removeEventListener(k, fn as EventListener, opts);
    f.el.removeEventListener('pointerleave', h.leave);
    f.el.style.cursor = '';
  };
}

/** Hoạt cảnh thời gian thực trên vòng frame của hub: `step(k)` (k làm mượt) trong `seconds` rồi `done()`; trả hàm huỷ. */
export function loopTween(
  loop: ReturnType<typeof createFrameLoop>,
  busy: (fn: () => boolean) => () => void,
  seconds: number,
  step: (k: number) => void,
  done?: () => void,
) {
  let t = 0;
  const off = loop.add((dt) => {
    t = Math.min(1, t + dt / Math.max(1e-3, seconds));
    step(smooth(t));
    if (t < 1) return;
    stop();
    done?.();
  });
  const unbusy = busy(() => true);
  const stop = () => (off(), unbusy());
  return stop;
}

/** Trạng thái rê của hub: vật đang rê + khung của nó; `set` đổi viền/con trỏ/tooltip, `claim` gán thẳng (đầu/cuối phiên kéo). */
export function createHoverState(main: Frame, tip: Tooltip) {
  let hovered: PointerTarget | null = null;
  let frame: Frame = main;
  const hintOf = (t: PointerTarget) => (typeof t.hint === 'function' ? t.hint() : t.hint) ?? null;
  return {
    get target() { return hovered; }, // prettier-ignore
    get frame() { return frame; }, // prettier-ignore
    claim(t: PointerTarget | null, f: Frame = frame) {
      hovered = t;
      frame = f;
      focusLabels('hover', t?.object ?? null);
    },
    set(t: PointerTarget | null, hit: PointerHit | null, p?: PointerInfo, f: Frame = main) {
      if (t !== hovered) {
        hovered?.onHover?.('off', null);
        if (frame !== f) frame.el.style.cursor = '';
        hovered = t;
        frame = f;
        t?.onHover?.('hover', hit);
        focusLabels('hover', t?.object ?? null);
      }
      const why = t?.blocked?.() || null;
      f.el.style.cursor = t ? (why ? 'not-allowed' : (t.cursor ?? (t.onDown ? 'grab' : 'pointer'))) : '';
      const text = t && p && p.pointerType !== 'touch' ? (why ?? hintOf(t)) : null;
      if (text && p) {
        const q = toMain(f, main, p);
        tip.show(text, q.x, q.y);
      } else tip.hide();
    },
  };
}
