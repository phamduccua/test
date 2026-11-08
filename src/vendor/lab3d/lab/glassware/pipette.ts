import * as THREE from 'three';
import { createLiquidMaterial, applyLiquidLook } from '../liquid/liquidMaterial';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { chaikin, densify } from './curves';
import { buildProfile } from './profile';
import { createVessel, latheFromProfile, RENDER_ORDER } from './vessel';

export interface Pipette {
  /** Gốc ở đầu nhọn, trục +y (dùng làm `tool` của createDripAction). */
  group: THREE.Group;
  /** Quả bóp (pivot ở cổ) – truyền làm `bulb` của createDripAction. */
  bulb: THREE.Object3D;
  /** mL đang chứa (0…capacity). */
  readonly fill: number;
  capacity: number;
  setFill(ml: number): void;
  setColor(color: THREE.ColorRepresentation, density?: number): void;
}

export interface PipetteOptions {
  /** Dung tích (mL), mặc định 5. */
  capacity?: number;
  /** Đường kính ngoài thân (mm), mặc định 8. */
  diameter?: number;
  /** Chiều dài thân thuỷ tinh (mm), mặc định 260. */
  length?: number;
  color?: THREE.ColorRepresentation;
  bulbColor?: THREE.ColorRepresentation;
}

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });
const TIP = 32;

/**
 * A-PIPET – pipet thẳng chia vạch (kiểu Mohr) có quả bóp cao su: thân trụ Ø8, đầu thuôn 32 mm,
 * vạch 0 ở trên (đọc từ trên xuống), cột chất lỏng (transmission) hạ dần khi xả.
 */
export function createPipette(ctx: Tracker, o: PipetteOptions = {}): Pipette {
  const cap = o.capacity ?? 5;
  const R = (o.diameter ?? 8) / 2;
  const L = o.length ?? 260;
  const wall = 0.7;
  const rIn = mm(R - wall);
  const group = new THREE.Group();
  group.name = 'pipette';
  const outer = densify(chaikin([P(1.1, 0), P(1.3, 3), P(R, TIP), P(R, L)], 2), mm(4));
  const glass = createVessel(ctx, buildProfile(outer, mm(wall), true), { material: labMaterials(ctx).glass(), name: 'pipette-glass', segments: 28 });
  group.add(glass.group);

  // Cột chất lỏng: trụ trong lòng thân, cao theo thể tích (0,1 mL lấp phần đầu thuôn).
  const perML = mm(Math.min(150, L - TIP - 50)) / cap;
  const mat = ctx.track(createLiquidMaterial(rIn * 2));
  const look = { color: new THREE.Color(o.color ?? 0xdff3ff), density: 0.4, turbidity: 0, turbidColor: new THREE.Color(0xffffff) };
  applyLiquidLook(mat, look);
  const geo = ctx.track(new THREE.CylinderGeometry(rIn * 0.96, rIn * 0.96, 1, 18).translate(0, 0.5, 0));
  const column = new THREE.Mesh(geo, mat);
  column.renderOrder = RENDER_ORDER.liquid;
  column.position.y = mm(TIP - 6);
  group.add(column);

  // Vạch chia: mỗi 0,1 mL, vạch chính mỗi 1 mL (số đọc từ trên: 0 ở mức đầy).
  const H = perML * cap;
  const { canvas, g } = makeCanvas(64, 1024);
  g.fillStyle = '#ffffff';
  g.font = '600 30px system-ui, sans-serif';
  for (let i = 0; i <= cap * 10; i++) {
    const y = 1024 - 24 - ((1024 - 48) * i) / (cap * 10);
    const major = i % 10 === 0;
    g.fillRect(0, y - 1.5, major ? 30 : i % 5 === 0 ? 22 : 14, 3);
    if (major) g.fillText(String(cap - i / 10), 34, y + 10);
  }
  const span = H * (1024 / (1024 - 48));
  const gradMat = ctx.track(new THREE.MeshBasicMaterial({ map: canvasTexture(canvas), transparent: true, alphaTest: 0.4, depthWrite: false }));
  const grad = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(R + 0.15), mm(R + 0.15), span, 16, 1, true, -0.35, 0.7)), gradMat);
  grad.position.y = column.position.y + H / 2;
  grad.renderOrder = RENDER_ORDER.overlay;
  group.add(grad);

  // Quả bóp: pivot ở cổ, mesh hướng lên.
  const bulb = new THREE.Group();
  bulb.position.y = mm(L - 12);
  const bulbPts = chaikin([P(0, 58), P(9, 54), P(10.5, 34), P(6, 14), P(R + 0.8, 8), P(R + 0.8, 0), P(0, 0)].reverse(), 3);
  const bulbMesh = new THREE.Mesh(latheFromProfile(bulbPts, 32), ctx.track(new THREE.MeshPhysicalMaterial({ color: o.bulbColor ?? 0x262a30, roughness: 0.55, clearcoat: 0.3 })));
  bulbMesh.castShadow = true;
  bulb.add(bulbMesh);
  group.add(bulb);

  let fill = 0;
  const p: Pipette = {
    group,
    bulb,
    capacity: cap,
    get fill() {
      return fill;
    },
    setFill(ml) {
      fill = THREE.MathUtils.clamp(ml, 0, cap);
      column.visible = fill > 0.01;
      column.scale.y = Math.max(1e-4, mm(6) + fill * perML);
    },
    setColor(c, density = 0.4) {
      look.color.set(c);
      look.density = density;
      applyLiquidLook(mat, look);
    },
  };
  p.setFill(0);
  return p;
}
