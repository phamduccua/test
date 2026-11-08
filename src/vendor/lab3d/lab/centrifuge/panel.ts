import * as THREE from 'three';
import { createPlasticMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { createCentrifugeLcd } from './lcd';

/**
 * Bảng điều khiển máy li tâm (mặt phẳng nghiêng, +z cục bộ = hướng ra ngoài mặt bảng, x dọc bảng): LCD + 3 nút START (xanh lá),
 * STOP (đỏ), OPEN (xanh dương). `knobs: true` thêm hai núm xoay quanh z cục bộ (tốc độ, thời gian) có vạch chia – dùng với
 * createKnob của kit/lab3d/interact (`axis: 'z'`, `angles: KNOB_ANGLES`).
 */
export interface CentrifugePanel {
  group: THREE.Group;
  lcd: ReturnType<typeof createCentrifugeLcd>;
  buttons: { start: THREE.Mesh; stop: THREE.Mesh; open: THREE.Mesh };
  knobs: { speed: THREE.Group; time: THREE.Group } | null;
}

/** Góc núm (rad quanh z cục bộ) ở giá trị nhỏ nhất / lớn nhất: vặn theo chiều kim đồng hồ để tăng. */
export const KNOB_ANGLES: [number, number] = [Math.PI * 0.75, -Math.PI * 0.75];

export function createCentrifugePanel(ctx: Tracker, width: number, bezelMat: THREE.Material, knobs = false): CentrifugePanel {
  const group = new THREE.Group();
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.74), bezelMat);
  group.add(bezel);
  const lcd = createCentrifugeLcd(ctx, 1.2);
  lcd.mesh.position.set(-0.75, 0, 0.004);
  group.add(lcd.mesh);
  const btn = (x: number, y: number, r: number, color: number) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.01, 0.05, 24), ctx.track(createPlasticMaterial(color, 0.35)));
    b.rotation.x = Math.PI / 2;
    b.position.set(x, y, 0.025);
    b.castShadow = true;
    group.add(b);
    return b;
  };
  // Có núm: nút xếp cột bên phải, núm ở giữa; không có núm: ba nút một hàng như bản cũ.
  const buttons = knobs
    ? { start: btn(1.32, 0.2, 0.1, 0x2e9d4f), stop: btn(1.32, -0.02, 0.1, 0xd32f2f), open: btn(1.32, -0.24, 0.08, 0x1f6fbf) }
    : { start: btn(0.45, 0, 0.11, 0x2e9d4f), stop: btn(0.8, 0, 0.11, 0xd32f2f), open: btn(1.15, 0, 0.11, 0x1f6fbf) };
  if (!knobs) return { group, lcd, buttons, knobs: null };
  const m = labMaterials(ctx);
  const tickMat = ctx.track(new THREE.MeshBasicMaterial({ color: 0xc9d3dc, toneMapped: false }));
  const tickGeo = ctx.track(new THREE.PlaneGeometry(0.012, 0.045));
  const knob = (x: number) => {
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI / 2 + THREE.MathUtils.lerp(KNOB_ANGLES[0], KNOB_ANGLES[1], i / 8);
      const t = new THREE.Mesh(tickGeo, tickMat);
      t.position.set(x + Math.cos(a) * 0.22, 0.02 + Math.sin(a) * 0.22, 0.003);
      t.rotation.z = a - Math.PI / 2;
      group.add(t);
    }
    const k = new THREE.Group();
    k.position.set(x, 0.02, 0);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.165, 0.09, 32), m.trim());
    body.rotation.x = Math.PI / 2;
    body.position.z = 0.045;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.012), ctx.track(new THREE.MeshBasicMaterial({ color: 0xffc94d, toneMapped: false })));
    mark.position.set(0, 0.07, 0.093);
    k.add(body, mark);
    k.traverse((o) => (o.castShadow = true));
    group.add(k);
    return k;
  };
  return { group, lcd, buttons, knobs: { speed: knob(0.22), time: knob(0.78) } };
}
