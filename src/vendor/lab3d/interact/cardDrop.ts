import * as THREE from 'three';
import { createCardFly } from './cardFly';
import type { CardDrop, CardDropOptions } from './cardDropTypes';
import { createAutoScroll, createHtmlTarget, fade, ghostOf, place, swallowNextClick } from './cardTarget';
import { movedBeyond } from './math';
import { pointerHub } from './pointer';
import type { InteractCtx } from './types';
import './cardDrop.css';
import { labText } from '../text';

export type { CardDrop, CardDropOptions } from './cardDropTypes';

const FAR = new THREE.Vector3(1e9, 1e9, 1e9);

/**
 * Kéo THẺ HTML (tên, chú giải) thả vào vùng 3D (`createDropZones`): bóng thẻ đi theo con trỏ, tia con trỏ chiếu xuống bề mặt
 * (`surface`) để dò vùng; thả đúng → thẻ "dán" vào chỗ, sai → toast lí do + thẻ bay về. Không đụng OrbitControls (sự kiện ở HTML).
 */
export function createCardDrop(ctx: InteractCtx, o: CardDropOptions): CardDrop {
  const hub = pointerHub(ctx);
  const canvas = ctx.renderer.domElement;
  const hit = new THREE.Vector3();
  let drag: { item: string; ghost: HTMLElement; id: number; el: HTMLElement; dx: number; dy: number; home: { x: number; y: number }; x0: number; y0: number; moved: boolean } | null = null;
  const local = (cx: number, cy: number) => {
    const r = ctx.overlay.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  };
  /** Điểm trên bề mặt dưới con trỏ – null khi con trỏ đang ở trên bảng chứa thẻ / nút HTML (không phải thả vào cảnh). */
  const project = (cx: number, cy: number): THREE.Vector3 | null => {
    const under = document.elementFromPoint(cx, cy);
    if (under && (o.root.contains(under) || under.closest('button, input, select, textarea, .ix-proc'))) return null;
    const r = canvas.getBoundingClientRect();
    return o.surface?.project(hub.info(cx - r.left, cy - r.top).ray, hit) ? hit : null;
  };
  const zones = o.zones;
  const scroll = o.autoScroll === false ? null : createAutoScroll();
  ctx.track(hub.onFrame((dt) => drag?.moved && scroll?.tick(dt)));
  /** Toast hiện cạnh thẻ đang kéo (không phải chỗ con trỏ cuối trên canvas). */
  const anchor = (cx: number, cy: number) => {
    const r = canvas.getBoundingClientRect();
    hub.anchor(cx - r.left, cy - r.top);
  };
  const makeGhost = (el: HTMLElement) => ghostOf(ctx.overlay, el);
  const centerOf = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return local(r.left + r.width / 2, r.top + r.height / 2);
  };

  const tgt = createHtmlTarget(hub, o.html);
  const { fly, stop, busy } = createCardFly(hub, ctx.overlay, (item) => [...o.root.querySelectorAll<HTMLElement>(o.selector)].find((x) => o.item(x) === item), centerOf);
  ctx.track(hub.busy(busy));
  const onDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(o.selector);
    if (!el || drag || !hub.enabled || (o.enabled && !o.enabled()) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (o.ignore && (e.target as HTMLElement).closest(o.ignore)) return;
    e.preventDefault();
    e.stopPropagation();
    const item = o.item(el);
    const c = centerOf(el);
    const p = local(e.clientX, e.clientY);
    const ghost = makeGhost(el);
    drag = { item, ghost, id: e.pointerId, el, dx: c.x - p.x, dy: c.y - p.y, home: c, x0: e.clientX, y0: e.clientY, moved: false };
    place(ghost, c.x, c.y);
    ghost.style.visibility = 'hidden';
    el.classList.add('ix-card-src');
    el.setPointerCapture?.(e.pointerId);
    zones?.begin(item);
    anchor(e.clientX, e.clientY);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && !movedBeyond(e.clientX - drag.x0, e.clientY - drag.y0)) return;
    drag.moved = true;
    drag.ghost.style.visibility = '';
    const p = local(e.clientX, e.clientY);
    place(drag.ghost, p.x + drag.dx * 0.3, p.y + drag.dy * 0.3);
    anchor(e.clientX, e.clientY);
    scroll?.at(e.clientX, e.clientY);
    const el = tgt.at(e.clientX, e.clientY);
    tgt.set(el);
    const w = el ? null : project(e.clientX, e.clientY);
    const z = zones?.over(drag.item, w ?? FAR) ?? null;
    drag.ghost.classList.toggle('over', !!z || !!el);
    o.onMove?.(drag.item, w);
  };
  const onUp = (e: PointerEvent, cancelled = false) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    d.el.classList.remove('ix-card-src');
    if (d.el.hasPointerCapture?.(e.pointerId)) d.el.releasePointerCapture(e.pointerId);
    scroll?.stop();
    if (!d.moved) {
      // Bấm (không kéo): để sự kiện click của thẻ chạy như nút (phím tắt), không coi là thả.
      d.ghost.remove();
      zones?.cancel();
      return;
    }
    anchor(e.clientX, e.clientY);
    swallowNextClick();
    const el = cancelled ? null : tgt.at(e.clientX, e.clientY);
    tgt.set(null);
    if (el) {
      zones?.cancel();
      const ok = tgt.drop(d.item, el);
      fade(d.ghost, ok, ok ? undefined : d.home);
      return;
    }
    const w = cancelled ? null : project(e.clientX, e.clientY);
    const res = w && zones ? zones.end(d.item, w) : (zones?.cancel(), null);
    const ok = !!res?.ok;
    if (zones && !res?.zone && !cancelled) hub.toast.show(labText('t_3cb2b7bab075'), 'info', 2000);
    fade(d.ghost, ok, ok ? undefined : d.home);
    o.onDrop?.(d.item, res);
  };
  const up = (e: PointerEvent) => onUp(e);
  const cancel = (e: PointerEvent) => onUp(e, true);
  o.root.addEventListener('pointerdown', onDown);
  o.root.addEventListener('pointermove', onMove);
  o.root.addEventListener('pointerup', up);
  o.root.addEventListener('pointercancel', cancel);
  ctx.track(() => {
    o.root.removeEventListener('pointerdown', onDown);
    o.root.removeEventListener('pointermove', onMove);
    o.root.removeEventListener('pointerup', up);
    o.root.removeEventListener('pointercancel', cancel);
    drag?.ghost.remove();
    tgt.set(null);
    stop();
  });

  const v = new THREE.Vector3();
  return {
    get dragging() {
      return drag?.item ?? null;
    },
    carryTo(item, zoneId, done) {
      const z = zones?.get(zoneId);
      const to = () => {
        if (z) zones!.center(z, v).project(ctx.camera);
        const r = canvas.getBoundingClientRect();
        return local(r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height);
      };
      if (z) zones!.begin(item);
      const ok = !!z && fly(item, to, (a, ghost) => {
        const res = zones!.dropInto(item, zoneId);
        fade(ghost, res.ok, res.ok ? undefined : a);
        o.onDrop?.(item, res);
        done?.();
      });
      if (!ok) {
        zones?.cancel();
        done?.();
      }
    },
    carryToEl(item, targetEl, done) {
      const ok = fly(item, () => centerOf(targetEl), (a, ghost) => {
        const res = tgt.drop(item, targetEl);
        fade(ghost, res, res ? undefined : a);
        done?.();
      }, (on) => tgt.set(on ? targetEl : null));
      if (!ok) done?.();
    },
  };
}
