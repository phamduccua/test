import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { labMaterials } from '../materials/kit';
import { accentColor, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface DeskTimerOptions {
  /** Dòng chữ nhỏ ở mép trên màn (vd. 'GIỜ Ủ', 'TIMER'). */
  title?: string;
  /** Màu nút + dải nhận diện. Mặc định 'orange'. */
  color?: LabAccent | string;
  /** Màu chữ LCD. Mặc định xanh lá. */
  ink?: string;
  /** Rộng thân (mm). Mặc định 95. */
  width?: number;
}

export interface DeskTimer {
  group: THREE.Group;
  /** Mặt màn (để gắn nhãn / camera). */
  screen: THREE.Mesh;
  /** Hiện chữ tuỳ ý + dòng phụ (tương thích TN-122-01 `clock.set`). */
  set(text: string, sub?: string): void;
  /** Hiện thời gian (giây) dạng HH:MM:SS; `sub` = dòng phụ. */
  setTime(seconds: number, sub?: string): void;
}

/** Giây → "HH:MM:SS" (giờ không giới hạn 24). */
export const hms = (s: number): string => {
  const t = Math.max(0, Math.floor(s));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
};

/** A-DONG-HO-DEM-GIO: đồng hồ đếm giờ điện tử để bàn (thân ngả ra sau, màn LCD, 3 nút màu). Gốc ở đáy, màn hướng +z. */
export function createDeskTimer(ctx: Tracker, o: DeskTimerOptions = {}): DeskTimer {
  const mats = labMaterials(ctx);
  const W = mm(o.width ?? 95);
  const H = W * 0.46;
  const Dp = W * 0.3;
  const group = new THREE.Group();
  group.name = 'desk-timer';
  const body = new THREE.Group();
  body.position.set(0, H / 2, 0);
  body.rotation.x = -0.3;
  group.add(body);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const x3 = new THREE.Mesh(ctx.track(geo), m);
    x3.position.set(x, y, z);
    x3.castShadow = true;
    body.add(x3);
    return x3;
  };
  add(new RoundedBoxGeometry(W, H, Dp, 3, Dp * 0.18), mats.device());
  // Khung màn tối + dải màu nhận diện dưới đáy.
  add(new RoundedBoxGeometry(W * 0.9, H * 0.68, mm(3), 2, mm(1.2)), mats.trim(), 0, H * 0.06, Dp / 2);
  add(new THREE.BoxGeometry(W * 1.002, H * 0.12, Dp * 1.002), mats.plastic(accentColor(o.color ?? 'orange')), 0, -H * 0.42, 0);
  for (const i of [-1, 0, 1]) {
    const b = add(new THREE.CylinderGeometry(mm(5), mm(5), mm(5), 18), i ? mats.trim() : mats.plastic(accentColor(o.color ?? 'orange')), i * W * 0.22, H / 2 + mm(1.5), -Dp * 0.1);
    b.scale.set(1, 1, 0.8);
  }
  const { canvas, g } = makeCanvas(512, Math.round((512 * 0.6) / 0.84));
  const tex = ctx.track(canvasTexture(canvas));
  const screen = add(new THREE.PlaneGeometry(W * 0.84, H * 0.6), ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })), 0, H * 0.06, Dp / 2 + mm(1.6));
  screen.castShadow = false;
  const ink = o.ink ?? '#7dffb2';
  let last = '';
  const api: DeskTimer = {
    group,
    screen,
    set(text, sub = '') {
      if (text + '|' + sub === last) return;
      last = text + '|' + sub;
      const cw = canvas.width;
      const ch = canvas.height;
      g.fillStyle = '#0d1a14';
      g.fillRect(0, 0, cw, ch);
      g.fillStyle = ink;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (o.title) {
        g.font = `600 ${Math.round(ch * 0.13)}px system-ui, sans-serif`;
        g.globalAlpha = 0.75;
        g.fillText(o.title, cw / 2, ch * 0.12);
        g.globalAlpha = 1;
      }
      const fs = Math.round(ch * (sub ? 0.42 : 0.5));
      g.font = `700 ${fs}px ui-monospace, "DejaVu Sans Mono", monospace`;
      const wq = g.measureText(text).width;
      if (wq > cw * 0.92) g.font = `700 ${Math.floor((fs * cw * 0.92) / wq)}px ui-monospace, "DejaVu Sans Mono", monospace`;
      g.fillText(text, cw / 2, ch * (sub ? 0.5 : 0.56));
      if (sub) {
        g.font = `600 ${Math.round(ch * 0.15)}px system-ui, sans-serif`;
        g.fillText(sub, cw / 2, ch * 0.84);
      }
      tex.needsUpdate = true;
    },
    setTime(s, sub) {
      api.set(hms(s), sub);
    },
  };
  api.setTime(0);
  return api;
}
