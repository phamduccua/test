import type * as THREE from 'three';

/**
 * Mức chất lượng hình ảnh cho sim (sim tự quyết dùng thế nào – vd. kit địa cầu: texture 2K/4K, hậu kỳ, bóng mây).
 * - `low`    – renderer phần mềm (SwiftShader/llvmpipe) hoặc máy yếu: không hậu kỳ, texture nhỏ, pixelRatio 1.
 * - `medium` – GPU tích hợp: SMAA + tone mapping, texture 4K.
 * - `high`   – GPU rời: + bloom, normal map, bóng mây, pixelRatio ≤ 2.
 * Hoá: `createLabStage({ lighting })` bật hậu kỳ nhẹ khi ≥ medium (createLabPost); low → render thẳng.
 */
export type Quality = 'low' | 'medium' | 'high';
export type QualityPref = Quality | 'auto';

export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];
const KEY = 'sgk-quality';

function isQuality(v: unknown): v is Quality {
  return v === 'low' || v === 'medium' || v === 'high';
}

/** Tên renderer WebGL thực (UNMASKED_RENDERER_WEBGL), '' nếu trình duyệt giấu. */
export function rendererName(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return typeof name === 'string' ? name : '';
}

/** Đoán chất lượng theo renderer: phần mềm → low; GPU tích hợp/di động → medium; còn lại → high. */
export function detectQuality(renderer: THREE.WebGLRenderer): Quality {
  const name = rendererName(renderer).toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic render/.test(name)) return 'low';
  const mobile = typeof navigator !== 'undefined' && /android|iphone|ipad|mobile/i.test(navigator.userAgent);
  if (mobile || /intel|mali|adreno|powervr|apple gpu/.test(name)) return 'medium';
  return 'high';
}

/** Lựa chọn người dùng: `?q=low|medium|high` trên URL thắng localStorage; mặc định 'auto'. */
export function readQualityPref(): QualityPref {
  try {
    const q = new URLSearchParams(window.location.search).get('q');
    if (isQuality(q)) return q;
    const saved = window.localStorage.getItem(KEY);
    if (isQuality(saved)) return saved;
  } catch {
    // localStorage bị chặn → dùng auto.
  }
  return 'auto';
}

export function saveQualityPref(pref: QualityPref): void {
  try {
    if (pref === 'auto') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, pref);
  } catch {
    // bỏ qua
  }
}
