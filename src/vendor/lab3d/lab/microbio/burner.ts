import * as THREE from 'three';
import { createFlame, type Flame } from '../effects/flame';
import { chaikin, densify } from '../glassware/curves';
import { latheFromProfile } from '../glassware/vessel';
import { createMetalMaterial, createRubberMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';

/**
 * A-DEN-KHI: đèn Bunsen (đế đúc Ø90, ống đốt Ø12 × 120 mm, vòng chỉnh gió, vòi khí bên + ống cao su xanh như H 20.4).
 * Lửa xanh lõi sáng cao ~75 mm. Gốc ở đáy đế; `hot` = điểm nóng nhất (đỉnh lõi xanh) để hơ que, `top` = miệng ống.
 */
export interface Burner {
  group: THREE.Group;
  flame: Flame;
  top: THREE.Object3D;
  hot: THREE.Object3D;
  readonly lit: boolean;
  setLit(on: boolean): void;
  update(dt: number, elapsed?: number): void;
}

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });

export function createBunsenBurner(ctx: Tracker, o: { lit?: boolean; hoseColor?: THREE.ColorRepresentation; hoseTo?: THREE.Vector3 } = {}): Burner {
  const group = new THREE.Group();
  group.name = 'bunsen-burner';
  const cast = ctx.track(createMetalMaterial(0x6f747b, 0.45, 0.85));
  const brass = ctx.track(createMetalMaterial(0xc9cdd2, 0.25, 1));
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0) => {
    const m = new THREE.Mesh(ctx.track(geo), mat);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(latheFromProfile(densify(chaikin([P(0, 0), P(44, 0), P(45, 3), P(42, 8), P(24, 14), P(12, 18), P(0, 18)], 3), mm(3)), 48), cast);
  add(new THREE.CylinderGeometry(mm(6), mm(6), mm(120), 28, 1, true), brass, mm(18 + 60));
  add(new THREE.CylinderGeometry(mm(7.2), mm(7.2), mm(16), 28), brass, mm(36));
  // Lỗ gió trên vòng chỉnh gió.
  const holeMat = ctx.track(new THREE.MeshBasicMaterial({ color: 0x15171a }));
  for (const a of [0, Math.PI]) {
    const h = add(new THREE.CircleGeometry(mm(2.6), 16), holeMat, mm(36));
    h.position.set(Math.sin(a) * mm(7.25), mm(36), Math.cos(a) * mm(7.25));
    h.rotation.y = a;
  }
  const rim = add(new THREE.TorusGeometry(mm(6), mm(0.8), 8, 28), brass, mm(138));
  rim.rotation.x = Math.PI / 2;
  // Vòi khí nằm ngang ở đế, hướng −x; ống cao su xanh nằm trên bàn tới `hoseTo` (cục bộ).
  const nozzle = add(new THREE.CylinderGeometry(mm(3.5), mm(4.5), mm(34), 16), brass, mm(12));
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.x = -mm(52);
  const end = o.hoseTo ?? new THREE.Vector3(-mm(420), mm(4), 0);
  const start = new THREE.Vector3(-mm(62), mm(12), 0);
  const path = new THREE.CatmullRomCurve3([
    start,
    new THREE.Vector3(-mm(100), mm(5), 0),
    start.clone().lerp(end, 0.45).setY(mm(4)),
    start.clone().lerp(end, 0.75).setY(mm(4)),
    end,
  ]);
  add(new THREE.TubeGeometry(path, 60, mm(4), 12), ctx.track(createRubberMaterial(o.hoseColor ?? 0x2f8f5a)));

  const flame = createFlame(ctx, { height: mm(75), width: mm(10), kind: 'alcohol' });
  flame.group.position.y = mm(139);
  group.add(flame.group);
  flame.setLit(o.lit ?? true);
  const top = new THREE.Object3D();
  top.position.y = mm(139);
  const hot = new THREE.Object3D();
  hot.position.y = mm(139 + 32);
  group.add(top, hot);
  return {
    group,
    flame,
    top,
    hot,
    get lit() {
      return flame.lit;
    },
    setLit: (on) => flame.setLit(on),
    update: (dt, el) => flame.update(dt, el),
  };
}
