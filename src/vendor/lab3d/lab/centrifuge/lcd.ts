import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';
import { labText } from '../../text';
import { uiFont } from '../../ui/tokens';

/** Trạng thái hiển thị trên màn hình máy li tâm. */
export interface CentrifugeDisplay {
  rpm: number;
  rcf: number;
  /** Giây còn lại (hoặc đặt trước khi chưa chạy). */
  seconds: number;
  status: string;
  alarm?: boolean;
  lidOpen?: boolean;
}

const fmt = (x: number) => Math.round(x).toLocaleString('vi-VN');
const clock = (s: number) => {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Màn LCD (CanvasTexture) – mặt phẳng `mesh` rộng `w` (dm), tỉ lệ 2:1. */
export function createCentrifugeLcd(ctx: Tracker, w = 1.1) {
  const { canvas, g } = makeCanvas(512, 256);
  const tex = ctx.track(canvasTexture(canvas));
  const mat = ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), mat);
  let last = '';
  const draw = (d: CentrifugeDisplay, blink: boolean) => {
    const key = `${fmt(d.rpm)}|${fmt(d.rcf)}|${clock(d.seconds)}|${d.status}|${d.alarm && blink}|${d.lidOpen}`;
    if (key === last) return;
    last = key;
    g.fillStyle = d.alarm && blink ? '#4a0d0d' : '#0b1a24';
    g.fillRect(0, 0, 512, 256);
    // Năm hàng không chồng nhau: nhãn tốc độ · nắp | vòng/phút (số lớn + đơn vị) | nhãn lực · thời gian | ×g · giờ:phút:giây | trạng thái.
    const mono = (px: number) => `700 ${px}px ui-monospace, monospace`;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#7fd8ff';
    g.font = uiFont(22, 500);
    g.fillText(labText('t_bc5d00c5b1e0'), 22, 34);
    g.fillText(labText('t_3aad71a85bab'), 22, 134);
    g.fillText(labText('t_44bec287679d'), 300, 134);
    g.fillStyle = '#e8f7ff';
    g.font = mono(52);
    const rpm = fmt(d.rpm);
    g.fillText(rpm, 22, 92);
    const unitX = 22 + g.measureText(rpm).width + 12;
    g.font = uiFont(22, 500);
    g.fillText(labText('t_2147dee355e5'), unitX, 92);
    g.font = mono(38);
    g.fillText(`${fmt(d.rcf)}${labText('t_e93eaf6aa073')}`, 22, 178);
    g.fillText(clock(d.seconds), 300, 178);
    g.fillStyle = d.alarm ? '#ff6b6b' : '#9cff9c';
    g.font = uiFont(26, 700);
    g.fillText(d.status, 22, 230);
    g.fillStyle = d.lidOpen ? '#ffd27a' : '#6f8a99';
    g.font = uiFont(20, 500);
    g.textAlign = 'right';
    g.fillText(d.lidOpen ? labText('t_593f0c2da79d') : labText('t_18015cff6df2'), 490, 34);
    g.textAlign = 'left';
    tex.needsUpdate = true;
  };
  let t = 0;
  let cur: CentrifugeDisplay = { rpm: 0, rcf: 0, seconds: 0, status: labText('t_5c390eb11c5c') };
  return {
    mesh,
    set(d: CentrifugeDisplay) {
      cur = d;
      draw(cur, true);
    },
    update(dt: number) {
      t += dt;
      draw(cur, Math.floor(t * 2.5) % 2 === 0);
    },
  };
}
