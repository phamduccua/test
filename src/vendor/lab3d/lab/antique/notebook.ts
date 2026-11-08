import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';

/**
 * Sổ ghi chép mở (bìa da, hai trang giấy ngà hơi võng ở gáy). Nội dung hai trang vẽ bằng canvas `draw(g, W, H)`
 * (trang trái 0…W/2, trang phải W/2…W) – gọi `redraw` khi có dòng ghi mới. Gốc ở tâm đáy, gáy theo z. Đơn vị dm.
 */
export interface OpenNotebook {
  group: THREE.Group;
  redraw(draw: (g: CanvasRenderingContext2D, W: number, H: number) => void): void;
}

export function createOpenNotebook(ctx: Tracker, o: { width?: number; depth?: number } = {}): OpenNotebook {
  const W = o.width ?? 2.4;
  const D = o.depth ?? 1.6;
  const CW = 1536;
  const CH = Math.round((CW * D) / W);
  const { canvas, g } = makeCanvas(CW, CH);
  const tex = ctx.track(canvasTexture(canvas));
  const group = new THREE.Group();
  group.name = 'notebook';
  const cover = new THREE.Mesh(
    ctx.track(new THREE.BoxGeometry(W + 0.08, 0.03, D + 0.08)),
    ctx.track(new THREE.MeshStandardMaterial({ color: '#4a2817', roughness: 0.7 })),
  );
  cover.position.y = 0.015;
  cover.castShadow = cover.receiveShadow = true;
  // Tập giấy: lưới võng nhẹ về gáy (x = 0), mặt trên mang texture.
  const block = new THREE.Mesh(
    ctx.track(new THREE.BoxGeometry(W, 0.05, D)),
    ctx.track(new THREE.MeshStandardMaterial({ color: '#e9dfc6', roughness: 0.9 })),
  );
  block.position.y = 0.055;
  const geo = new THREE.PlaneGeometry(W, D, 48, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = Math.abs(pos.getX(i)) / (W / 2);
    pos.setZ(i, 0.006 + 0.03 * Math.sin(Math.min(1, x * 1.3) * Math.PI * 0.5));
  }
  geo.computeVertexNormals();
  const page = new THREE.Mesh(ctx.track(geo), ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 })));
  page.rotation.x = -Math.PI / 2;
  page.position.y = 0.08;
  page.receiveShadow = true;
  group.add(cover, block, page);
  const paperBase = () => {
    const grad = g.createLinearGradient(0, 0, CW, 0);
    grad.addColorStop(0, '#efe5cc');
    grad.addColorStop(0.47, '#e2d5b4');
    grad.addColorStop(0.5, '#c9b88f');
    grad.addColorStop(0.53, '#e2d5b4');
    grad.addColorStop(1, '#efe5cc');
    g.fillStyle = grad;
    g.fillRect(0, 0, CW, CH);
    g.strokeStyle = 'rgba(90,110,150,0.22)';
    g.lineWidth = 2;
    for (let y = 120; y < CH - 30; y += 52) {
      g.beginPath();
      g.moveTo(40, y);
      g.lineTo(CW / 2 - 30, y);
      g.moveTo(CW / 2 + 30, y);
      g.lineTo(CW - 40, y);
      g.stroke();
    }
  };
  return {
    group,
    redraw(draw) {
      paperBase();
      draw(g, CW, CH);
      tex.needsUpdate = true;
    },
  };
}
