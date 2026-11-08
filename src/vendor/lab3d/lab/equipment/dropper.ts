import * as THREE from 'three';
import { chaikin, densify } from '../glassware/curves';
import { buildProfile } from '../glassware/profile';
import { createVessel, latheFromProfile } from '../glassware/vessel';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });

/** A-ONG-HUT – ống hút nhỏ giọt: thân thuỷ tinh thuôn (đầu Ø1,5) + quả bóp cao su. Gốc ở đầu nhọn, dọc +y. */
export function createDropper(ctx: Tracker, o: { bulbColor?: 'red' | 'black' } = {}): THREE.Group {
  const mats = labMaterials(ctx);
  const g = new THREE.Group();
  g.name = 'dropper';
  const outer = densify(chaikin([P(0.9, 0), P(1.2, 4), P(2.6, 30), P(3.6, 45), P(3.6, 108)], 2), mm(3));
  const glass = createVessel(ctx, buildProfile(outer, mm(0.6), true), { material: mats.glass(), name: 'dropper-glass', segments: 24 });
  g.add(glass.group);
  const bulbPts = chaikin([P(0, 140), P(6.5, 138), P(6.8, 120), P(4.6, 104), P(4.6, 98), P(0, 98)].reverse(), 3);
  const bulb = new THREE.Mesh(
    latheFromProfile(bulbPts, 32),
    o.bulbColor === 'black' ? mats.blackRubber() : mats.rubber(),
  );
  bulb.castShadow = true;
  g.add(bulb);
  return g;
}

/**
 * Khớp quả bóp ở cổ ống hút (createDropper): chuyển mesh quả bóp vào một nhóm đặt ở cổ (98 mm) để bóp co theo y quanh cổ
 * (createDripAction / createDropperGesture `bulb`). Gọi lại trên cùng ống hút → trả nhóm đã tạo.
 */
export function dropperBulb(tool: THREE.Object3D): THREE.Group | null {
  const done = tool.children.find((c) => c.name === 'dropper-bulb');
  if (done) return done as THREE.Group;
  const mesh = tool.children[1];
  if (!mesh) return null;
  const pivot = new THREE.Group();
  pivot.name = 'dropper-bulb';
  pivot.position.y = mm(98);
  mesh.position.y -= mm(98);
  tool.remove(mesh);
  pivot.add(mesh);
  tool.add(pivot);
  return pivot;
}
