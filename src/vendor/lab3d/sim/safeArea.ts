import type * as THREE from 'three';
import { applySafeViewOffset } from '../engine/cameraRig';
import type { SafeFramingOptions, ViewInsets } from './types';

/**
 * Đo vùng khung bị UI chung che (px so với mép `root` = .simhost):
 * phải = lil-gui khi đang mở, trên = thanh công cụ, dưới = caption (+ HUD khi đặt ở đáy); `leftColumn` = cột toolbar/HUD/cảnh báo;
 * `safeBottom` = như `bottom` nhưng tính cả thanh bước `.ix-proc` (đứng trên các dải đáy) – đáy của khung nhìn an toàn.
 */
export function measureInsets(root: HTMLElement): ViewInsets {
  const r = root.getBoundingClientRect();
  const out: ViewInsets = { top: 0, right: 0, bottom: 0, left: 0, width: Math.max(1, r.width), height: Math.max(1, r.height) };
  const gui = root.querySelector<HTMLElement>('.simhost__gui .sim-gui');
  if (gui && !gui.classList.contains('lil-closed') && !gui.classList.contains('closed')) out.right = Math.max(0, r.right - gui.getBoundingClientRect().left);
  const bar = root.querySelector<HTMLElement>('.simbar');
  if (bar) out.top = Math.max(0, bar.getBoundingClientRect().bottom - r.top);
  // Caption ẩn sau nút "i" của bảng bước (display none) → không che gì.
  const cap = root.querySelector<HTMLElement>('.simov__caption');
  if (cap?.offsetParent) out.bottom = Math.max(0, r.bottom - cap.getBoundingClientRect().top);
  // HUD sim tự đặt ở đáy (ctx.setHudPlacement('bottom-*')) → tính vào phần bị che dưới.
  const hudBox = root.querySelector<HTMLElement>('.simhost__hud--bottom-left .hud, .simhost__hud--bottom-right .hud');
  if (hudBox) out.bottom = Math.max(out.bottom, r.bottom - hudBox.getBoundingClientRect().top);
  // Dải ở đáy do sim / kit tự báo (`data-inset="bottom"`, vd. dải thẻ minh chứng) → thanh bước, bảng đứng trên dải.
  for (const el of root.querySelectorAll<HTMLElement>('[data-inset="bottom"]')) {
    const b = el.offsetParent ? el.getBoundingClientRect() : null;
    if (b?.height) out.bottom = Math.max(out.bottom, r.bottom - b.top);
  }
  // Thanh bước của kit/lab3d/interact (giữa đáy, trên caption / dải đáy): chỉ báo riêng ở `safeBottom` – `bottom` giữ nghĩa cũ vì nhiều sim
  // tự cộng `procLift()` vào `bottom` khi đặt bảng. Làm tròn 4 px cho khung nhìn không nhảy khi tên bước đổi.
  out.safeBottom = out.bottom;
  const proc = root.querySelector<HTMLElement>('.sim-overlay .ix-proc');
  const pb = proc?.offsetParent ? proc.getBoundingClientRect() : null;
  if (pb?.height) out.safeBottom = Math.max(out.bottom, Math.ceil((r.bottom - pb.top + 8) / 4) * 4);
  // Cột trái (toolbar + HUD + thẻ cảnh báo): chỉ báo riêng, không cộng vào left/top (giữ hành vi cũ).
  const col = root.querySelector<HTMLElement>('.simhost__left');
  if (col) {
    let width = 0;
    let bottom = 0;
    for (const el of Array.from(col.children) as HTMLElement[]) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      width = Math.max(width, b.right - r.left);
      bottom = Math.max(bottom, b.bottom - r.top);
    }
    out.leftColumn = { width, bottom };
  }
  return out;
}

/**
 * Lệch tâm chiếu theo vùng trống: ngang như `applySafeViewOffset`; `aboveSteps` → cả khung (đã chỉnh tay cho toàn canvas) co đều
 * theo tỉ lệ s = (cao − safeBottom) / cao, mép trên giữ nguyên – camera, tâm quay, tia chọn vật không đổi, chỉ phép chiếu đổi.
 */
export function applySafeFrame(camera: THREE.PerspectiveCamera, ins: ViewInsets, o: SafeFramingOptions = {}) {
  const band = o.aboveSteps ? Math.max(0, ins.safeBottom ?? ins.bottom) : 0;
  const { width: w, height: h } = ins;
  const k = Math.max(0.5, (h - band) / h);
  if (k > 0.999) return void applySafeViewOffset(camera, ins);
  const x = Math.round((ins.right - ins.left) / 2);
  // Khung "thiết kế" w·k × h·k; cửa sổ w × h bắt đầu lệch trái (w − w·k)/2 cho tâm ngang như cũ, phần dư dồn xuống đáy.
  camera.setViewOffset(w * k, h * k, x - (w * (1 - k)) / 2, 0, w, h);
}

/** Tự cập nhật camera.setViewOffset theo vùng trống khi bật (theo dõi kích thước khung + bảng tham số + thanh bước). */
export function createSafeFraming(camera: THREE.PerspectiveCamera, root: HTMLElement, gui: HTMLElement) {
  let ro: ResizeObserver | null = null;
  let mo: MutationObserver | null = null;
  let raf = 0;
  let poll = 0;
  let opts: SafeFramingOptions = {};
  let last = '';
  const apply = () => {
    raf = 0;
    // Đang kéo vật (kit/lab3d/interact thêm .ix-drag vào overlay): hoãn đổi lệch tâm chiếu – cảnh không trượt dưới con trỏ; nhả xong mới áp.
    if (root.querySelector('.ix-drag')) return void (raf = requestAnimationFrame(apply));
    const ins = measureInsets(root);
    last = `${ins.width}|${ins.height}|${ins.left}|${ins.right}|${ins.safeBottom}`;
    applySafeFrame(camera, ins, opts);
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(apply);
  };
  const stop = () => {
    ro?.disconnect();
    mo?.disconnect();
    ro = mo = null;
    if (raf) cancelAnimationFrame(raf);
    if (poll) window.clearInterval(poll);
    raf = poll = 0;
  };
  return {
    set(on = true, o: SafeFramingOptions = {}) {
      stop();
      if (!on) {
        camera.clearViewOffset();
        return;
      }
      opts = o;
      ro = new ResizeObserver(schedule);
      ro.observe(root);
      ro.observe(gui);
      mo = new MutationObserver(schedule);
      mo.observe(gui, { attributes: true, attributeFilter: ['class'] });
      // Thanh bước hiện / ẩn / đổi cao (sim tạo sau, vi mô ẩn): đo lại định kì, chỉ áp khi số đo đổi.
      if (o.aboveSteps)
        poll = window.setInterval(() => {
          const ins = measureInsets(root);
          if (`${ins.width}|${ins.height}|${ins.left}|${ins.right}|${ins.safeBottom}` !== last) schedule();
        }, 300);
      apply();
    },
    dispose: stop,
  };
}
