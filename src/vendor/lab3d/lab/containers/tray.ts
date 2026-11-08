import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { shadowed, type Accent } from './common';

export interface TrayOptions {
  /** Kích thước ngoài (mm). Mặc định 300 × 220 × 25. */
  width?: number;
  depth?: number;
  height?: number;
  wall?: number;
  /**
   * 'enamel' = khay men ngà viền màu (mặc định), 'plastic' = khay nhựa màu `color`, 'steel' = inox viền tối,
   * 'foam' = khay xốp. Không có khay trắng tinh – thân luôn tối/ngà hơn mặt bàn hoặc có viền màu.
   */
  material?: 'enamel' | 'plastic' | 'steel' | 'foam';
  /** Màu viền (men/inox/xốp) hoặc thân (nhựa). Mặc định 'blue'. */
  color?: Accent;
  /** Lớp phủ đáy: màu (sáp mổ '#3a3833', khăn ướt '#7e9b8a'…). */
  floor?: THREE.ColorRepresentation;
}

export interface Tray {
  group: THREE.Group;
  /** Mặt đáy trong (đặt vật lên). */
  floorY: number;
  /** Kích thước lòng khay (đv cảnh). */
  inner: { width: number; depth: number };
  /** Lưới chỗ đặt `cols × rows` trên đáy (cục bộ khay, y = floorY), cách thành `margin` (đv). */
  slots(cols: number, rows: number, margin?: number): THREE.Vector3[];
}

/** A-KHAY – khay chữ nhật thành thấp (khay men, khay nhựa, khay mổ có sáp, khay xốp). Gốc ở tâm đáy ngoài. */
export function createTray(ctx: Tracker, o: TrayOptions = {}): Tray {
  const mats = labMaterials(ctx);
  const W = mm(o.width ?? 300);
  const D = mm(o.depth ?? 220);
  const H = mm(o.height ?? 25);
  const t = mm(o.wall ?? 4);
  const kind = o.material ?? 'enamel';
  const color = o.color ?? 'blue';
  const body = kind === 'enamel' ? mats.ceramic() : kind === 'steel' ? mats.steel() : kind === 'foam' ? mats.foam() : mats.plastic(color);
  const rimMat = kind === 'plastic' ? body : kind === 'steel' ? mats.trim() : mats.plastic(color);
  const group = new THREE.Group();
  group.name = `tray-${kind}`;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
    const b = shadowed(new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w, h, d)), m));
    b.position.set(x, y, z);
    group.add(b);
    return b;
  };
  // Lòng khay men xám xanh – đáy không loá trắng dưới đèn bàn.
  const bottom = kind === 'enamel' ? ctx.track(new THREE.MeshPhysicalMaterial({ color: '#8796a3', roughness: 0.35, clearcoat: 0.4 })) : body;
  box(W, t, D, 0, t / 2, 0, bottom);
  for (const s of [-1, 1]) {
    box(W, H, t, 0, H / 2, s * (D / 2 - t / 2), body);
    box(t, H, D - 2 * t, s * (W / 2 - t / 2), H / 2, 0, body);
    // Viền mép (gờ cuộn) màu nhận diện.
    const r = mm(2.5);
    box(W + r, r, t + r, 0, H + r / 2, s * (D / 2 - t / 2), rimMat);
    box(t + r, r, D - t, s * (W / 2 - t / 2), H + r / 2, 0, rimMat);
  }
  let floorY = t;
  if (o.floor !== undefined) {
    const m = ctx.track(new THREE.MeshStandardMaterial({ color: o.floor, roughness: 0.6 }));
    box(W - 2 * t, mm(2), D - 2 * t, 0, t + mm(1), 0, m);
    floorY = t + mm(2);
  }
  const inner = { width: W - 2 * t, depth: D - 2 * t };
  return {
    group, floorY, inner,
    slots(cols, rows, margin = mm(10)) {
      const out: THREE.Vector3[] = [];
      const sx = (inner.width - 2 * margin) / cols;
      const sz = (inner.depth - 2 * margin) / rows;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) out.push(new THREE.Vector3(-inner.width / 2 + margin + sx * (i + 0.5), floorY, -inner.depth / 2 + margin + sz * (j + 0.5)));
      return out;
    },
  };
}

/** Vân nan tre đan nong mốt. */
function weaveTexture(): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(512, 512);
  g.fillStyle = '#9a7340';
  g.fillRect(0, 0, 512, 512);
  const s = 32;
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++) {
      const horiz = (i + j) % 2 === 0;
      g.fillStyle = horiz ? '#c9a066' : '#b58b52';
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      g.strokeStyle = 'rgba(80,50,15,.4)';
      g.beginPath();
      for (let k = 6; k < s; k += 8) {
        if (horiz) {
          g.moveTo(i * s + 3, j * s + k);
          g.lineTo(i * s + s - 3, j * s + k);
        } else {
          g.moveTo(i * s + k, j * s + 3);
          g.lineTo(i * s + k, j * s + s - 3);
        }
      }
      g.stroke();
    }
  return canvasTexture(canvas, true, [3, 3]);
}

/** A-MET – mẹt/nia tre đan tròn Ø 440 mm, vành tre nâu đậm. Gốc ở tâm đáy; `topY` = mặt mẹt. */
export function createWovenTray(ctx: Tracker, o: { diameter?: number } = {}): { group: THREE.Group; topY: number; radius: number } {
  const R = mm((o.diameter ?? 440) / 2);
  const group = new THREE.Group();
  group.name = 'woven-tray';
  const mat = ctx.track(new THREE.MeshStandardMaterial({ map: ctx.track(weaveTexture()), roughness: 0.85 }));
  const base = shadowed(new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(R, R * 0.98, mm(10), 64)), mat));
  base.position.y = mm(5);
  const rim = shadowed(new THREE.Mesh(ctx.track(new THREE.TorusGeometry(R, mm(14), 10, 72)), ctx.track(new THREE.MeshStandardMaterial({ color: 0x7a5426, roughness: 0.7 }))));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = mm(14);
  group.add(base, rim);
  return { group, topY: mm(10), radius: R - mm(14) };
}
