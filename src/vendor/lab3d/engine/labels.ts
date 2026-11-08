import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import '../ui/tokens.css';
import './labels.css';

export interface LabelOptions {
  /** Kiểu hiển thị: thường / nhỏ / tiêu đề. */
  variant?: 'default' | 'small' | 'title';
  /** Thêm class CSS. */
  className?: string;
  /** Độ lệch so với gốc toạ độ của vật (đơn vị thế giới). */
  offset?: THREE.Vector3Tuple;
  /** Màu nội dung gắn với nhãn (vd. màu đường/điểm tương ứng) – hiện thành chấm nhỏ trước chữ, không tô viền. */
  color?: string;
  /**
   * Luôn hiện. Mặc định nhãn thường/nhỏ không có `className` là nhãn "gọn": ẩn tới khi con trỏ tới gần hoặc vật đang liên quan
   * tới bước (mũi tên gợi ý, vật đang rê); người dùng bật "Hiện mọi nhãn" trong Tham số để hiện hết.
   */
  keep?: boolean;
  /** Ép nhãn có `className` cũng theo chế độ gọn. */
  quiet?: boolean;
}

export function createLabelRenderer(host: HTMLElement): CSS2DRenderer {
  const r = new CSS2DRenderer();
  r.domElement.className = 'labels-layer';
  host.appendChild(r.domElement);
  return r;
}

/** Tạo nhãn HTML gắn vào một Object3D. */
export function makeLabel(target: THREE.Object3D, text: string, opts: LabelOptions = {}): CSS2DObject {
  const el = document.createElement('div');
  const variant = opts.variant ?? 'default';
  const auto = !opts.keep && variant !== 'title' && (opts.quiet || !opts.className);
  // Màu nội dung → chấm nhỏ (nhãn có lớp riêng tự xử lí --label-color).
  const dot = opts.color && !opts.className ? ' lab-label--dot' : '';
  el.className = `lab-label lab-label--${variant}${auto ? ' lab-label--auto' : ''}${dot}${opts.className ? ` ${opts.className}` : ''}`;
  el.textContent = text;
  if (opts.color) el.style.setProperty('--label-color', opts.color);
  const obj = new CSS2DObject(el);
  if (opts.offset) obj.position.set(...opts.offset);
  target.add(obj);
  return obj;
}
