import * as THREE from 'three';
import { latheFromProfile } from '../glassware/vessel';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createMetalMaterial, createPlasticMaterial } from '../materials/factories';
import { LAB_PALETTE } from '../materials/palette';
import type { Tracker } from '../types';

/**
 * A-MAY-LI-TAM: máy li tâm để bàn – thân nhựa trắng, nắp tròn bản lề phía sau, khoang thép, rotor góc cố định có `slots` lỗ
 * (ống nghiêng ra ngoài `tilt`), màn hình LCD vòng/phút + thời gian ở mặt trước. Gốc ở tâm đáy, mặt trước +z. Mặc định 3 × 1,9 × 3,2 dm.
 */
export interface Centrifuge {
  group: THREE.Group;
  /** Quay quanh y khi chạy; các `slots` là con của rotor. */
  rotor: THREE.Group;
  /** Gốc ở đáy lỗ, trục +y theo trục ống (cục bộ rotor) – `slot.attach(tube)` rồi đặt tube.position = 0. */
  slots: THREE.Object3D[];
  /** Miệng khoang (cục bộ group) để đưa ống vào/ra. */
  mouth: THREE.Vector3;
  readonly rpm: number;
  readonly lidOpen: number;
  /** 0 = đóng, 1 = mở; chuyển mượt trong `update`. */
  setLid(open: number): void;
  /** Đặt vòng/phút mục tiêu (0 = dừng); rotor tăng/giảm tốc dần. */
  spinTo(rpm: number): void;
  setDisplay(line1: string, line2?: string): void;
  update(dt: number): void;
}

export interface CentrifugeOptions {
  width?: number;
  height?: number;
  depth?: number;
  slots?: number;
  /** Góc nghiêng ống (rad), mặc định 0,45. */
  tilt?: number;
  /** Gia tốc rotor (vòng/phút mỗi giây), mặc định 2500. */
  accel?: number;
}

export function createCentrifuge(ctx: Tracker, o: CentrifugeOptions = {}): Centrifuge {
  const W = o.width ?? 3;
  const H = o.height ?? 1.9;
  const D = o.depth ?? 3.2;
  const n = o.slots ?? 6;
  const tilt = o.tilt ?? 0.45;
  const accel = o.accel ?? 2500;
  const group = new THREE.Group();
  group.name = 'centrifuge';
  const shell = ctx.track(createPlasticMaterial(LAB_PALETTE.device, 0.4));
  const grey = ctx.track(createPlasticMaterial('#6d7781', 0.45));
  const steel = ctx.track(createMetalMaterial(0xbfc5cc, 0.28));
  const dark = ctx.track(createMetalMaterial(0x4b525a, 0.45, 0.7));
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material) => {
    const x = new THREE.Mesh(ctx.track(geo), m);
    x.castShadow = x.receiveShadow = true;
    return x;
  };
  const R = Math.min(W, D) * 0.36;
  const zc = -D * 0.08;
  // Thân: khối chữ nhật bo góc đùn theo y, có lỗ tròn cho khoang (mặt trên hở để nhìn vào rotor).
  const c = 0.2;
  const s = new THREE.Shape();
  s.moveTo(-W / 2 + c, -D / 2);
  s.lineTo(W / 2 - c, -D / 2);
  s.quadraticCurveTo(W / 2, -D / 2, W / 2, -D / 2 + c);
  s.lineTo(W / 2, D / 2 - c);
  s.quadraticCurveTo(W / 2, D / 2, W / 2 - c, D / 2);
  s.lineTo(-W / 2 + c, D / 2);
  s.quadraticCurveTo(-W / 2, D / 2, -W / 2, D / 2 - c);
  s.lineTo(-W / 2, -D / 2 + c);
  s.quadraticCurveTo(-W / 2, -D / 2, -W / 2 + c, -D / 2);
  const hole = new THREE.Path();
  hole.absarc(0, -zc, R, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const bodyGeo = new THREE.ExtrudeGeometry(s, { depth: H - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 32 });
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.translate(0, 0.04, 0);
  const body = mesh(bodyGeo, shell);
  group.add(body);
  // Vành khoang + thành khoang thép (nhìn được khi mở nắp).
  const bowl = mesh(latheFromProfile([{ r: R * 0.98, y: 0 }, { r: R * 0.98, y: -H * 0.62 }, { r: 0, y: -H * 0.62 }], 48), dark);
  (bowl.material as THREE.Material).side = THREE.DoubleSide;
  bowl.position.y = H + 0.002;
  const rim = mesh(new THREE.TorusGeometry(R, 0.05, 10, 48), grey);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = H + 0.01;
  group.add(bowl, rim);
  bowl.position.z = rim.position.z = zc;

  const rotor = new THREE.Group();
  rotor.position.set(0, H - H * 0.5, zc);
  group.add(rotor);
  const hub = mesh(latheFromProfile([{ r: 0, y: 0 }, { r: R * 0.8, y: 0 }, { r: R * 0.82, y: 0.12 }, { r: R * 0.55, y: 0.42 }, { r: 0.12, y: 0.48 }, { r: 0, y: 0.5 }], 40), steel);
  rotor.add(hub);
  const slots: THREE.Object3D[] = [];
  const holeMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#22272d', roughness: 0.8 }));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const arm = new THREE.Group();
    arm.rotation.y = -a;
    rotor.add(arm);
    const slot = new THREE.Object3D();
    slot.position.set(R * 0.62, 0.02, 0);
    slot.rotation.z = -tilt;
    arm.add(slot);
    const hole = mesh(new THREE.CircleGeometry(0.085, 18), holeMat);
    hole.position.set(R * 0.62 - 0.3 * Math.sin(tilt), 0.44, 0);
    hole.rotation.set(-Math.PI / 2, 0, 0);
    arm.add(hole);
    slots.push(slot);
  }

  // Nắp tròn bản lề phía sau.
  const hinge = new THREE.Group();
  hinge.position.set(0, H + 0.02, zc - R - 0.12);
  group.add(hinge);
  const lid = mesh(latheFromProfile([{ r: 0, y: 0.16 }, { r: R + 0.02, y: 0.12 }, { r: R + 0.12, y: 0.02 }, { r: R + 0.12, y: 0 }, { r: 0, y: 0 }], 48), shell);
  lid.position.z = R + 0.12;
  const knob = mesh(new THREE.BoxGeometry(0.4, 0.06, 0.12), grey);
  knob.position.set(0, 0.1, R * 2 + 0.2);
  hinge.add(lid, knob);

  // Bảng điều khiển phía trước (mặt nghiêng) + LCD.
  const { canvas, g } = makeCanvas(256, 96);
  const tex = ctx.track(canvasTexture(canvas));
  const panel = mesh(new THREE.BoxGeometry(W * 0.8, H * 0.32, 0.04), grey);
  panel.position.set(0, H * 0.48, D / 2 + 0.005);
  const lcd = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(W * 0.42, H * 0.2)), ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  lcd.position.set(-W * 0.12, H * 0.48, D / 2 + 0.03);
  const btnMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#3fb27f', roughness: 0.4 }));
  const btn = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20), btnMat);
  btn.rotation.x = Math.PI / 2;
  btn.position.set(W * 0.26, H * 0.48, D / 2 + 0.03);
  group.add(panel, lcd, btn);
  const draw = (a: string, b: string) => {
    g.fillStyle = '#16251f';
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#8ff0bf';
    g.font = 'bold 40px monospace';
    g.fillText(a, 12, 44);
    g.font = '26px monospace';
    g.fillText(b, 12, 82);
    tex.needsUpdate = true;
  };
  draw('0 rpm', '');

  let lidT = 0;
  let lidK = 0;
  let rpm = 0;
  let target = 0;
  return {
    group,
    rotor,
    slots,
    mouth: new THREE.Vector3(0, H + 0.6, zc),
    get rpm() {
      return rpm;
    },
    get lidOpen() {
      return lidK;
    },
    setLid(v) {
      lidT = THREE.MathUtils.clamp(v, 0, 1);
    },
    spinTo(r) {
      target = Math.max(0, r);
    },
    setDisplay(a, b = '') {
      draw(a, b);
    },
    update(dt) {
      lidK += THREE.MathUtils.clamp(lidT - lidK, -dt * 1.6, dt * 1.6);
      hinge.rotation.x = -lidK * 1.75;
      rpm += THREE.MathUtils.clamp(target - rpm, -accel * dt, accel * dt);
      // Quay hình ảnh tối đa ~3 vòng/s để không nhấp nháy răng cưa thời gian.
      rotor.rotation.y += Math.min(rpm / 60, 3) * Math.PI * 2 * dt;
      btnMat.emissive.set(rpm > 1 ? '#2dff9a' : '#000000');
      btnMat.emissiveIntensity = rpm > 1 ? 0.8 : 0;
    },
  };
}
