import type * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { labText } from '../../text';

/** Khung thị trường kính hiển vi (HTML trên canvas): vòng tròn tối bao quanh, độ phóng đại, thước µm. */
export interface FieldView {
  setVisible(on: boolean): void;
  update(camera: THREE.PerspectiveCamera, distance: number, obj: 10 | 40): void;
}

/** `unitsPerUm` = đơn vị cảnh ứng với 1 µm của mẫu (để vẽ thước tỉ lệ). */
export function createFieldView(ctx: SimContext, unitsPerUm: number): FieldView {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;';
  const mask = document.createElement('div');
  mask.style.cssText = 'position:absolute;inset:0;';
  const tag = document.createElement('div');
  tag.style.cssText =
    'position:absolute;padding:4px 10px;border-radius:var(--ui-radius-pill);background:var(--ui-surface);box-shadow:var(--ui-shadow-sm);color:var(--ui-text);font:500 var(--ui-fs-sm)/1.4 var(--ui-font);';
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;height:4px;background:#1b1b1b;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.7);';
  const barText = document.createElement('div');
  barText.style.cssText = 'position:absolute;color:#1b1b1b;font:500 11px var(--ui-font);text-shadow:0 0 3px #fff;';
  el.append(mask, tag, bar, barText);
  ctx.overlay.appendChild(el);
  return {
    setVisible(on) {
      el.style.display = on ? 'block' : 'none';
    },
    update(camera, distance, obj) {
      const ins = ctx.viewInsets();
      const { width: W, height: H } = ins;
      const r = Math.min(W, H) * 0.47;
      const cx = W / 2;
      const cy = H / 2;
      mask.style.background = `radial-gradient(circle ${r}px at ${cx}px ${cy}px, transparent 0 ${r - 14}px, rgba(0,0,0,.55) ${r - 3}px, #050505 ${r + 1}px)`;
      // Góc trên phải, dưới thanh công cụ, tránh bảng tham số (đáy vòng hay bị dòng thuyết minh che).
      tag.style.top = `${ins.top + 8}px`;
      tag.style.right = `${ins.right + 14}px`;
      tag.textContent = `${labText('t_64466a6b976e')}${obj}${labText('t_c2f9767aeb82')}${obj * 10}${labText('t_67fba2f357af')}`;
      const pxPerUnit = H / (2 * distance * Math.tan((camera.fov * Math.PI) / 360));
      const um = obj === 40 ? 50 : 200;
      const len = um * unitsPerUm * pxPerUnit;
      bar.style.left = `${cx + r * 0.32}px`;
      bar.style.top = `${cy + r * 0.62}px`;
      bar.style.width = `${len}px`;
      barText.style.left = `${cx + r * 0.32}px`;
      barText.style.top = `${cy + r * 0.62 - 17}px`;
      barText.textContent = `${um} µm`;
    },
  };
}
