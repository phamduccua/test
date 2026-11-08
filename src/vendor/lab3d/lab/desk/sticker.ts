import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { accentColor, LAB_PALETTE, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface StickerOptions {
  text?: string;
  sub?: string;
  /** Rộng × cao (mm). Mặc định 30 × 16. */
  width?: number;
  height?: number;
  /** Viền / dải màu nhận diện. Mặc định 'blue'. */
  color?: LabAccent | string;
  /** Tròn (nhãn chấm trên nắp đĩa petri, nắp ống) thay vì chữ nhật. */
  round?: boolean;
}

export interface Sticker {
  mesh: THREE.Mesh;
  setText(text: string, sub?: string, color?: LabAccent | string): void;
}

/**
 * A-NHAN-DAN: nhãn giấy dán phẳng (chữ đậm + dòng phụ, viền màu nhận diện). Nằm ngửa (pháp tuyến +y) – dán lên nắp/hộp;
 * dán mặt đứng thì `mesh.rotation.x = Math.PI / 2`. Nhãn dán quanh thân tròn: `createWrapLabel`.
 */
export function createSticker(ctx: Tracker, o: StickerOptions = {}): Sticker {
  const w = o.width ?? (o.round ? 22 : 30);
  const h = o.round ? w : (o.height ?? 16);
  const S = 256;
  const { canvas, g } = makeCanvas(S, Math.round((S * h) / w));
  const tex = ctx.track(canvasTexture(canvas));
  const mat = ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, transparent: !!o.round, polygonOffset: true, polygonOffsetFactor: -2 }));
  const geo = o.round ? new THREE.CircleGeometry(mm(w / 2), 40) : new THREE.PlaneGeometry(mm(w), mm(h));
  const mesh = new THREE.Mesh(ctx.track(geo.rotateX(-Math.PI / 2)), mat);
  mesh.name = 'sticker';
  mesh.position.y = mm(0.3);
  mesh.receiveShadow = true;
  const api: Sticker = {
    mesh,
    setText(text, sub, color = o.color ?? 'blue') {
      const cw = canvas.width;
      const ch = canvas.height;
      const c = accentColor(color);
      g.clearRect(0, 0, cw, ch);
      g.fillStyle = c;
      if (o.round) {
        g.beginPath();
        g.arc(cw / 2, ch / 2, cw / 2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = LAB_PALETTE.label;
        g.beginPath();
        g.arc(cw / 2, ch / 2, cw / 2 - 18, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillRect(0, 0, cw, ch);
        g.fillStyle = LAB_PALETTE.label;
        g.fillRect(10, 10, cw - 20, ch - 20);
        g.fillStyle = c;
        g.fillRect(10, 10, 18, ch - 20);
      }
      g.fillStyle = LAB_PALETTE.trim;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const x = o.round ? cw / 2 : cw / 2 + 9;
      const fs = Math.round(ch * (sub ? 0.36 : 0.46) * (o.round ? 0.75 : 1));
      g.font = `800 ${fs}px system-ui, sans-serif`;
      const tw = g.measureText(text).width;
      const max = cw * (o.round ? 0.7 : 0.78);
      if (tw > max) g.font = `800 ${Math.floor((fs * max) / tw)}px system-ui, sans-serif`;
      g.fillText(text, x, ch * (sub ? 0.4 : 0.52));
      if (sub) {
        g.font = `600 ${Math.round(fs * 0.55)}px system-ui, sans-serif`;
        g.fillStyle = '#4b5562';
        g.fillText(sub, x, ch * 0.72);
      }
      tex.needsUpdate = true;
    },
  };
  api.setText(o.text ?? '', o.sub);
  return api;
}
