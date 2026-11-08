import * as THREE from 'three';
import { latheFromProfile } from '../glassware/vessel';
import { createMetalMaterial, createPlasticMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import { LAB_PALETTE, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import type { CentrifugeDisplay } from './lcd';
import { createCentrifugePanel, type CentrifugePanel } from './panel';
import { createRotor, type Rotor, type RotorOptions } from './rotor';

/**
 * A-MAY-LI-TAM – máy li tâm để bàn (đơn vị dm, gốc = giữa đáy máy, mặt trước hướng +z):
 * thân nhựa trắng, buồng thép tròn có rotor góc cố định, nắp bản lề phía sau có cửa sổ, bảng điều khiển nghiêng + LCD.
 */
export interface Centrifuge {
  group: THREE.Group;
  rotor: Rotor;
  /** Tâm buồng ở mặt trên máy (cục bộ). */
  chamberTop: THREE.Vector3;
  /** 0 = đóng, 1 = mở hết. */
  setLid(open: number): void;
  readonly lid: number;
  display(d: CentrifugeDisplay): void;
  /** Bảng điều khiển (mặt nghiêng, +z cục bộ hướng ra ngoài): nút START/STOP/OPEN, núm tốc độ/thời gian khi `controls`. */
  panel: CentrifugePanel;
  /** Thân máy (rung khi mất cân bằng) – cha của buồng, rotor, nắp, bảng. */
  body: THREE.Group;
  /** Khớp bản lề nắp (xoay quanh x cục bộ; −`lidOpen` rad = mở hết). */
  lidPivot: THREE.Group;
  /** Quay rotor (rad/s hiển thị) + rung (biên độ dm). */
  update(dt: number, spin: number, shake: number): void;
}

/** Tuỳ chọn máy: rotor + màu vỏ (mặc định LAB_PALETTE.device) + dải màu nhận diện quanh chân máy (mặc định không có). */
export interface CentrifugeOptions extends RotorOptions {
  body?: string;
  accent?: LabAccent | (string & {});
  /** Thêm núm tốc độ + núm thời gian trên bảng điều khiển (nút xếp cột bên phải) – mặc định false (như cũ). */
  controls?: boolean;
  /** Góc mở hết của nắp (rad), mặc định 1,85 (ngả ra sau); nhỏ hơn (≈ 1,45) để nắp đứng gần thẳng, khung nhìn thấp hơn. */
  lidOpen?: number;
}

const W = 3.8;
const D = 4.0;
const H = 2.2;
const CZ = -0.35;
const CR = 1.32;
const FLOOR = 1.0;
const FRONT = 1.2;

function roundRect(x0: number, x1: number, y0: number, y1: number, r: number, s = new THREE.Shape()) {
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

/** Khối nằm ngang từ mặt cắt xz (y_shape = −z), dày `h`, có lỗ tròn buồng tuỳ chọn. */
function slab(z0: number, z1: number, h: number, hole: number) {
  const s = roundRect(-W / 2, W / 2, -z1, -z0, 0.18);
  if (hole > 0) s.holes.push(new THREE.Path().absarc(0, -CZ, hole, 0, Math.PI * 2, true));
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 40 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function createCentrifuge(ctx: Tracker, o: CentrifugeOptions = {}): Centrifuge {
  const group = new THREE.Group();
  group.name = 'centrifuge';
  const body = new THREE.Group();
  group.add(body);
  const white = ctx.track(createPlasticMaterial(o.body ?? LAB_PALETTE.device, 0.4));
  // Vỏ sẫm (o.body) → viền bảng điều khiển TRIM để màn LCD vẫn tách khỏi vỏ.
  const grey = o.body ? labMaterials(ctx).trim() : ctx.track(createPlasticMaterial(0x58606b, 0.5));
  const steel = ctx.track(createMetalMaterial(0x8c939c, 0.42, 0.85));
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    body.add(m);
    return m;
  };
  add(slab(-D / 2, D / 2, FLOOR, 0), white);
  add(slab(-D / 2, FRONT, H - FLOOR, CR), white, FLOOR);
  if (o.accent) {
    const e = 0.03;
    const band = new THREE.ExtrudeGeometry(roundRect(-W / 2 - e, W / 2 + e, -D / 2 - e, D / 2 + e, 0.18 + e), { depth: 0.12, bevelEnabled: false, curveSegments: 12 });
    band.rotateX(-Math.PI / 2);
    add(band, labMaterials(ctx).plastic(o.accent), FLOOR * 0.55);
  }
  // Bảng điều khiển: nêm nghiêng phía trước buồng.
  const wedge = new THREE.Shape([new THREE.Vector2(FRONT, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(D / 2, H - FLOOR - 0.35), new THREE.Vector2(FRONT, H - FLOOR)]);
  const wg = new THREE.ExtrudeGeometry(wedge, { depth: W - 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  wg.rotateY(-Math.PI / 2);
  wg.translate(W / 2 - 0.04, 0, 0);
  add(wg, white, FLOOR);
  const chamber = add(
    latheFromProfile([{ r: 0, y: 0 }, { r: CR - 0.02, y: 0 }, { r: CR, y: 0.05 }, { r: CR, y: H - FLOOR }], 64),
    ctx.track(new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide })),
    FLOOR,
  );
  chamber.position.z = CZ;
  const spindle = add(new THREE.CylinderGeometry(0.12, 0.16, 0.08, 24), steel, FLOOR + 0.04);
  spindle.position.z = CZ;
  const rotor = createRotor(ctx, o);
  rotor.group.position.set(0, FLOOR + 0.08, CZ);
  body.add(rotor.group);
  // Bảng điều khiển: LCD + nút.
  const slope = Math.atan2(0.35, D / 2 - FRONT);
  const panel = new THREE.Group();
  panel.position.set(0, H - 0.175 + 0.025, (FRONT + D / 2) / 2 + 0.01);
  panel.rotation.x = -(Math.PI / 2 - slope);
  body.add(panel);
  const ctl = createCentrifugePanel(ctx, W - 0.4, grey, o.controls);
  panel.add(ctl.group);
  // Nắp: bản lề ở mép sau, cửa sổ tối nhìn thấy rotor.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, H, -D / 2);
  body.add(lidPivot);
  const lidGeo = slab(-D / 2, FRONT, 0.1, 0.85);
  lidGeo.translate(0, 0, D / 2);
  const lidMesh = new THREE.Mesh(lidGeo, white);
  lidMesh.castShadow = true;
  const win = new THREE.Mesh(
    new THREE.CircleGeometry(0.86, 48),
    ctx.track(new THREE.MeshPhysicalMaterial({ color: 0x1b2632, roughness: 0.08, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide })),
  );
  win.rotation.x = -Math.PI / 2;
  win.position.set(0, 0.06, CZ + D / 2);
  lidPivot.add(lidMesh, win);
  let lid = 0;
  let base = 0;
  return {
    group,
    rotor,
    chamberTop: new THREE.Vector3(0, H, CZ),
    get lid() {
      return lid;
    },
    setLid(v) {
      lid = THREE.MathUtils.clamp(v, 0, 1);
      lidPivot.rotation.x = -(o.lidOpen ?? 1.85) * lid;
    },
    display: (d) => ctl.lcd.set(d),
    panel: ctl,
    body,
    lidPivot,
    update(dt, spin, shake) {
      ctl.lcd.update(dt);
      rotor.group.rotation.y += spin * dt;
      base += dt * 47;
      body.position.set(Math.sin(base) * shake, 0, Math.cos(base * 1.13) * shake);
      body.rotation.y = Math.sin(base * 0.9) * shake * 0.4;
    },
  };
}
