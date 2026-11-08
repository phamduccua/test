import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';

/** Hàm thêm hộp bo góc (tâm x, y, z) vào `parent` – dùng chung cho vỏ tủ / máy. */
export type BoxAdder = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent?: THREE.Object3D) => THREE.Mesh;

/** Tạo hàm `box(...)`: RoundedBoxGeometry bán kính ≤ `radius` (tự thu nhỏ theo cạnh), đổ + nhận bóng. */
export function boxAdder(ctx: Tracker, group: THREE.Object3D, radius = 0.03): BoxAdder {
  return (w, h, d, x, y, z, m, parent = group) => {
    const mesh = new THREE.Mesh(ctx.track(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4))), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
}

/** Màn LED/LCD vẽ bằng canvas (không tone map → số sáng rõ). `draw(g, w, h)` vẽ lại + cập nhật texture. */
export interface Lcd {
  mesh: THREE.Mesh;
  draw(paint: (g: CanvasRenderingContext2D, w: number, h: number) => void): void;
}

export function createLcd(ctx: Tracker, width: number, height: number, px = 256): Lcd {
  const ph = Math.max(16, Math.round((px * height) / width));
  const { canvas, g } = makeCanvas(px, ph);
  const tex = ctx.track(canvasTexture(canvas));
  const mesh = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(width, height)), ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  mesh.name = 'lcd';
  return {
    mesh,
    draw(paint) {
      g.save();
      paint(g, px, ph);
      g.restore();
      tex.needsUpdate = true;
    },
  };
}

/** Đèn LED tròn trên bảng điều khiển: bật = màu, tắt = xám. */
export function drawLed(g: CanvasRenderingContext2D, x: number, y: number, r: number, on: boolean, color: string): void {
  g.fillStyle = on ? color : '#5c646d';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** Kính cửa/kính chắn dạng `transparent` (không transmission) – thấy đĩa/ống (transmission) bên trong. */
export function cabinetGlass(ctx: Tracker, opacity = 0.16): THREE.MeshPhysicalMaterial {
  return ctx.track(
    new THREE.MeshPhysicalMaterial({ color: 0xcfe2ea, roughness: 0.05, metalness: 0, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }),
  );
}
