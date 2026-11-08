import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, handleMaterial, type HandTool, type HandleColor, toolSteel } from './common';

/** Góc mở hẳn của tay trên (rad). */
export const GARLIC_PRESS_OPEN = 1.1;

export interface GarlicPressOptions {
  /** Màu bọc tay cầm (mặc định 'red'; TN-094-01 cũ: 'dark'). */
  grips?: HandleColor;
}

export interface GarlicPress extends HandTool {
  /** Khoang ép: gắn tép tỏi/lõi quả vào đây (đáy khoang y = 0). */
  chamber: THREE.Group;
  /** Tay trên (quay quanh bản lề) – con của group. */
  arm: THREE.Group;
  /** 0 = mở hẳn, 1 = ép kín. */
  setClose(t: number): void;
}

/** Đáy khoang: thép có lưới lỗ nhỏ (nước ép chảy qua). */
function holesTexture(): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(128, 96);
  g.fillStyle = '#b9bec6';
  g.fillRect(0, 0, 128, 96);
  g.fillStyle = '#2a2d33';
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 8; c++) {
      g.beginPath();
      g.arc(10 + c * 15 + (r % 2) * 7, 10 + r * 15, 3.2, 0, Math.PI * 2);
      g.fill();
    }
  return canvas;
}

/**
 * A-DUNG-CU-EP – dụng cụ ép tỏi/ép quả inox ≈ 180 mm: khoang 38 × 28 × 24 mm đáy lỗ ở tay dưới, chày ép ở tay trên, bản lề phía +x,
 * tay cầm bọc nhựa màu. Gốc = giữa đáy khoang (lỗ ra nước), tay cầm hướng −x. `tip` = dưới đáy lỗ (chỗ nước ép nhỏ xuống),
 * `grip` = giữa tay cầm dưới.
 */
export function createGarlicPress(ctx: Tracker, o: GarlicPressOptions = {}): GarlicPress {
  const steel = toolSteel(ctx);
  const grip = handleMaterial(ctx, o.grips ?? 'red');
  const group = new THREE.Group();
  group.name = 'garlic-press';
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D) => {
    const b = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(w), mm(h), mm(d))), mat);
    b.position.set(mm(x), mm(y), mm(z));
    b.castShadow = true;
    parent.add(b);
    return b;
  };
  const chamber = new THREE.Group();
  chamber.name = 'chamber';
  group.add(chamber);
  const floorMat = ctx.track(new THREE.MeshStandardMaterial({ map: ctx.track(canvasTexture(holesTexture())), metalness: 0.6, roughness: 0.35 }));
  box(38, 2, 28, 0, 1, 0, floorMat, chamber);
  box(38, 24, 2.5, 0, 12, 12.75, steel, chamber);
  box(38, 24, 2.5, 0, 12, -12.75, steel, chamber);
  box(2.5, 24, 28, 17.75, 12, 0, steel, chamber);
  box(2.5, 24, 28, -17.75, 12, 0, steel, chamber);
  // Tay dưới (liền khoang) + bọc nhựa; tai bản lề.
  box(110, 7, 16, -74, 20, 0, steel, group);
  box(70, 10, 19, -100, 20, 0, grip, group);
  box(8, 12, 30, 22, 24, 0, steel, group);
  // Tay trên quay quanh bản lề (x = 22, y = 30 mm): chày + cần nối + tay cầm.
  const arm = new THREE.Group();
  arm.name = 'arm';
  arm.position.set(mm(22), mm(30), 0);
  group.add(arm);
  box(32, 18, 22, -22, -12, 0, steel, arm);
  box(40, 6, 20, -20, 0, 0, steel, arm);
  box(110, 7, 16, -96, 4, 0, steel, arm);
  box(70, 10, 19, -122, 4, 0, grip, arm);
  const p: GarlicPress = {
    group,
    chamber,
    arm,
    tip: anchor(group, 'tip', 0, -mm(1)),
    grip: anchor(group, 'grip', -mm(100), mm(20)),
    setClose(t) {
      arm.rotation.z = -GARLIC_PRESS_OPEN * (1 - THREE.MathUtils.clamp(t, 0, 1));
    },
  };
  p.setClose(0);
  return p;
}
