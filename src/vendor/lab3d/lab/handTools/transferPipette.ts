import * as THREE from 'three';
import { latheFromProfile } from '../glassware/vessel';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, part, type HandTool } from './common';

export interface TransferPipetteOptions {
  /** Dung tích 1 hoặc 3 mL (mặc định 3: thân Ø6 × 100 mm, quả bóp Ø14 × 43 mm). */
  volume?: 1 | 3;
  /** Màu nhựa PE mờ (mặc định '#c8d3d8' – xám xanh nhạt, không trắng). */
  tint?: THREE.ColorRepresentation;
  /** Màu vạch chia in trên thân (mặc định đen xanh). */
  ink?: string;
}

export interface TransferPipette extends HandTool {
  /** Quả bóp (pivot ở cổ) – truyền làm `bulb` của createDropperGesture/createDripAction (bóp = scale). */
  bulb: THREE.Object3D;
  /** Phần thân có dung dịch (0…1) + màu dung dịch. */
  setFill(f: number, color?: THREE.ColorRepresentation): void;
}

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });

/** Vạch in trên thân: mỗi 0,25 mL (3 mL) / 0,1 mL (1 mL), số ở mốc lớn. */
function scaleTexture(ink: string, small: boolean): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(64, 512);
  g.clearRect(0, 0, 64, 512);
  g.fillStyle = ink;
  g.font = '700 30px system-ui, sans-serif';
  const n = small ? 10 : 4;
  for (let i = 1; i <= n; i++) {
    const y = 512 - i * (480 / n);
    const major = small ? i % 5 === 0 : i % 2 === 0;
    g.fillRect(0, y - 2.5, major ? 30 : 18, 5);
    if (major) g.fillText(small ? (i === 5 ? '.5' : '1') : i === 2 ? '.5' : '1', 32, y + 11);
  }
  return canvas;
}

/**
 * A-PIPET-NHUA – pipet nhựa Pasteur (pipet chuyển mẫu PE): đầu nhọn, thân có vạch, quả bóp liền. Nhựa ĐỤC mờ (nhúng vào
 * ống nghiệm transmission vẫn thấy). Gốc ở đầu nhọn, trục +y. `tip` = đầu nhọn, `grip` = quả bóp, `setFill` = cột dịch trong thân.
 */
export function createTransferPipette(ctx: Tracker, o: TransferPipetteOptions = {}): TransferPipette {
  const small = o.volume === 1;
  const stemL = small ? 85 : 100;
  const rs = small ? 2.2 : 3;
  const col = stemL - 18;
  const tint = new THREE.Color(o.tint ?? '#c8d3d8');
  const mat = ctx.track(new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.42, clearcoat: 0.4, sheen: 0.3, side: THREE.DoubleSide }));
  const group = new THREE.Group();
  group.name = 'transfer-pipette';
  part(ctx, group, latheFromProfile([P(0, 0), P(0.9, 0), P(1.2, 4), P(rs * 0.73, 22), P(rs, 34), P(rs, stemL), P(0, stemL)], 20), mat);
  const scale = part(
    ctx,
    group,
    new THREE.CylinderGeometry(mm(rs + 0.12), mm(rs + 0.12), mm(col - 18), 14, 1, true, -0.45, 0.9),
    ctx.track(new THREE.MeshBasicMaterial({ map: ctx.track(canvasTexture(scaleTexture(o.ink ?? '#16202c', small))), transparent: true, alphaTest: 0.4 })),
    0,
    mm(34 + (col - 34) / 2 + 8),
  );
  scale.castShadow = false;
  // Cột dịch: lớp màu sát mặt trong thân (đục), cao theo lượng hút.
  const colMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0xf0d870, roughness: 0.35 }));
  const column = part(ctx, group, latheFromProfile([P(0, 0), P(1.05, 0), P(1.35, 4), P(rs * 0.78, 22), P(rs + 0.06, 34), P(rs + 0.06, col), P(0, col)], 20), colMat);
  column.castShadow = false;
  column.visible = false;
  const bulb = new THREE.Group();
  bulb.name = 'bulb';
  bulb.position.y = mm(stemL);
  const k = small ? 0.8 : 1;
  part(ctx, bulb, latheFromProfile([P(0, 0), P(rs + 0.2, 0), P(6.5 * k, 6 * k), P(7 * k, 30 * k), P(5.5 * k, 40 * k), P(0, 43 * k)], 24), mat);
  group.add(bulb);
  const tip = anchor(group, 'tip', 0);
  const grip = anchor(group, 'grip', 0, mm(stemL + 20 * k));
  return {
    group,
    tip,
    grip,
    bulb,
    setFill(f, color) {
      const c = THREE.MathUtils.clamp(f, 0, 1);
      column.visible = c > 0.01;
      column.scale.y = Math.max(0.06, c);
      // Nhìn qua nhựa mờ: màu dịch pha với màu PE.
      if (color !== undefined) colMat.color.set(color).lerp(tint, 0.25);
    },
  };
}
