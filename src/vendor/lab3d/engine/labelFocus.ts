import type * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * Nhãn 3D "ít, hiện khi cần": nhãn thường (`.lab-label--auto`) ẩn khi lớp nhãn ở chế độ gọn (`.labels-layer.is-quiet`),
 * hiện khi con trỏ tới gần (`.is-near`) hoặc vật của nhãn đang liên quan (`.is-focus`: mũi tên gợi ý bước, vật đang rê/kéo).
 */
const sources = new Map<string, Set<HTMLElement>>();
const owners = new Map<string, THREE.Object3D | null>();
const isLabel = (o: THREE.Object3D): o is CSS2DObject => (o as { isCSS2DObject?: boolean }).isCSS2DObject === true;

function labelsOf(obj: THREE.Object3D): Set<HTMLElement> {
  const out = new Set<HTMLElement>();
  obj.traverse((o) => void (isLabel(o) && out.add(o.element)));
  // Nhãn gắn ở nhóm cha gần (dụng cụ nhiều phần) – tối đa 2 cấp, không tính cảnh gốc.
  let p = obj.parent;
  for (let i = 0; p?.parent && i < 2; i++, p = p.parent) for (const c of p.children) if (isLabel(c)) out.add(c.element);
  return out;
}

/** Đánh dấu nhãn của `obj` (và con) là đang liên quan theo nguồn `source` ('hint', 'hover'…); null = bỏ. */
export function focusLabels(source: string, obj: THREE.Object3D | null): void {
  if (owners.get(source) === obj) return;
  owners.set(source, obj);
  const prev = sources.get(source);
  const next = obj ? labelsOf(obj) : new Set<HTMLElement>();
  sources.set(source, next);
  const held = (el: HTMLElement) => [...sources.values()].some((s) => s.has(el));
  if (prev) for (const el of prev) if (!held(el)) el.classList.remove('is-focus');
  for (const el of next) el.classList.add('is-focus');
}

/** Bỏ mọi đánh dấu (huỷ sim). */
export function clearLabelFocus(): void {
  for (const s of sources.values()) for (const el of s) el.classList.remove('is-focus');
  sources.clear();
  owners.clear();
}

/** Con trỏ trong `host` tới gần nhãn (≤ `radius` px tới khung nhãn) → `.is-near`. Trả hàm gỡ. */
export function trackLabelProximity(host: HTMLElement, layer: HTMLElement, radius = 56): () => void {
  const near = new Set<HTMLElement>();
  let raf = 0;
  let x = -1e5;
  let y = -1e5;
  const run = () => {
    raf = 0;
    for (const el of layer.querySelectorAll<HTMLElement>('.lab-label--auto')) {
      const b = el.getBoundingClientRect();
      const dx = Math.max(b.left - x, 0, x - b.right);
      const dy = Math.max(b.top - y, 0, y - b.bottom);
      const on = b.width > 0 && dx * dx + dy * dy < radius * radius;
      if (on === near.has(el)) continue;
      el.classList.toggle('is-near', on);
      if (on) near.add(el);
      else near.delete(el);
    }
  };
  const at = (e: PointerEvent | null) => {
    x = e ? e.clientX : -1e5;
    y = e ? e.clientY : -1e5;
    if (!raf) raf = requestAnimationFrame(run);
  };
  const move = (e: PointerEvent) => at(e);
  const leave = () => at(null);
  host.addEventListener('pointermove', move, { passive: true });
  host.addEventListener('pointerdown', move, { passive: true });
  host.addEventListener('pointerleave', leave);
  return () => {
    host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerdown', move);
    host.removeEventListener('pointerleave', leave);
    cancelAnimationFrame(raf);
    for (const el of near) el.classList.remove('is-near');
  };
}
