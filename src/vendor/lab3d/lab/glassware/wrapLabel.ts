import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface WrapLabelOptions {
  /** Bán kính ngoài của dụng cụ tại chỗ dán (đv cảnh). */
  radius: number;
  /** Chiều cao nhãn (đv cảnh, mặc định 22 mm). */
  height?: number;
  /** Góc ôm (rad, mặc định 1,9). */
  arc?: number;
  /** Màu dải trên / nền / chữ. */
  stripe?: string;
  paper?: string;
  ink?: string;
  sublabel?: string;
}

export interface WrapLabel {
  mesh: THREE.Mesh;
  /** Vẽ lại chữ (vd. đổi nhãn "Ống 1" ↔ "NaCl"). */
  setText(text: string, sublabel?: string, stripe?: string): void;
}

/**
 * Nhãn giấy dán cong quanh ống nghiệm/lọ (decal CanvasTexture trên mảnh trụ hở), quay về +z.
 * Đặt `mesh.position.y` = độ cao tâm nhãn và thêm vào `vessel.group`. Nhãn đục, nằm NGOÀI kính.
 */
export function createWrapLabel(ctx: Tracker, text: string, o: WrapLabelOptions): WrapLabel {
  const h = o.height ?? mm(22);
  const arc = o.arc ?? 1.9;
  const W = 512;
  const H = Math.max(64, Math.round((W * h) / (o.radius * arc)));
  const { canvas, g } = makeCanvas(W, Math.min(512, H));
  const tex = ctx.track(canvasTexture(canvas));
  const mat = ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
  const geo = new THREE.CylinderGeometry(o.radius, o.radius, h, 32, 1, true, -arc / 2, arc);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'wrap-label';
  const draw = (t: string, sub = o.sublabel, stripe = o.stripe ?? '#1f5fbf') => {
    const ch = canvas.height;
    g.fillStyle = o.paper ?? '#fbf8ef';
    g.fillRect(0, 0, W, ch);
    g.fillStyle = stripe;
    g.fillRect(0, 0, W, ch * 0.14);
    g.fillRect(0, ch * 0.93, W, ch * 0.07);
    g.fillStyle = o.ink ?? '#16202c';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const big = Math.min(ch * (sub ? 0.42 : 0.55), (W * 1.5) / Math.max(3, t.length));
    g.font = `700 ${big}px system-ui, sans-serif`;
    g.fillText(t, W / 2, ch * (sub ? 0.44 : 0.54));
    if (sub) {
      g.font = `500 ${ch * 0.2}px system-ui, sans-serif`;
      g.fillStyle = '#4a5160';
      g.fillText(sub, W / 2, ch * 0.77);
    }
    tex.needsUpdate = true;
  };
  draw(text);
  return {
    mesh,
    setText(t, sub, stripe) {
      draw(t, sub, stripe);
    },
  };
}
