import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createWoodMaterial } from '../materials/factories';
import type { Tracker } from '../types';

/**
 * A-TIEU-BAN-CO: lam kính 76 × 26 mm kiểu thế kỉ 19, mặt trên dán giấy hoa văn, cửa sổ tròn ở giữa lộ mẫu, chữ viết tay hai bên.
 * Gốc ở tâm đáy, dài theo x. Đơn vị dm.
 */
export interface PaperSlideOptions {
  /** Dòng chữ chính (tên mẫu) và dòng phụ (người / năm). */
  title: string;
  sub?: string;
  /** Màu mẫu trong cửa sổ tròn. */
  specimen: string;
  /** Màu giấy dán. */
  paper?: string;
}

export const SLIDE_SIZE = { length: 0.76, width: 0.26, thickness: 0.014 } as const;

function slideTexture(o: PaperSlideOptions): THREE.CanvasTexture {
  const W = 760;
  const H = 260;
  const { canvas, g } = makeCanvas(W, H);
  g.fillStyle = o.paper ?? '#e9dcc0';
  g.fillRect(0, 0, W, H);
  // Viền kép và hoa văn chấm như giấy dán lam cổ.
  g.strokeStyle = '#7a5a2e';
  g.lineWidth = 6;
  g.strokeRect(10, 10, W - 20, H - 20);
  g.lineWidth = 2;
  g.strokeRect(22, 22, W - 44, H - 44);
  g.fillStyle = '#7a5a2e';
  for (let x = 40; x < W - 30; x += 22) [32, H - 32].forEach((y) => g.fillRect(x, y - 1.5, 3, 3));
  // Cửa sổ tròn có mẫu (vòng đậm ở mép như mẫu ép dưới lamen tròn).
  const cx = W / 2;
  const cy = H / 2;
  g.fillStyle = '#f7f4ec';
  g.beginPath();
  g.arc(cx, cy, 82, 0, Math.PI * 2);
  g.fill();
  const grad = g.createRadialGradient(cx, cy, 10, cx, cy, 62);
  grad.addColorStop(0, o.specimen);
  grad.addColorStop(1, 'rgba(255,255,255,0.15)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, 64, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#3d2a14';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(cx, cy, 82, 0, Math.PI * 2);
  g.stroke();
  // Chữ viết tay hai bên cửa sổ.
  g.fillStyle = '#2b1d0e';
  g.textAlign = 'center';
  const words = o.title.split(' ');
  const half = Math.ceil(words.length / 2);
  g.font = 'italic 600 34px Georgia, serif';
  g.fillText(words.slice(0, half).join(' '), 160, 122, 220);
  g.fillText(words.slice(half).join(' '), 160, 162, 220);
  g.font = 'italic 28px Georgia, serif';
  (o.sub ?? '').split('|').forEach((s, i) => g.fillText(s.trim(), W - 160, 122 + i * 40, 220));
  return canvasTexture(canvas);
}

export function createPaperSlide(ctx: Tracker, o: PaperSlideOptions): THREE.Group {
  const { length: L, width: Wd, thickness: T } = SLIDE_SIZE;
  const group = new THREE.Group();
  group.name = 'paper-slide';
  const edge = ctx.track(new THREE.MeshStandardMaterial({ color: '#cfe0dc', roughness: 0.15, metalness: 0.1 }));
  const top = ctx.track(new THREE.MeshStandardMaterial({ map: ctx.track(slideTexture(o)), roughness: 0.8 }));
  const geo = ctx.track(new THREE.BoxGeometry(L, T, Wd));
  // Mặt +y (chỉ số 2) dán giấy; các mặt còn lại là cạnh kính.
  const mesh = new THREE.Mesh(geo, [edge, edge, top, edge, edge, edge]);
  mesh.position.y = T / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}

/** Khay gỗ nông có `slots` ngăn xếp lam nằm ngang, ngăn chạy theo z. Trả về vị trí (toạ độ khay) tâm đáy từng ngăn. */
export function createSlideTray(ctx: Tracker, slots: number): { group: THREE.Group; slots: THREE.Vector3[] } {
  const pitch = SLIDE_SIZE.width + 0.06;
  const W = SLIDE_SIZE.length + 0.12;
  const D = pitch * slots + 0.08;
  const wood = ctx.track(createWoodMaterial('#8a5a32', '#4f2f17', 11));
  const group = new THREE.Group();
  group.name = 'slide-tray';
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w, h, d)), wood);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  };
  box(W, 0.03, D, 0, 0.015, 0);
  box(W, 0.07, 0.04, 0, 0.035, -D / 2 + 0.02);
  box(W, 0.07, 0.04, 0, 0.035, D / 2 - 0.02);
  box(0.04, 0.07, D, -W / 2 + 0.02, 0.035, 0);
  box(0.04, 0.07, D, W / 2 - 0.02, 0.035, 0);
  const list: THREE.Vector3[] = [];
  for (let i = 0; i < slots; i++) {
    const z = -D / 2 + 0.04 + pitch * (i + 0.5);
    if (i > 0) box(W - 0.08, 0.035, 0.012, 0, 0.047, z - pitch / 2);
    list.push(new THREE.Vector3(0, 0.03, z));
  }
  return { group, slots: list };
}
