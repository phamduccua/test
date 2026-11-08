import type * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { labText } from '../../text';

/**
 * Thị trường kính hiển vi cho vật kính bất kì (4×…100×): mặt nạ tròn, nhãn độ phóng đại, thước µm tự chọn,
 * độ mờ (vd. 100× thiếu dầu soi) và khoảng cách camera ứng với đường kính thị trường thật (FN / vật kính).
 */
export interface ScopeField {
  setVisible(on: boolean): void;
  /** Mờ nhoè (px, 0 = nét) – lớp backdrop-filter trong vòng thị trường. */
  setBlur(px: number): void;
  /** Đường kính thị trường thật (µm) ở vật kính `obj`. */
  fieldUm(obj: number): number;
  /** Khoảng cách camera để vòng tròn trên màn hình chứa đúng `fieldUm(obj)` µm của mẫu. */
  distanceFor(camera: THREE.PerspectiveCamera, obj: number): number;
  update(camera: THREE.PerspectiveCamera, distance: number, obj: number, note?: string): void;
}

const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500];
const R_FRAC = 0.47;

/** `unitsPerUm` = đơn vị cảnh ứng với 1 µm; `fieldNumber` = số trường của thị kính (mm, mặc định 18). */
export function createScopeField(ctx: SimContext, unitsPerUm: number, o: { fieldNumber?: number; eyepiece?: number } = {}): ScopeField {
  const fn = o.fieldNumber ?? 18;
  const eye = o.eyepiece ?? 10;
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;';
  const blur = document.createElement('div');
  blur.style.cssText = 'position:absolute;border-radius:50%;';
  const mask = document.createElement('div');
  mask.style.cssText = 'position:absolute;inset:0;';
  const tag = document.createElement('div');
  tag.style.cssText =
    'position:absolute;right:14px;padding:4px 10px;border-radius:var(--ui-radius-pill);background:var(--ui-surface);box-shadow:var(--ui-shadow-sm);color:var(--ui-text);font:500 var(--ui-fs-sm)/1.4 var(--ui-font);white-space:nowrap;';
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;height:4px;background:#1b1b1b;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.7);';
  const barText = document.createElement('div');
  barText.style.cssText = 'position:absolute;color:#1b1b1b;font:500 11px var(--ui-font);text-shadow:0 0 3px #fff;';
  el.append(blur, mask, tag, bar, barText);
  ctx.overlay.appendChild(el);
  const fieldUm = (obj: number) => (fn * 1000) / obj;
  const tan = (camera: THREE.PerspectiveCamera) => Math.tan((camera.fov * Math.PI) / 360);
  return {
    setVisible(on) {
      el.style.display = on ? 'block' : 'none';
    },
    setBlur(px) {
      const f = px > 0 ? `blur(${px}px)` : 'none';
      blur.style.backdropFilter = f;
      blur.style.setProperty('-webkit-backdrop-filter', f);
    },
    fieldUm,
    distanceFor(camera, obj) {
      const { width: W, height: H } = ctx.viewInsets();
      // Vòng tròn có đường kính 2·R_FRAC·min(W,H) px; khung cao H px ứng với 2·d·tan(fov/2) đơn vị.
      const k = (2 * R_FRAC * Math.min(W, H)) / Math.max(1, H);
      return (fieldUm(obj) * unitsPerUm) / (k * 2 * tan(camera));
    },
    update(camera, distance, obj, note) {
      const ins = ctx.viewInsets();
      const { width: W, height: H } = ins;
      const r = Math.min(W, H) * R_FRAC;
      const cx = W / 2;
      const cy = H / 2;
      mask.style.background = `radial-gradient(circle ${r}px at ${cx}px ${cy}px, transparent 0 ${r - 14}px, rgba(0,0,0,.55) ${r - 3}px, #050505 ${r + 1}px)`;
      Object.assign(blur.style, { left: `${cx - r}px`, top: `${cy - r}px`, width: `${2 * r}px`, height: `${2 * r}px` });
      // Góc trên phải, dưới thanh công cụ, tránh bảng tham số: không bao giờ bị dòng thuyết minh che.
      tag.style.top = `${ins.top + 8}px`;
      tag.style.right = `${ins.right + 14}px`;
      tag.textContent = `${labText('t_64466a6b976e')}${obj}${labText('t_b8a5d8097399')}${eye}${labText('t_ac6f2577255e')}${obj * eye}${labText('t_67fba2f357af')}${note ? ` · ${note}` : ''}`;
      const pxPerUm = (H / (2 * distance * tan(camera))) * unitsPerUm;
      // Thước dài cỡ 1/5 bán kính, làm tròn về số đẹp.
      const um = NICE.reduce((b, v) => (v * pxPerUm <= r * 0.42 ? v : b), NICE[0]);
      bar.style.left = barText.style.left = `${cx + r * 0.3}px`;
      bar.style.top = `${cy + r * 0.62}px`;
      bar.style.width = `${um * pxPerUm}px`;
      barText.style.top = `${cy + r * 0.62 - 17}px`;
      barText.textContent = `${um} µm`;
    },
  };
}
