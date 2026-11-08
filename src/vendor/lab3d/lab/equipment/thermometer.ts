import * as THREE from 'three';
import { createGraduations, type GradMark } from '../glassware/graduations';
import { chaikin, densify } from '../glassware/curves';
import { buildProfile } from '../glassware/profile';
import { createVessel } from '../glassware/vessel';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface Thermometer {
  group: THREE.Group;
  readonly temperature: number;
  /** Đặt nhiệt độ đích (°C); cột chất lỏng dâng/hạ mượt trong update(dt). */
  setTemperature(t: number, instant?: boolean): void;
  update(dt: number): void;
}

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });

/** A-NHIET-KE – nhiệt kế rượu (cột đỏ) Ø7×300, thang −10…110 °C. Gốc ở đáy bầu, dọc +y. */
export function createThermometer(ctx: Tracker, o: { min?: number; max?: number; value?: number } = {}): Thermometer {
  const min = o.min ?? -10;
  const max = o.max ?? 110;
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'thermometer';
  const outline = [P(0, 0), P(2.6, 1), P(2.8, 10), P(2.6, 15), P(3.5, 20), P(3.5, 294), P(2.6, 299), P(0.5, 300)];
  const profile = buildProfile(densify(chaikin(outline, 3), mm(4)), mm(1.6));
  const body = createVessel(ctx, profile, { material: mats.solidGlass(), name: 'thermo-glass', segments: 32 });
  group.add(body.group);
  const y0 = mm(40);
  const y1 = mm(270);
  const yOf = (t: number) => y0 + ((t - min) / (max - min)) * (y1 - y0);
  const marks: GradMark[] = [];
  for (let t = min; t <= max; t += 2) {
    const major = t % 10 === 0;
    marks.push({ y: yOf(t), major, label: major && t % 20 === 0 ? String(t) : undefined });
  }
  const grads = createGraduations(ctx, profile, { marks, arc: 1.6, color: '#1b1f27' });
  group.add(grads);

  const red = ctx.track(
    new THREE.MeshStandardMaterial({ color: 0xd8262f, emissive: 0x5a0408, roughness: 0.3 }),
  );
  const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(mm(1.5), mm(9), 4, 12), red);
  bulb.position.y = mm(7);
  const colGeo = new THREE.CylinderGeometry(mm(0.55), mm(0.55), 1, 8);
  colGeo.translate(0, 0.5, 0);
  const column = new THREE.Mesh(colGeo, red);
  column.position.y = mm(12);
  group.add(bulb, column);

  let target = o.value ?? 25;
  let value = target;
  const apply = () => {
    column.scale.y = Math.max(mm(1), yOf(THREE.MathUtils.clamp(value, min, max)) - column.position.y);
  };
  apply();
  return {
    group,
    get temperature() {
      return value;
    },
    setTemperature(t, instant = false) {
      target = t;
      if (instant) {
        value = t;
        apply();
      }
    },
    update(dt) {
      if (Math.abs(target - value) < 0.01) return;
      value += (target - value) * Math.min(1, dt * 2.5);
      apply();
    },
  };
}
