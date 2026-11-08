import type * as THREE from 'three';
import { canvasTexture, makeCanvas, rng } from '../materials/canvas';

/** Sprite "cụm khói" mềm: nhiều đốm gradient chồng lên nhau, alpha ở kênh A. */
export function puffTexture(seed = 5): THREE.CanvasTexture {
  const S = 128;
  const { canvas, g } = makeCanvas(S, S);
  const rand = rng(seed);
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * S * 0.22;
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d;
    const r = S * (0.14 + rand() * 0.2);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${0.18 + rand() * 0.2})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  }
  // Viền tắt hẳn để không lộ ô vuông
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, S, S);
  return canvasTexture(canvas, false);
}
