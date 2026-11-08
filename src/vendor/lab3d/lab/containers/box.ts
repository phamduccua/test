import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { accentColor, LAB_PALETTE } from '../materials/palette';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { shadowed, type Accent } from './common';

/** A-HOP-GIAY – hộp giấy in (hộp thuốc, hộp men, hộp găng): mặt trước có nhãn canvas (+z), các mặt khác màu `color`. Gốc ở tâm đáy. */
export function createCartonBox(
  ctx: Tracker,
  o: { title: string; sub?: string; color?: Accent; width?: number; height?: number; depth?: number },
): { group: THREE.Group; mesh: THREE.Mesh } {
  const color = accentColor(o.color ?? 'blue');
  const W = o.width ?? 90;
  const H = o.height ?? 55;
  const D = o.depth ?? 22;
  const cw = 384;
  const ch = Math.round((cw * H) / W);
  const { canvas, g } = makeCanvas(cw, ch);
  g.fillStyle = LAB_PALETTE.label;
  g.fillRect(0, 0, cw, ch);
  g.fillStyle = color;
  g.fillRect(0, 0, cw, ch * 0.25);
  g.fillRect(0, ch * 0.88, cw, ch * 0.12);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.font = `bold ${Math.round(ch * 0.15)}px system-ui, sans-serif`;
  g.fillText(o.title, cw / 2, ch * 0.13);
  g.fillStyle = '#2b3440';
  g.font = `${Math.round(ch * 0.12)}px system-ui, sans-serif`;
  (o.sub ?? '').split('\n').forEach((s, i) => g.fillText(s, cw / 2, ch * (0.45 + i * 0.16)));
  const side = labMaterials(ctx).plastic(color);
  const front = ctx.track(new THREE.MeshStandardMaterial({ map: ctx.track(canvasTexture(canvas)), roughness: 0.6 }));
  const mesh = shadowed(new THREE.Mesh(ctx.track(new RoundedBoxGeometry(mm(W), mm(H), mm(D), 2, mm(1.5))), [side, side, side, side, front, side]));
  mesh.position.y = mm(H / 2);
  const group = new THREE.Group();
  group.name = 'carton-box';
  group.add(mesh);
  return { group, mesh };
}
