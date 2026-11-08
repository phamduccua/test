import * as THREE from 'three';
import type { Tracker } from '../types';

/**
 * Da ếch / nòng nọc theo "loài" (quy ước minh hoạ): A = xanh lục có đốm đen, B = nâu trơn, mix = nâu ô liu loang lổ (hai bộ nhân).
 * Texture canvas trải trên UV của SphereGeometry: v = 1 lưng, v = 0 bụng (bụng nhạt).
 */
export type FrogSkin = 'A' | 'B' | 'mix';

export const SKIN_COLORS: Record<FrogSkin, { back: string; side: string; belly: string; spot: string | null }> = {
  A: { back: '#3f7f2a', side: '#6aa83e', belly: '#e9e4b8', spot: '#16200f' },
  B: { back: '#6d4524', side: '#9a6a3c', belly: '#e6d4b0', spot: null },
  mix: { back: '#5b5a2c', side: '#857a44', belly: '#ddd2a8', spot: '#3a2a18' },
};

const cache = new WeakMap<Tracker, Map<string, THREE.MeshStandardMaterial>>();

function paint(skin: FrogSkin, seed: number) {
  const c = SKIN_COLORS[skin];
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, c.back);
  grad.addColorStop(0.42, c.side);
  grad.addColorStop(0.62, c.belly);
  grad.addColorStop(1, c.belly);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  // Hạt sần nhỏ trên lưng.
  for (let i = 0; i < 900; i++) {
    const y = r() * 150;
    g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.06})`;
    g.fillRect(r() * 512, y, 2, 2);
  }
  if (c.spot) {
    const n = skin === 'A' ? 46 : 14;
    for (let i = 0; i < n; i++) {
      const x = r() * 512;
      const y = 8 + r() * (skin === 'A' ? 130 : 110);
      const rad = (skin === 'A' ? 6 : 10) + r() * (skin === 'A' ? 9 : 14);
      g.fillStyle = c.spot;
      g.globalAlpha = skin === 'A' ? 0.92 : 0.35;
      g.beginPath();
      g.ellipse(x, y, rad, rad * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2);
      g.fill();
      if (skin === 'A') {
        g.strokeStyle = '#c9d77a';
        g.globalAlpha = 0.35;
        g.lineWidth = 2;
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Vật liệu da dùng chung (cache theo ctx + loài + biến thể). */
export function skinMaterial(ctx: Tracker, skin: FrogSkin, variant = 0): THREE.MeshStandardMaterial {
  let m = cache.get(ctx);
  if (!m) cache.set(ctx, (m = new Map()));
  const key = `${skin}:${variant}`;
  let mat = m.get(key);
  if (!mat) {
    const map = ctx.track(paint(skin, 7 + variant * 13));
    mat = ctx.track(new THREE.MeshStandardMaterial({ map, roughness: 0.42, metalness: 0 }));
    m.set(key, mat);
  }
  return mat;
}

/** Vật liệu trơn dùng chung (mắt, đồng tử…). */
export function plainMaterial(ctx: Tracker, color: THREE.ColorRepresentation, roughness = 0.3): THREE.MeshStandardMaterial {
  let m = cache.get(ctx);
  if (!m) cache.set(ctx, (m = new Map()));
  const key = `plain:${new THREE.Color(color).getHexString()}:${roughness}`;
  let mat = m.get(key);
  if (!mat) m.set(key, (mat = ctx.track(new THREE.MeshStandardMaterial({ color, roughness }))));
  return mat;
}
