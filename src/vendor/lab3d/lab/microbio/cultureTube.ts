import * as THREE from 'three';
import { createTestTube } from '../glassware/items';
import type { Vessel } from '../glassware/vessel';
import { createWrapLabel, type WrapLabel } from '../glassware/wrapLabel';
import { createLiquid, type Liquid } from '../liquid/liquid';
import { createPlasticMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';

/**
 * A-ONG-NUOI-CAY: ống nghiệm 16 × 150 mm nắp vặn nhựa (có gờ), dịch lỏng chỉnh độ đục (dịch vi khuẩn / nước cất / môi trường lỏng).
 * Nắp là vật riêng (con của `group` khi đậy) để tháo ra cầm bên cạnh. Gốc ở đáy ống.
 */
export interface CultureTube {
  group: THREE.Group;
  vessel: Vessel;
  liquid: Liquid;
  cap: THREE.Group;
  /** Vị trí nắp khi đậy (cục bộ `group`). */
  capRest: THREE.Vector3;
  label: WrapLabel | null;
  /** Độ đục 0…1 (mật độ tế bào), đổi mượt trong `duration` giây. */
  setTurbidity(t: number, duration?: number): void;
  /** Đậy nắp lại (gắn về `group`). */
  closeCap(): void;
  update(dt: number): void;
}

export interface CultureTubeOptions {
  capColor?: THREE.ColorRepresentation;
  /** Màu dịch (dịch đục dùng màu này khi turbidity = 1). */
  color?: THREE.ColorRepresentation;
  turbidity?: number;
  volumeML?: number;
  label?: string;
  sublabel?: string;
}

export function createCultureTube(ctx: Tracker, o: CultureTubeOptions = {}): CultureTube {
  const vessel = createTestTube(ctx, 16, 150);
  const group = new THREE.Group();
  group.name = 'culture-tube';
  group.add(vessel.group);
  const color = new THREE.Color(o.color ?? '#e8dcae');
  const liquid = createLiquid(ctx, vessel.profile, { volumeML: o.volumeML ?? 9, color: '#f4f8ff', opacity: 0.1, turbidity: 0 });
  vessel.group.add(liquid.mesh);
  const cap = new THREE.Group();
  cap.name = 'tube-cap';
  const mat = ctx.track(createPlasticMaterial(o.capColor ?? '#2f9a55', 0.45));
  const body = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(9.6), mm(9.6), mm(18), 28)), mat);
  body.position.y = mm(9);
  body.castShadow = true;
  cap.add(body);
  // Gờ khía dọc cho nắp vặn.
  const ribGeo = ctx.track(new THREE.BoxGeometry(mm(1), mm(15), mm(1.2)));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const rib = new THREE.Mesh(ribGeo, mat);
    rib.position.set(Math.cos(a) * mm(9.7), mm(9), Math.sin(a) * mm(9.7));
    rib.rotation.y = -a;
    cap.add(rib);
  }
  const capRest = new THREE.Vector3(0, vessel.mouthY - mm(14), 0);
  cap.position.copy(capRest);
  group.add(cap);
  let label: WrapLabel | null = null;
  if (o.label) {
    label = createWrapLabel(ctx, o.label, { radius: mm(8.4), height: mm(16), arc: 1.6, sublabel: o.sublabel });
    label.mesh.position.y = mm(92);
    group.add(label.mesh);
  }
  const api: CultureTube = {
    group,
    vessel,
    liquid,
    cap,
    capRest,
    label,
    setTurbidity(t, duration = 0) {
      const k = THREE.MathUtils.clamp(t, 0, 1);
      liquid.setTurbidity(k, duration, color);
      liquid.setColor(new THREE.Color('#f4f8ff').lerp(color, Math.min(1, k * 1.4)), duration, 0.1 + 0.5 * k);
    },
    closeCap() {
      group.add(cap);
      cap.position.copy(capRest);
      cap.rotation.set(0, 0, 0);
    },
    update: (dt) => liquid.update(dt),
  };
  api.setTurbidity(o.turbidity ?? 0);
  return api;
}

