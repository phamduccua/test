import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';
import { boxAdder, createLcd } from './parts';

/**
 * A-BO-DIEU-NHIET: bộ điều nhiệt / bể ổn nhiệt tuần hoàn nhỏ – hộp vỏ máy (LAB_PALETTE.device), mặt điều khiển tối, màn số, núm vặn màu
 * có vạch chỉ + thang chia quanh núm, ống nước mềm (tuỳ chọn) nối tới thiết bị cần giữ nhiệt. Gốc = tâm đáy, mặt trước +z. Mặc định 96 × 62 × 70 mm.
 * Núm: `dial` xoay quanh trục z cục bộ, `dialAngles` = góc ở min/max (dùng với createKnob của kit/lab3d/interact, hoặc `setDial(k)`).
 */
export interface ThermostatOptions {
  width?: number;
  height?: number;
  depth?: number;
  knob?: LabAccent | string;
  /** Đường ống nước (điểm cục bộ, bắt đầu ở hông trái); không có = không vẽ ống. */
  hose?: THREE.Vector3[];
  hoseColor?: LabAccent | string;
  /** Vỏ: 'device' (xám xanh nhạt, mặc định) hoặc 'cabinet' (xám xanh đậm – tách khỏi mặt bàn sáng). */
  body?: 'device' | 'cabinet';
}

export interface Thermostat {
  group: THREE.Group;
  /** Trục núm vặn (xoay rotation.z). */
  dial: THREE.Group;
  /** Góc núm tại min / max (rad). */
  dialAngles: [number, number];
  /** Đặt núm theo tỉ lệ 0…1. */
  setDial(k: number): void;
  /** Chữ trên màn (vd. "37 °C", "298 K"). */
  setDisplay(text: string): void;
}

export function createThermostat(ctx: Tracker, o: ThermostatOptions = {}): Thermostat {
  const W = o.width ?? mm(96);
  const H = o.height ?? mm(62);
  const D = o.depth ?? mm(70);
  const group = new THREE.Group();
  group.name = 'thermostat';
  const mats = labMaterials(ctx);
  const box = boxAdder(ctx, group, mm(4));
  box(W, H, D, 0, H / 2, 0, o.body === 'cabinet' ? mats.cabinet() : mats.device());
  box(W * 0.88, H * 0.78, mm(2), 0, H * 0.52, D / 2 + mm(1), mats.panel());
  box(W + mm(1), mm(5), D + mm(1), 0, mm(4), 0, mats.trim());
  // Màn số phía trái, núm phía phải.
  const lcd = createLcd(ctx, W * 0.36, H * 0.24, 192);
  lcd.mesh.position.set(-W * 0.2, H * 0.6, D / 2 + mm(2.1));
  group.add(lcd.mesh);
  const R = Math.min(W, H) * 0.21;
  const dial = new THREE.Group();
  dial.name = 'thermostat-dial';
  dial.position.set(W * 0.19, H * 0.48, D / 2 + mm(2));
  const knob = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(R, R * 1.07, mm(10), 32)), mats.plastic(o.knob ?? 'red'));
  knob.rotation.x = Math.PI / 2;
  knob.position.z = mm(5);
  knob.castShadow = true;
  const tick = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(2.4), R * 0.75, mm(1.5))), mats.paper());
  tick.position.set(0, R * 0.5, mm(10.6));
  dial.add(knob, tick);
  group.add(dial);
  const dialAngles: [number, number] = [0.75 * Math.PI, -0.75 * Math.PI];
  // Thang chia quanh núm.
  const tickGeo = ctx.track(new THREE.BoxGeometry(mm(1.2), mm(4), mm(0.6)));
  for (let k = 0; k <= 7; k++) {
    const a = dialAngles[0] + ((dialAngles[1] - dialAngles[0]) * k) / 7;
    const t = new THREE.Mesh(tickGeo, mats.paper());
    t.position.set(dial.position.x - Math.sin(a) * R * 1.45, dial.position.y + Math.cos(a) * R * 1.45, D / 2 + mm(2.4));
    t.rotation.z = a;
    group.add(t);
  }
  if (o.hose?.length) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-W / 2, H * 0.2, 0), ...o.hose]);
    group.add(new THREE.Mesh(ctx.track(new THREE.TubeGeometry(curve, 24, mm(3), 8)), mats.plastic(o.hoseColor ?? 'blue')));
  }
  const api: Thermostat = {
    group,
    dial,
    dialAngles,
    setDial(k) {
      dial.rotation.z = dialAngles[0] + (dialAngles[1] - dialAngles[0]) * THREE.MathUtils.clamp(k, 0, 1);
    },
    setDisplay(text) {
      lcd.draw((g, w, h) => {
        g.fillStyle = '#10140f';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#ff6a4d';
        g.font = `bold ${Math.round(h * 0.62)}px monospace`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, w / 2, h / 2 + 1);
      });
    },
  };
  api.setDial(0.5);
  api.setDisplay('25 °C');
  return api;
}
