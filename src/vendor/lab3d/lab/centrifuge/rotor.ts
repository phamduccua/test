import * as THREE from 'three';
import { chaikin } from '../glassware/curves';
import { latheFromProfile } from '../glassware/vessel';
import { createMetalMaterial } from '../materials/factories';
import type { Tracker } from '../types';

/**
 * Rotor góc cố định (đơn vị dm): thân nhôm hình nón cụt, `slots` lỗ nghiêng `angle` so với trục quay.
 * Mỗi `slots[i]` là Object3D đặt ở mũi đáy ống, trục +y của nó = trục ống hướng vào trong – lên (gắn ống bằng `slot.attach`).
 * Nắp rotor (`lid`) là vật rời: đặt/tháo bằng hoạt cảnh rồi `group.attach(lid)` khi đậy.
 */
export interface Rotor {
  group: THREE.Group;
  slots: THREE.Object3D[];
  /** Góc phương vị của từng lỗ (rad). */
  azimuth: number[];
  lid: THREE.Group;
  /** Vị trí đặt nắp trên rotor (cục bộ của `group`). */
  lidSeat: THREE.Vector3;
  /** Khoảng cách tới trục ở đáy và miệng ống (dm). */
  rBottom: number;
  rTop: number;
}

export interface RotorOptions {
  slots?: number;
  /** Góc nghiêng lỗ (rad), mặc định ≈ 31,6° (r 3,95 → 9,19 cm với ống dài 10 cm). */
  angle?: number;
  rBottom?: number;
  tubeLength?: number;
}

export function createRotor(ctx: Tracker, o: RotorOptions = {}): Rotor {
  const n = o.slots ?? 6;
  const rBottom = o.rBottom ?? 0.919;
  const L = o.tubeLength ?? 1.0;
  const angle = o.angle ?? Math.asin((rBottom - 0.395) / L);
  const metal = ctx.track(createMetalMaterial(0xc5cad2, 0.34, 0.92));
  const dark = ctx.track(new THREE.MeshStandardMaterial({ color: 0x1d2128, roughness: 0.6, metalness: 0.4 }));
  const group = new THREE.Group();
  group.name = 'rotor';
  const R = 1.02;
  const body = new THREE.Mesh(
    latheFromProfile(chaikin([{ r: 0, y: 0 }, { r: R - 0.05, y: 0 }, { r: R, y: 0.05 }, { r: R, y: 0.3 }, { r: 0.32, y: 0.78 }, { r: 0, y: 0.8 }], 2), 72),
    metal,
  );
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const coneY = (r: number) => 0.3 + ((R - r) / (R - 0.32)) * 0.48;
  const slots: THREE.Object3D[] = [];
  const azimuth: number[] = [];
  const y0 = 0.1;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.y = a;
    const slot = new THREE.Object3D();
    slot.position.set(rBottom, y0, 0);
    slot.rotation.z = angle;
    pivot.add(slot);
    group.add(pivot);
    slots.push(slot);
    azimuth.push(a);
    // Miệng lỗ: vành tối nơi trục ống cắt mặt nón.
    let t = 0;
    while (t < L && y0 + t * Math.cos(angle) < coneY(rBottom - t * Math.sin(angle))) t += 0.01;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.014, 8, 28), dark);
    rim.position.y = t;
    rim.rotation.x = Math.PI / 2;
    slot.add(rim);
  }
  // Nắp rotor: vòm nhôm + núm vặn + vạch đánh dấu để thấy rotor quay.
  const lid = new THREE.Group();
  lid.name = 'rotor-lid';
  const dome = new THREE.Mesh(
    latheFromProfile(chaikin([{ r: R - 0.01, y: 0 }, { r: R - 0.02, y: 0.05 }, { r: 0.86, y: 0.45 }, { r: 0.5, y: 0.75 }, { r: 0, y: 0.82 }], 2), 72),
    metal,
  );
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.16, 24), dark);
  knob.position.y = 0.88;
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.07), ctx.track(new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.5 })));
  mark.position.set(0.55, 0.62, 0);
  mark.rotation.z = -0.62;
  lid.add(dome, knob, mark);
  lid.traverse((m) => (m.castShadow = true));
  return { group, slots, azimuth, lid, lidSeat: new THREE.Vector3(0, coneY(R) - 0.02, 0), rBottom, rTop: rBottom - L * Math.sin(angle) };
}
