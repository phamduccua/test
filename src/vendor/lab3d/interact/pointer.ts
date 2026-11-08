import { scopeRoot } from '../sim/scope';
import { movedBeyond } from './math';
import { createHoverState, listenFrame, localXY as local, loopTween, mainFrame, pickIn, subFrame, toMain, type Frame } from './pointerFrame';
import type { PointerHub } from './pointerTypes';
import { createFrameLoop } from './raycast';
import { createToast, createTooltip } from './tooltip';
import type { InteractCtx, PointerHit, PointerInfo, PointerSession, PointerTarget } from './types';

export type { PointerFrame, PointerHub } from './pointerTypes';

const hubs = new WeakMap<object, PointerHub>();

/**
 * Bộ điều phối con trỏ DÙNG CHUNG cho một sim (một hub / ctx): nghe pointer ở pha capture trên phần tử của OrbitControls,
 * raycast theo danh sách target (ưu tiên → gần), chỉ nhận khi đích là canvas (bấm trên HTML phủ, nhãn… bỏ qua).
 * Nhấn trúng target có onDown → bắt con trỏ, TẮT OrbitControls tới khi nhả; bấm chỗ trống → camera xoay như thường.
 * onDown trả `'block'` / lí do → vẫn giữ phiên (camera không xoay), con trỏ cấm, toast lí do.
 */
export function pointerHub(c: InteractCtx): PointerHub {
  const ctx = scopeRoot(c); // phạm vi con (`createScope`) dùng chung hub của sim gốc – một phiên con trỏ, một toast, một tooltip
  const cached = hubs.get(ctx);
  if (cached) return cached;
  const hub = createHub(ctx);
  hubs.set(ctx, hub);
  ctx.track(() => hubs.delete(ctx));
  return hub;
}

function createHub(ctx: InteractCtx): PointerHub {
  const canvas = ctx.renderer.domElement;
  const el = (ctx.controls.domElement as HTMLElement | null) ?? canvas;
  const main = mainFrame(canvas, el, ctx.camera);
  const targets: PointerTarget[] = [];
  const offLayers = new Set<string>();
  const busyFns = new Set<() => boolean>();
  const tip = createTooltip(ctx.overlay);
  const toast = createToast(ctx.overlay, () => (api.enabled && seen ? anchorAt() : null));
  const hov = createHoverState(main, tip);
  let session: { s: PointerSession; target: PointerTarget; id: number; f: Frame } | null = null;
  let tap: { target: PointerTarget; hit: PointerHit; id: number; f: Frame } | null = null;
  let downAt = { x: 0, y: 0 };
  let last = { x: 0, y: 0 };
  let lastFrame: Frame = main;
  let controlsWas = true;
  let seen = false; // đã có toạ độ con trỏ thật (toast hiện cạnh chỗ thao tác)
  let hoverEv: { e: PointerEvent; f: Frame } | null = null;

  const live = (t: PointerTarget) => !(t.layer && offLayers.has(t.layer)) && (t.enabled?.() ?? true);
  /** Toạ độ px trong khung chính của điểm cuối (khung phụ → cộng lệch ô). */
  const anchorAt = () => toMain(lastFrame, main, last);
  const info = (f: Frame, x: number, y: number, e: PointerEvent | null = null): PointerInfo => f.rc.info(x, y, last, downAt, e);
  const pick = (f: Frame, p: PointerInfo) => pickIn(f, targets, live, p.ray);
  const onDown = (f: Frame) => (e: PointerEvent) => {
    if (session) {
      e.stopImmediatePropagation(); // ngón thứ hai khi đang kéo: bỏ qua, không để camera chụm
      return;
    }
    if (!api.enabled || !f.accepts(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const { x, y } = local(f, e);
    downAt = { x, y };
    last = { x, y };
    lastFrame = f;
    seen = true;
    const p = info(f, x, y, e);
    const hit = pick(f, p);
    tap = null;
    if (!hit) return;
    const why = hit.target.blocked?.() || null;
    const r = why ?? hit.target.onDown?.(hit, p);
    if (r === false) return;
    if (!r) {
      if (hit.target.onTap) tap = { target: hit.target, hit, id: e.pointerId, f };
      return;
    }
    // Từ chối có giữ phiên: camera không xoay, vật đứng yên, lí do hiện cạnh chỗ nhấn.
    const s: PointerSession = typeof r === 'string' ? { cursor: 'not-allowed' } : r;
    if (typeof r === 'string' && r !== 'block') toast.show(r);
    e.stopImmediatePropagation();
    e.preventDefault();
    session = { s, target: hit.target, id: e.pointerId, f };
    controlsWas = ctx.controls.enabled;
    ctx.controls.enabled = false;
    ctx.overlay.classList.add('ix-drag');
    f.el.setPointerCapture?.(e.pointerId);
    f.el.style.cursor = s.cursor ?? 'grabbing';
    tip.hide();
    if (hov.target && hov.target !== hit.target) hov.target.onHover?.('off', null);
    hov.claim(hit.target, f);
    if (typeof r !== 'string') hit.target.onHover?.('drag', hit);
  };
  const onMove = (f: Frame) => (e: PointerEvent) => {
    if (session) {
      if (e.pointerId !== session.id || session.f !== f) return;
      e.stopImmediatePropagation();
      const { x, y } = local(f, e);
      session.s.move?.(info(f, x, y, e));
      last = { x, y };
      return;
    }
    if (e.buttons || !api.enabled) return;
    hoverEv = { e, f }; // raycast hover gộp một lần mỗi frame
  };
  const finish = (f: Frame, e: PointerEvent, cancelled: boolean) => {
    if (session && e.pointerId === session.id && session.f === f) {
      e.stopImmediatePropagation();
      const s = session;
      session = null;
      ctx.controls.enabled = controlsWas;
      ctx.overlay.classList.remove('ix-drag');
      if (f.el.hasPointerCapture?.(e.pointerId)) f.el.releasePointerCapture(e.pointerId);
      const { x, y } = local(f, e);
      s.s.end?.(info(f, x, y, e), cancelled);
      s.target.onHover?.('off', null);
      hov.claim(null);
      f.el.style.cursor = '';
      if (e.pointerType === 'mouse') hoverEv = { e, f };
      return;
    }
    if (tap && e.pointerId === tap.id && tap.f === f && !cancelled) {
      const { x, y } = local(f, e);
      if (!movedBeyond(x - downAt.x, y - downAt.y)) tap.target.onTap?.(tap.hit, info(f, x, y, e));
    }
    tap = null;
  };
  const listen = (f: Frame) =>
    listenFrame(f, {
      down: onDown(f),
      move: onMove(f),
      finish: (e, cancelled) => finish(f, e, cancelled),
      leave: () => {
        hoverEv = null;
        if (!session && hov.frame === f) hov.set(null, null, undefined, f);
      },
    });
  const unlistenMain = listen(main);

  // Vòng frame thời gian thực: hover gộp một lần mỗi frame + callback (hoạt cảnh cầm–đặt, đồng bộ tay kéo với GUI).
  const loop = createFrameLoop(() => {
    if (session) return;
    // Vật đang rê bị tắt (đổi chế độ, sang bước khác) mà chuột đứng yên → bỏ hover + tooltip.
    if (hov.target && (!live(hov.target) || !api.enabled)) hov.set(null, null, undefined, hov.frame);
    if (!hoverEv) return;
    const { e, f } = hoverEv;
    hoverEv = null;
    if (!f.accepts(e)) return hov.set(null, null, undefined, f);
    const { x, y } = local(f, e);
    const p = info(f, x, y, e);
    const hit = pick(f, p);
    hov.set(hit?.target ?? null, hit, p, f);
  });

  const api: PointerHub = {
    enabled: true,
    get active() { return session !== null; }, // prettier-ignore
    get hovered() { return hov.target; }, // prettier-ignore
    get idle() {
      return !session && ![...busyFns].some((f) => f());
    },
    add(t) {
      targets.push(t);
      return () => {
        const i = targets.indexOf(t);
        if (i >= 0) targets.splice(i, 1);
        if (hov.target === t) hov.set(null, null, undefined, hov.frame);
      };
    },
    setLayer(name, on) {
      if (on) offLayers.delete(name);
      else offLayers.add(name);
    },
    addFrame(name, fr) {
      const remove = listen(subFrame(name, fr.element, fr.camera));
      ctx.track(remove);
      return remove;
    },
    info: (x, y) => info(main, x, y),
    pickAt: (x, y) => pick(main, info(main, x, y)),
    onFrame: (cb) => loop.add(cb),
    tween: (seconds, step, done) => loopTween(loop, api.busy, seconds, step, done),
    busy(fn) {
      busyFns.add(fn);
      return () => void busyFns.delete(fn);
    },
    anchor(x, y) {
      last = { x, y };
      lastFrame = main;
      seen = true;
    },
    toast,
  };
  ctx.track(() => {
    loop.dispose();
    toast.dispose();
    unlistenMain();
    if (session) ctx.controls.enabled = controlsWas;
    ctx.overlay.classList.remove('ix-drag');
    busyFns.clear();
  });
  return api;
}
