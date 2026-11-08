import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { funnelProfile, petriProfile } from './shapes';
import { createVessel, latheFromProfile, type Vessel } from './vessel';

/** A-PHEU – phễu thuỷ tinh 60°. Gốc ở đầu cuống. */
export function createFunnel(ctx: Tracker, mouthD = 70, stemLen = 75): Vessel {
  return createVessel(ctx, funnelProfile(mouthD, stemLen), { name: 'funnel' });
}

/** A-DUA-THUY-TINH – đũa thuỷ tinh đặc Ø6×200, nằm dọc trục y, gốc ở đầu dưới. */
export function createGlassRod(ctx: Tracker, length = 200, diameter = 6): THREE.Mesh {
  const r = mm(diameter / 2);
  const geo = new THREE.CapsuleGeometry(r, mm(length) - 2 * r, 6, 16);
  geo.translate(0, mm(length) / 2, 0);
  const rod = new THREE.Mesh(geo, labMaterials(ctx).solidGlass());
  rod.name = 'glass-rod';
  return rod;
}

/** A-NUT-CAO-SU – nút cao su hình côn (có thể có lỗ). Gốc ở đáy nhỏ. */
export function createRubberStopper(
  ctx: Tracker,
  o: { top?: number; bottom?: number; height?: number; hole?: number; color?: 'red' | 'black' } = {},
): THREE.Mesh {
  const rt = mm((o.top ?? 18) / 2);
  const rb = mm((o.bottom ?? 14) / 2);
  const h = mm(o.height ?? 22);
  const rh = mm((o.hole ?? 0) / 2);
  const e = mm(0.8);
  const pts = [
    { r: rh, y: 0 },
    { r: rb - e, y: 0 },
    { r: rb, y: e },
    { r: rt, y: h - e },
    { r: rt - e, y: h },
    { r: rh, y: h },
  ];
  if (rh === 0) pts.unshift({ r: 0, y: 0 });
  else pts.push({ r: rh, y: 0 });
  const mats = labMaterials(ctx);
  const m = new THREE.Mesh(latheFromProfile(pts, 40), o.color === 'black' ? mats.blackRubber() : mats.rubber());
  m.castShadow = m.receiveShadow = true;
  m.name = 'stopper';
  return m;
}

/** A-DIA-PETRI – đĩa petri có nắp (`lid: false` = chỉ đáy). Nắp tên 'petri-lid'. */
export function createPetriDish(ctx: Tracker, d = 90, o: { lid?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = 'petri';
  const base = createVessel(ctx, petriProfile(d, 13), { name: 'petri-base' });
  const lid = createVessel(ctx, petriProfile(d + 4, 9), { name: 'petri-lid' });
  lid.group.rotation.x = Math.PI;
  lid.group.position.y = mm(15);
  g.add(base.group, lid.group);
  lid.group.visible = o.lid !== false;
  return g;
}
