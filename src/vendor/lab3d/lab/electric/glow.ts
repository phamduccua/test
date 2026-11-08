import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';

const cache = new WeakMap<object, THREE.Texture>();

/** Texture quầng sáng tròn (lõi đậm, tắt dần mềm) – dùng chung theo ctx. */
export function haloTexture(ctx: Tracker): THREE.Texture {
  const hit = cache.get(ctx);
  if (hit) return hit;
  const S = 128;
  const { canvas, g } = makeCanvas(S, S);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  grd.addColorStop(0.7, 'rgba(255,255,255,0.05)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const tex = ctx.track(canvasTexture(canvas));
  cache.set(ctx, tex);
  return tex;
}

/** Sprite quầng sáng cộng màu (kiểu bloom, không cần post-processing). Đặt `material.opacity` để điều chỉnh. */
export function createHalo(ctx: Tracker, color: THREE.ColorRepresentation, size: number): THREE.Sprite {
  const mat = ctx.track(
    new THREE.SpriteMaterial({
      map: haloTexture(ctx),
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  s.renderOrder = 20;
  return s;
}
