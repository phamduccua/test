import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';

const textures = new WeakMap<object, THREE.Texture>();

function shadowTexture(ctx: Tracker): THREE.Texture {
  let t = textures.get(ctx);
  if (t) return t;
  const S = 128;
  const { canvas, g } = makeCanvas(S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  t = ctx.track(canvasTexture(canvas));
  textures.set(ctx, t);
  return t;
}

/**
 * Bóng tiếp xúc giả (đĩa gradient tối) dưới dụng cụ – cần cho thuỷ tinh vì kính không đổ bóng thật.
 * Đặt ở y ≈ +0,5 mm trong toạ độ dụng cụ.
 */
export function createContactShadow(ctx: Tracker, radius: number, opacity = 0.55, stretch = 1): THREE.Mesh {
  const mat = ctx.track(
    new THREE.MeshBasicMaterial({ map: shadowTexture(ctx), transparent: true, opacity, depthWrite: false, toneMapped: false }),
  );
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2 * stretch), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.0005;
  m.renderOrder = -10;
  m.name = 'contact-shadow';
  m.raycast = () => {};
  return m;
}
