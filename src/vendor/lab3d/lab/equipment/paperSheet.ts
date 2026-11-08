import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface PaperOptions {
  /** Kích thước tờ giấy (đơn vị cảnh). */
  width?: number;
  depth?: number;
  color?: string;
  /** Vẽ thêm lên giấy (canvas W×H px). */
  draw?(g: CanvasRenderingContext2D, W: number, H: number): void;
  resolution?: number;
  /** Giấy lọc: vân sợi + mép tròn. */
  round?: boolean;
}

/** A-GIAY – tờ giấy trắng / giấy lọc nằm phẳng trên bàn (CanvasTexture), vd. giấy kẻ chữ X (Hình 19.3), giấy lọc đặt đinh. */
export function createPaperSheet(ctx: Tracker, o: PaperOptions = {}): THREE.Mesh {
  const w = o.width ?? mm(120);
  const d = o.depth ?? w;
  const res = o.resolution ?? 512;
  const W = res;
  const H = Math.round((res * d) / w);
  const { canvas, g } = makeCanvas(W, H);
  g.fillStyle = o.color ?? '#f7f6f1';
  g.fillRect(0, 0, W, H);
  // Sợi giấy mịn.
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(120,110,90,${0.025 + Math.random() * 0.03})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1);
  }
  o.draw?.(g, W, H);
  const tex = ctx.track(canvasTexture(canvas));
  const mat = ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, alphaTest: o.round ? 0.5 : 0 }));
  if (o.round) {
    const a = makeCanvas(W, H);
    a.g.fillStyle = '#000';
    a.g.fillRect(0, 0, W, H);
    a.g.fillStyle = '#fff';
    a.g.beginPath();
    a.g.ellipse(W / 2, H / 2, W / 2 - 2, H / 2 - 2, 0, 0, Math.PI * 2);
    a.g.fill();
    mat.alphaMap = ctx.track(canvasTexture(a.canvas, false));
  }
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = mm(0.3);
  m.receiveShadow = true;
  m.name = 'paper';
  return m;
}

/** Vẽ chữ X đậm (bút dạ đen) ở giữa tờ giấy – dùng làm `draw` cho createPaperSheet. */
export function drawCrossMark(g: CanvasRenderingContext2D, W: number, H: number, size = 0.55, width = 0.06): void {
  const s = (Math.min(W, H) * size) / 2;
  g.strokeStyle = '#141414';
  g.lineCap = 'round';
  g.lineWidth = Math.min(W, H) * width;
  g.beginPath();
  g.moveTo(W / 2 - s, H / 2 - s);
  g.lineTo(W / 2 + s, H / 2 + s);
  g.moveTo(W / 2 + s, H / 2 - s);
  g.lineTo(W / 2 - s, H / 2 + s);
  g.stroke();
}
