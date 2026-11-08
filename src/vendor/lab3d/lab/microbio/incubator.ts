import * as THREE from 'three';
import { boxAdder, cabinetGlass, createLcd } from '../equipment/parts';
import { labMaterials } from '../materials/kit';
import type { LabAccent } from '../materials/palette';
import type { Tracker } from '../types';

/**
 * A-TU-AM: tủ ấm để bàn 30 × 30 × 28 cm (vỏ xám xanh, dải màu nhận diện, lòng inox, khay lưới, cửa kính khung tối bản lề trái, màn LED
 * nhiệt độ / giờ ủ / % CO₂ – `co2` cho tủ ấm CO₂ nuôi tế bào).
 * Kính cửa là vật liệu `transparent` (không transmission) để vẫn thấy đĩa thạch/ống nghiệm (transmission) bên trong.
 * Gốc ở tâm đáy ngoài, mặt trước hướng +z.
 */
export interface IncubatorOptions {
  width?: number;
  height?: number;
  depth?: number;
  /** Số khay lưới (mặc định 2). */
  shelves?: number;
  /** Tủ ấm CO₂: % CO₂ hiện trên màn (vd. 5). */
  co2?: number;
  /** Màu dải nhận diện (mặc định cam – "ấm"). */
  accent?: LabAccent | string;
}

export interface Incubator {
  group: THREE.Group;
  door: THREE.Group;
  /** Tay nắm cửa (để kéo/bấm). */
  handle: THREE.Object3D;
  /** Mặt trên của các khay từ dưới lên (cục bộ group, tâm khay). */
  shelves: THREE.Vector3[];
  /** Điểm trước cửa ngang khay dưới (cục bộ) – đồ vật đi qua khi cất vào. */
  mouth: THREE.Vector3;
  setOpen(k: number): void;
  /** Hiện nhiệt độ đặt (°C) và giờ đã ủ (null = ẩn); `co2` = % CO₂ (mặc định theo tuỳ chọn). */
  setDisplay(tempC: number, hours: number | null, co2?: number): void;
  /** Đèn trong tủ khi đang chạy. */
  setRunning(on: boolean): void;
}

export function createIncubator(ctx: Tracker, o: IncubatorOptions = {}): Incubator {
  const W = o.width ?? 3;
  const H = o.height ?? 3;
  const D = o.depth ?? 2.8;
  const t = 0.12;
  const group = new THREE.Group();
  group.name = 'incubator';
  const mats = labMaterials(ctx);
  const shell = mats.cabinet();
  const steel = mats.steel();
  const box = boxAdder(ctx, group, 0.02);
  const panelH = 0.42;
  const top = H - panelH;
  box(W, t, D, 0, t / 2, 0, shell);
  box(W, t, D, 0, top - t / 2, 0, shell);
  box(t, top, D, -W / 2 + t / 2, top / 2, 0, shell);
  box(t, top, D, W / 2 - t / 2, top / 2, 0, shell);
  box(W, top, t, 0, top / 2, -D / 2 + t / 2, shell);
  // Lòng inox mỏng sát vỏ.
  box(W - 2 * t, 0.01, D - t, 0, t + 0.005, t / 2, steel);
  box(W - 2 * t, top - 2 * t, 0.01, 0, top / 2, -D / 2 + t + 0.005, steel);
  // Hộp điều khiển phía trên: màn LED.
  box(W, panelH, D, 0, top + panelH / 2, 0, mats.panel());
  box(W, 0.07, 0.04, 0, top + 0.035, D / 2 + 0.01, mats.plastic(o.accent ?? 'orange'));
  const lcd = createLcd(ctx, Math.min(0.9, W * 0.42), Math.min(0.225, W * 0.105));
  lcd.mesh.position.set(-W * 0.18, top + panelH / 2 + 0.02, D / 2 + 0.002);
  group.add(lcd.mesh);
  const shelves: THREE.Vector3[] = [];
  const rodGeo = ctx.track(new THREE.CylinderGeometry(0.008, 0.008, D - t - 0.1, 6));
  const n = o.shelves ?? 2;
  const levels = n === 2 ? [0.3, 0.64] : Array.from({ length: n }, (_, i) => 0.3 + (n > 1 ? (0.4 * i) / (n - 1) : 0));
  for (const y of levels.map((f) => top * f)) {
    for (let i = 0; i <= 12; i++) {
      const rod = new THREE.Mesh(rodGeo, steel);
      rod.rotation.x = Math.PI / 2;
      rod.position.set(-W / 2 + t + 0.06 + ((W - 2 * t - 0.12) * i) / 12, y, t / 2);
      group.add(rod);
    }
    shelves.push(new THREE.Vector3(0, y + 0.008, t / 2 + 0.05));
  }
  // Cửa: khung + kính, bản lề ở cạnh trái phía trước.
  const door = new THREE.Group();
  door.position.set(-W / 2, 0, D / 2);
  group.add(door);
  const frame = mats.trim();
  const fw = 0.16;
  box(W, fw, 0.06, W / 2, fw / 2 + 0.02, 0.03, frame, door);
  box(W, fw, 0.06, W / 2, top - fw / 2, 0.03, frame, door);
  box(fw, top, 0.06, fw / 2, top / 2, 0.03, frame, door);
  box(fw, top, 0.06, W - fw / 2, top / 2, 0.03, frame, door);
  const handle = box(0.05, Math.min(0.6, top * 0.3), 0.08, W - fw - 0.05, top / 2, 0.1, steel, door);
  handle.name = 'incubator-handle';
  const glass = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(W - 2 * fw, top - 2 * fw)), cabinetGlass(ctx, 0.18));
  glass.position.set(W / 2, top / 2, 0.035);
  glass.renderOrder = 5;
  door.add(glass);
  const lamp = new THREE.PointLight(0xffd9a0, 0, 4, 2);
  lamp.position.set(0, top - 0.3, 0);
  group.add(lamp);
  const api: Incubator = {
    group,
    door,
    handle,
    shelves,
    mouth: new THREE.Vector3(0, shelves[0].y + 0.25, D / 2 + 0.6),
    setOpen(k) {
      door.rotation.y = -1.9 * THREE.MathUtils.clamp(k, 0, 1);
    },
    setDisplay(T, hours, co2 = o.co2) {
      lcd.draw((g, w, h) => {
        g.fillStyle = '#0b1a12';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#5dff9a';
        g.font = 'bold 34px monospace';
        g.textBaseline = 'middle';
        g.fillText(`${T.toFixed(1).replace('.', ',')}°C`, 10, h / 2 + 1);
        const right = hours !== null ? `${Math.floor(hours)}h${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}` : co2 !== undefined ? `${co2}%CO₂` : '';
        g.font = 'bold 22px monospace';
        g.fillStyle = hours !== null ? '#ffd36b' : '#8fd8ff';
        g.fillText(right, 160, h / 2 + 1);
      });
    },
    setRunning(on) {
      lamp.intensity = on ? 0.6 : 0;
    },
  };
  api.setDisplay(37, null);
  return api;
}
