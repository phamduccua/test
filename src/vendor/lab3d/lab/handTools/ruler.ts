import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createPlasticMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import { accentColor, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, part, type HandTool } from './common';

export interface LabRulerOptions {
  /** Chiều dài thang đo (mm), mặc định 150 (thước kẻ 15 cm; 200/300; thước đứng đo cây 800–1000). */
  length?: number;
  /** 'flat' = thước kẻ nằm trên bàn (mặc định); 'standing' = thước đứng có chân đế + con trượt chỉ chiều cao. */
  kind?: 'flat' | 'standing';
  /** Màu mặt thước (mặc định vàng kem '#e9d58c' – không trắng để tách khỏi mặt bàn). */
  face?: string;
  /** Dải màu nhận diện dọc mép sau + con trượt (mặc định 'blue' / con trượt 'red'). */
  accent?: LabAccent | (string & {});
  /** Đơn vị in trên thước: 'cm' (số mỗi 1 cm) | 'dm' (số mỗi 10 cm – thước dài). Mặc định tự chọn theo chiều dài. */
  numbers?: 'cm' | 'dm';
}

export interface LabRuler extends HandTool {
  /** Vạch 0 (con của group, ở gốc). */
  zero: THREE.Object3D;
  /** Vị trí vạch `v` mm (toạ độ group): thước nằm theo +x, thước đứng theo +y. */
  at(v: number, out?: THREE.Vector3): THREE.Vector3;
  /** Đặt con trượt (thước đứng) tại `v` mm; null = ẩn. */
  setMark(v: number | null): void;
  length: number;
}

/** Mặt in vạch: mm / 5 mm / cm + số. */
function faceTexture(len: number, width: number, face: string, numbers: 'cm' | 'dm'): HTMLCanvasElement {
  const pad = 5;
  const W = 2048;
  const k = W / (len + 2 * pad);
  const H = Math.max(64, Math.round(width * k));
  const { canvas, g } = makeCanvas(W, H);
  g.fillStyle = face;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#16191e';
  g.textAlign = 'center';
  const step = len > 400 ? 10 : 1;
  const fs = Math.min(H * 0.32, numbers === 'dm' ? k * 30 : k * 5.2);
  g.font = `bold ${Math.round(fs)}px system-ui, sans-serif`;
  for (let v = 0; v <= len; v += step) {
    const x = (pad + v) * k;
    const major = v % (numbers === 'dm' ? 100 : 10) === 0;
    const half = v % (numbers === 'dm' ? 50 : 5) === 0;
    const h = (major ? 0.36 : half ? 0.26 : 0.16) * H;
    const lw = Math.max(1.5, (major ? 0.32 : 0.2) * k * step);
    // Vạch mọc từ mép dưới ảnh = mép trước thước (+z).
    g.fillRect(x - lw / 2, H - h, lw, h);
    if (major) g.fillText(String(v / 10), x, H - h - fs * 0.3);
  }
  g.font = `${Math.round(fs * 0.7)}px system-ui, sans-serif`;
  g.fillText('cm', (pad + len) * k - fs * 1.4, H * 0.3);
  return canvas;
}

/**
 * A-THUOC – thước kẻ nhựa (dày 1,5–2 mm, rộng 25 mm) mặt vàng kem in vạch đen + dải màu dọc mép sau.
 * 'flat': gốc ở vạch 0 trên mép trước (mép vạch, +z), thước theo +x, thân lùi về −z, mặt trên ở y = 2 mm.
 * 'standing': gốc ở vạch 0 trên mặt đế, thước dựng theo +y, mặt số quay +z; con trượt `setMark`.
 */
export function createLabRuler(ctx: Tracker, o: LabRulerOptions = {}): LabRuler {
  const len = o.length ?? 150;
  const standing = o.kind === 'standing';
  const numbers = o.numbers ?? (len > 400 ? 'dm' : 'cm');
  const width = standing ? Math.max(30, len * 0.04) : len > 250 ? 32 : 25;
  const thick = standing ? Math.max(4, len * 0.006) : 2;
  const pad = 5;
  const group = new THREE.Group();
  group.name = standing ? 'ruler-standing' : 'ruler';
  const faceMat = ctx.track(new THREE.MeshPhysicalMaterial({ map: ctx.track(canvasTexture(faceTexture(len, width, o.face ?? '#e9d58c', numbers))), roughness: 0.4, clearcoat: 0.5 }));
  const accent = accentColor(o.accent ?? 'blue');
  const side = ctx.track(createPlasticMaterial(new THREE.Color(o.face ?? '#e9d58c').multiplyScalar(0.72), 0.45));
  const body = new THREE.Group();
  group.add(body);
  const box = part(ctx, body, new THREE.BoxGeometry(mm(len + 2 * pad), mm(thick), mm(width)), [side, side, faceMat, side, side, side], mm(len / 2), mm(thick / 2), -mm(width / 2));
  box.receiveShadow = true;
  // Dải màu dọc mép sau (nhận ra thước từ xa).
  part(ctx, body, new THREE.BoxGeometry(mm(len + 2 * pad), mm(thick + 0.2), mm(4)), labMaterials(ctx).plastic(accent), mm(len / 2), mm(thick / 2), -mm(width - 2));
  const marker = new THREE.Group();
  marker.visible = false;
  if (standing) {
    // Dựng thước: mặt số (+y của hộp) quay về +z.
    // x → +y (thang đo dựng đứng), mặt in +y → +z, mép sau −z → −x.
    body.rotation.set(Math.PI / 2, 0, Math.PI / 2, 'ZYX');
    const foot = part(ctx, group, new THREE.BoxGeometry(mm(width * 3), mm(12), mm(width * 2.2)), labMaterials(ctx).trim(), -mm(width / 2), -mm(6), mm(thick / 2));
    foot.receiveShadow = true;
    part(ctx, marker, new THREE.BoxGeometry(mm(width * 1.6), mm(4), mm(thick + 10)), labMaterials(ctx).plastic(o.accent ? accent : 'red'), -mm(width / 2), 0, mm(thick / 2));
    group.add(marker);
  }
  const at = (v: number, out = new THREE.Vector3()) => (standing ? out.set(0, mm(v), mm(thick)) : out.set(mm(v), mm(thick), 0));
  const zero = anchor(group, 'zero', 0);
  const tip = anchor(group, 'tip', 0, standing ? 0 : mm(thick));
  const grip = anchor(group, 'grip', 0);
  at(len / 2, grip.position);
  if (standing) grip.position.x = -mm(width / 2);
  else grip.position.z = -mm(width / 2);
  return {
    group,
    tip,
    grip,
    zero,
    length: mm(len),
    at,
    setMark(v) {
      marker.visible = standing && v !== null;
      if (v !== null) marker.position.y = mm(v);
    },
  };
}
