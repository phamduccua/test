import * as THREE from 'three';
import type { Tracker } from '../lab/types';
import { labText } from '../text';

/** Bộ vật liệu/geometry vi mô dùng chung trong MỘT mô phỏng (tạo lười, tự `track`). */
export interface MicroMaterials {
  /** Quả cầu nguyên tử CPK: nhựa bóng có clearcoat (kiểu mô hình que – cầu). */
  atom(color: THREE.ColorRepresentation): THREE.MeshPhysicalMaterial;
  /** Que nối / liên kết (một màu). */
  stick(color: THREE.ColorRepresentation): THREE.MeshPhysicalMaterial;
  /** Kim loại bóng như chrome (hạt nhân trên bìa sách). */
  chrome(color?: THREE.ColorRepresentation): THREE.MeshPhysicalMaterial;
  /** Vầng sáng (sprite cộng màu). */
  glow(color: THREE.ColorRepresentation, opacity?: number): THREE.SpriteMaterial;
  glowTexture(): THREE.Texture;
  /** Hình cầu đơn vị dùng chung (bán kính 1) – co giãn bằng `scale`. */
  sphere(detail?: 'low' | 'high'): THREE.SphereGeometry;
  /** Trụ đơn vị: bán kính 1, cao 1, đáy ở y = 0. */
  cylinder(): THREE.CylinderGeometry;
  /** true nếu tài nguyên thuộc bộ dùng chung (không được dispose lẻ). */
  isShared(res: unknown): boolean;
}

const kits = new WeakMap<object, MicroMaterials>();

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) throw new Error(labText('t_bb11751fbaec'));
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Lấy (hoặc tạo) bộ vật liệu vi mô gắn với `ctx`. */
export function microMaterials(ctx: Tracker): MicroMaterials {
  const found = kits.get(ctx);
  if (found) return found;
  const cache = new Map<string, unknown>();
  const once = <T>(key: string, make: () => T): T => {
    let v = cache.get(key) as T | undefined;
    if (!v) {
      v = ctx.track(make());
      cache.set(key, v);
      shared.add(v);
    }
    return v;
  };
  const hex = (c: THREE.ColorRepresentation) => new THREE.Color(c).getHexString();
  const shared = new Set<unknown>();
  const kit: MicroMaterials = {
    isShared: (res) => shared.has(res),
    atom: (color) =>
      once(`atom-${hex(color)}`, () => {
        const col = new THREE.Color(color);
        // Đen (C trong bộ lắp ráp) vẫn phải thấy khối: nâng sàn độ sáng một chút.
        const dark = col.getHSL({ h: 0, s: 0, l: 0 }).l < 0.08;
        return new THREE.MeshPhysicalMaterial({
          color: col,
          roughness: dark ? 0.28 : 0.34,
          metalness: 0,
          clearcoat: 0.8,
          clearcoatRoughness: 0.12,
          sheen: 0.25,
          sheenRoughness: 0.6,
          envMapIntensity: 1.1,
        });
      }),
    stick: (color) =>
      once(`stick-${hex(color)}`, () =>
        new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
      ),
    chrome: (color = 0xe8ecf2) =>
      once(`chrome-${hex(color)}`, () =>
        new THREE.MeshPhysicalMaterial({
          color,
          metalness: 1,
          roughness: 0.12,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          envMapIntensity: 1.6,
        }),
      ),
    glowTexture: () => once('glow-tex', makeGlowTexture),
    glow: (color, opacity = 1) =>
      once(`glow-${hex(color)}-${opacity}`, () =>
        new THREE.SpriteMaterial({
          map: kit.glowTexture(),
          color,
          opacity,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    sphere: (detail = 'high') =>
      once(`sphere-${detail}`, () => (detail === 'high' ? new THREE.SphereGeometry(1, 48, 32) : new THREE.SphereGeometry(1, 20, 14))),
    cylinder: () =>
      once('cyl', () => {
        const g = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
        g.translate(0, 0.5, 0);
        return g;
      }),
  };
  kits.set(ctx, kit);
  return kit;
}
