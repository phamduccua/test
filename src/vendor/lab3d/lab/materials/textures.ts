import type * as THREE from 'three';
import { canvasTexture, makeCanvas, rng } from './canvas';

/** Mặt bàn epoxy/đá xám đen có lốm đốm li ti + vệt mờ (map + roughnessMap). */
export function epoxyTextures(base = '#202429'): { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  const S = 1024;
  const { canvas, g } = makeCanvas(S, S);
  const r = makeCanvas(S, S);
  const rand = rng(7);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  r.g.fillStyle = '#5a5a5a';
  r.g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const rad = 40 + rand() * 160;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.025 + rand() * 0.04;
    grad.addColorStop(0, rand() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.5})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 14000; i++) {
    const v = 120 + rand() * 120;
    g.fillStyle = `rgba(${v},${v},${v + 6},${0.08 + rand() * 0.18})`;
    g.fillRect(rand() * S, rand() * S, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
  for (let i = 0; i < 40; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const rad = 30 + rand() * 120;
    const grad = r.g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(${rand() > 0.5 ? 120 : 40},90,90,0.35)`);
    grad.addColorStop(1, 'rgba(90,90,90,0)');
    r.g.fillStyle = grad;
    r.g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return { map: canvasTexture(canvas, true, [2, 1]), rough: canvasTexture(r.canvas, false, [2, 1]) };
}

/** Vân gỗ (sáng ấm). */
export function woodTexture(light = '#c99a63', dark = '#8a5a2f', seed = 3): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const { canvas, g } = makeCanvas(W, H);
  const rand = rng(seed);
  g.fillStyle = light;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const y0 = rand() * H;
    const amp = 4 + rand() * 14;
    const freq = 0.004 + rand() * 0.01;
    g.strokeStyle = dark;
    g.globalAlpha = 0.08 + rand() * 0.22;
    g.lineWidth = 0.6 + rand() * 2.5;
    g.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = y0 + Math.sin(x * freq + i) * amp + Math.sin(x * freq * 3.1) * amp * 0.25;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  return canvasTexture(canvas, true);
}

/** Gạch men tường / sàn: ô vuông với ron mảnh. */
export function tileTexture(fill: string, grout: string, tiles = 8, noise = 0.03): THREE.CanvasTexture {
  const S = 512;
  const { canvas, g } = makeCanvas(S, S);
  const rand = rng(11);
  const step = S / tiles;
  for (let i = 0; i < tiles; i++) {
    for (let j = 0; j < tiles; j++) {
      g.fillStyle = fill;
      g.fillRect(i * step, j * step, step, step);
      g.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${rand() * noise})`;
      g.fillRect(i * step, j * step, step, step);
    }
  }
  g.strokeStyle = grout;
  g.lineWidth = 2;
  for (let i = 0; i <= tiles; i++) {
    g.beginPath();
    g.moveTo(i * step, 0);
    g.lineTo(i * step, S);
    g.moveTo(0, i * step);
    g.lineTo(S, i * step);
    g.stroke();
  }
  return canvasTexture(canvas, true);
}
