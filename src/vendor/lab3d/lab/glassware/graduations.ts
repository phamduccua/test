import * as THREE from 'three';
import { makeCanvas, canvasTexture } from '../materials/canvas';
import { labMaterialLook } from '../materials/look';
import type { Tracker } from '../types';
import { mm } from '../units';
import { radiusAt, type VesselProfile } from './profile';
import { RENDER_ORDER } from './vessel';

export interface GradMark {
  y: number;
  major?: boolean;
  label?: string;
}

export interface GraduationOptions {
  marks: GradMark[];
  /** Góc phủ (rad) quanh mặt trước (+z). */
  arc?: number;
  color?: string;
  /** Chữ in thêm (vd. "250 mL") ở gần miệng. */
  title?: string;
}

/** Vạch chia men trắng in trên một lớp vỏ mỏng sát mặt ngoài (CanvasTexture, alphaTest). */
export function createGraduations(ctx: Tracker, profile: VesselProfile, o: GraduationOptions): THREE.Mesh {
  const ys = o.marks.map((m) => m.y);
  const y0 = Math.min(...ys) - mm(4);
  const y1 = Math.max(...ys) + mm(o.title ? 14 : 4);
  const arcLen = o.arc ?? 1.1;
  const rows = 24;
  const cols = 24;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const y = y0 + ((y1 - y0) * j) / rows;
    const r = radiusAt(profile.outer, y) + mm(0.25);
    for (let i = 0; i <= cols; i++) {
      const phi = -arcLen / 2 + (arcLen * i) / cols;
      pos.push(r * Math.sin(phi), y, r * Math.cos(phi));
      uv.push(i / cols, j / rows);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      idx.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const midR = radiusAt(profile.outer, (y0 + y1) / 2);
  const W = 512;
  const H = Math.min(2048, Math.round((W * (y1 - y0)) / (midR * arcLen)));
  const { canvas, g } = makeCanvas(W, H);
  g.fillStyle = o.color ?? '#ffffff';
  g.font = `700 ${Math.round(W * 0.085)}px system-ui, sans-serif`;
  g.textBaseline = 'middle';
  const toPx = (y: number) => (1 - (y - y0) / (y1 - y0)) * H;
  const outline = labMaterialLook().markOutline;
  const ink = g.fillStyle;
  const text = (s: string, x: number, y: number) => {
    if (outline > 0) {
      g.strokeStyle = `rgba(12,18,26,${outline})`;
      g.lineWidth = 7;
      g.lineJoin = 'round';
      g.strokeText(s, x, y);
    }
    g.fillText(s, x, y);
  };
  for (const m of o.marks) {
    const py = toPx(m.y);
    const len = m.major ? W * 0.3 : W * 0.16;
    if (outline > 0) {
      g.fillStyle = `rgba(12,18,26,${outline})`;
      g.fillRect(W * 0.32 - 3, py - 6, len + 6, 12);
      g.fillStyle = ink;
    }
    g.fillRect(W * 0.32, py - 3, len, 6);
    if (m.label) text(m.label, W * 0.32 + len + 12, py);
  }
  if (o.title) {
    g.font = `700 ${Math.round(W * 0.08)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    text(o.title, W / 2, toPx(y1 - mm(6)));
  }
  const mat = ctx.track(
    new THREE.MeshStandardMaterial({
      map: canvasTexture(canvas),
      transparent: true,
      alphaTest: 0.2,
      roughness: 0.55,
      depthWrite: false,
    }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = RENDER_ORDER.overlay;
  mesh.name = 'graduations';
  return mesh;
}
