import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { labMaterials } from '../materials/kit';
import { accentColor, LAB_PALETTE, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface LabNotebookOptions {
  /** Khổ trang (mm). Mặc định A5 148 × 210. */
  width?: number;
  depth?: number;
  /** Màu bìa (tên LAB_ACCENT hoặc mã). Mặc định 'teal'. */
  color?: LabAccent | string;
  /** Dòng tiêu đề đầu trang. */
  title?: string;
}

export interface LabNotebook {
  group: THREE.Group;
  /** Mặt trang (để gắn nhãn / camera). */
  page: THREE.Mesh;
  /** Vẽ lại nội dung trang: `draw(g, W, H)` trên nền giấy kẻ dòng (đã có tiêu đề). */
  redraw(draw?: (g: CanvasRenderingContext2D, W: number, H: number) => void): void;
}

/**
 * A-SO-GHI-CHEP: sổ ghi chép thí nghiệm gáy lò xo, lật lên (bìa màu lộ viền + gáy xoắn ở mép trên), trang giấy kẻ dòng vẽ bằng canvas.
 * Gốc ở tâm đáy, mép gáy phía −z. Sổ cổ (bìa da, hai trang): `createOpenNotebook`.
 */
export function createLabNotebook(ctx: Tracker, o: LabNotebookOptions = {}): LabNotebook {
  const mats = labMaterials(ctx);
  const W = mm(o.width ?? 148);
  const D = mm(o.depth ?? 210);
  const group = new THREE.Group();
  group.name = 'lab-notebook';
  const cover = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(W + mm(12), mm(2.5), D + mm(12))), mats.plastic(accentColor(o.color ?? 'teal')));
  cover.position.y = mm(1.25);
  cover.castShadow = cover.receiveShadow = true;
  const block = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(W, mm(6), D)), mats.paper());
  block.position.y = mm(5);
  block.castShadow = true;
  const CW = 768;
  const CH = Math.round((CW * D) / W);
  const { canvas, g } = makeCanvas(CW, CH);
  const tex = ctx.track(canvasTexture(canvas));
  const page = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2)), ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })));
  page.position.y = mm(8.1);
  page.receiveShadow = true;
  group.add(cover, block, page);
  // Gáy lò xo xoắn dọc mép trên (−z).
  const coil = ctx.track(new THREE.TorusGeometry(mm(4.5), mm(0.8), 6, 16));
  const n = Math.round((o.width ?? 148) / 7);
  for (let i = 0; i < n; i++) {
    const r = new THREE.Mesh(coil, mats.trim());
    r.rotation.y = Math.PI / 2;
    r.position.set((i / (n - 1) - 0.5) * (W - mm(10)), mm(5), -D / 2 + mm(3));
    group.add(r);
  }
  const api: LabNotebook = {
    group,
    page,
    redraw(draw) {
      g.fillStyle = LAB_PALETTE.paper;
      g.fillRect(0, 0, CW, CH);
      // Lỗ gáy + lề đỏ + dòng kẻ xanh.
      g.fillStyle = '#b5ae9e';
      for (let i = 0; i < n; i++) g.fillRect(((i + 0.5) / n) * CW - 5, 10, 10, 18);
      g.strokeStyle = 'rgba(200,55,45,0.55)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(90, 40);
      g.lineTo(90, CH);
      g.stroke();
      g.strokeStyle = 'rgba(31,95,191,0.28)';
      g.lineWidth = 2;
      for (let y = 130; y < CH - 20; y += 46) {
        g.beginPath();
        g.moveTo(20, y);
        g.lineTo(CW - 20, y);
        g.stroke();
      }
      if (o.title) {
        g.fillStyle = LAB_PALETTE.trim;
        g.font = 'bold 40px system-ui, sans-serif';
        g.textBaseline = 'alphabetic';
        g.fillText(o.title, 104, 112);
      }
      draw?.(g, CW, CH);
      tex.needsUpdate = true;
    },
  };
  api.redraw();
  return api;
}
