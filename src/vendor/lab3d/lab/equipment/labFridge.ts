import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import { type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { boxAdder, createLcd } from './parts';

/**
 * A-TU-LANH: tủ lạnh phòng thí nghiệm – 2 ngăn (ngăn đá trên, ngăn mát dưới) hoặc 1 cửa (`freezer: false`). Vỏ xám xanh, cánh cửa sáng hơn vỏ
 * + dải màu nhận diện dọc mép tay nắm, tay nắm tối, lòng nhựa xám nhạt, ngăn đá phủ tuyết, khay lưới, đèn trong bật khi mở cửa, màn LED.
 * Gốc ở tâm đáy ngoài, mặt trước +z (đv = dm). Mặc định 2,6 × 3,8 × 2,3 dm (tủ mini ~50 L).
 */
export type FridgeBay = 'freezer' | 'main';

export interface LabFridgeOptions {
  width?: number;
  height?: number;
  depth?: number;
  /** Có ngăn đá riêng phía trên (mặc định true). false = tủ 1 cửa: 'freezer' và 'main' cùng là một cửa. */
  freezer?: boolean;
  /** Số khay lưới ngăn mát (mặc định 1). */
  shelves?: number;
  /** Vách ngăn hai ngăn ở `split` × chiều cao lòng (mặc định 0,66 – ngăn đá thấp); 0,5 = ngăn đá cao ngang ngăn mát (đứng vừa ống nghiệm). */
  split?: number;
  /** Màu dải nhận diện trên cửa (mặc định xanh dương). */
  accent?: LabAccent | string;
  /** Cửa mở sẵn (0…1, không chạy hiệu ứng). */
  open?: Partial<Record<FridgeBay, number>>;
  /** Có màn LED nhiệt độ (mặc định true). */
  display?: boolean;
}

export interface LabFridge {
  group: THREE.Group;
  /** Mặt sàn giữa mỗi ngăn (cục bộ group) – chỗ đặt giá ống / đĩa. */
  spots: Record<FridgeBay, THREE.Vector3>;
  /** Mặt trên các khay lưới ngăn mát, từ dưới lên (cục bộ). */
  shelves: THREE.Vector3[];
  /** Điểm trước miệng mỗi ngăn (cục bộ) – đồ vật đi qua khi cất vào/lấy ra. */
  mouth: Record<FridgeBay, THREE.Vector3>;
  /** Bản lề cửa (Group xoay quanh y) và tay nắm (để kéo/bấm). */
  doors: Record<FridgeBay, THREE.Group>;
  handles: Record<FridgeBay, THREE.Object3D>;
  /** Lưới cols × rows chỗ đặt lọ trên sàn ngăn (cục bộ), bước `pitch` dm. */
  grid(bay: FridgeBay, cols: number, rows: number, pitch?: number): THREE.Vector3[];
  /** Mở/đóng cửa mượt (0,8 s) trong `update`. */
  open(bay: FridgeBay, on: boolean): void;
  /** Đặt độ mở cửa ngay (0…1). */
  setOpen(bay: FridgeBay, k: number): void;
  isOpen(bay: FridgeBay): boolean;
  setDisplay(main: number, freezer: number): void;
  update(dt: number): void;
}

const BAYS: FridgeBay[] = ['freezer', 'main'];

export function createLabFridge(ctx: Tracker, o: LabFridgeOptions = {}): LabFridge {
  const W = o.width ?? 2.6;
  const H = o.height ?? 3.8;
  const D = o.depth ?? 2.3;
  const hasFreezer = o.freezer ?? true;
  const t = 0.14;
  const group = new THREE.Group();
  group.name = 'lab-fridge';
  const mats = labMaterials(ctx);
  const shell = mats.cabinet();
  const doorMat = ctx.track(mats.cabinet().clone());
  doorMat.color.set('#7a8795');
  const liner = mats.liner();
  const frost = ctx.track(new THREE.MeshStandardMaterial({ color: '#d9e6ef', roughness: 0.95 }));
  const steel = mats.steel();
  const box = boxAdder(ctx, group);
  const panel = o.display === false ? 0 : 0.36;
  const top = H - panel;
  const feet = 0.12;
  const split = hasFreezer ? top * (o.split ?? 0.66) : top;
  // Vỏ: đáy, nóc, hai vách, lưng; vách ngăn giữa hai ngăn.
  box(W, t, D, 0, feet + t / 2, 0, shell);
  box(W, t, D, 0, top - t / 2, 0, shell);
  box(t, top - feet, D, -W / 2 + t / 2, (top + feet) / 2, 0, shell);
  box(t, top - feet, D, W / 2 - t / 2, (top + feet) / 2, 0, shell);
  box(W, top - feet, t, 0, (top + feet) / 2, -D / 2 + t / 2, shell);
  // Lòng nhựa xám nhạt (lưng + hai vách) để lọ/ống tách khỏi vỏ.
  box(W - 2 * t, top - feet - 2 * t, 0.02, 0, (top + feet) / 2, -D / 2 + t + 0.01, liner);
  for (const s of [-1, 1]) box(0.02, split - feet - t - 0.1, D - t - 0.1, s * (W / 2 - t - 0.01), (split + feet + t) / 2, t / 2, liner);
  if (hasFreezer) {
    box(W - 2 * t, 0.16, D - t, 0, split, t / 2, liner);
    // Lòng ngăn đá phủ tuyết.
    box(W - 2 * t - 0.02, 0.04, D - t - 0.1, 0, top - t - 0.02, 0, frost);
    for (const s of [-1, 1]) box(0.04, top - split - t - 0.1, D - t - 0.1, s * (W / 2 - t - 0.02), (top + split) / 2, 0, frost);
    box(W - 2 * t, 0.03, D - t - 0.1, 0, split + 0.095, 0, frost);
  }
  // Khay lưới ngăn mát (thanh inox).
  const nShelf = o.shelves ?? 1;
  const floor = feet + t;
  const rodGeo = ctx.track(new THREE.CylinderGeometry(0.01, 0.01, D - t - 0.15, 6));
  const shelves: THREE.Vector3[] = [];
  for (let s = 0; s < nShelf; s++) {
    const y = floor + ((split - floor) * 0.9 * (s + 1)) / (nShelf + 1);
    for (let i = 0; i <= 10; i++) {
      const rod = new THREE.Mesh(rodGeo, steel);
      rod.rotation.x = Math.PI / 2;
      rod.position.set(-W / 2 + t + 0.06 + ((W - 2 * t - 0.12) * i) / 10, y, t / 2);
      group.add(rod);
    }
    box(W - 2 * t - 0.04, 0.02, 0.03, 0, y, D / 2 - 0.12, steel);
    shelves.push(new THREE.Vector3(0, y + 0.012, 0.1));
  }
  for (const x of [-1, 1]) for (const z of [-1, 1]) box(0.14, feet, 0.14, x * (W / 2 - 0.2), feet / 2, z * (D / 2 - 0.2), mats.trim());
  // Hộp điều khiển + LED.
  const lcd = createLcd(ctx, Math.min(1.2, W * 0.5), 0.3);
  if (panel) {
    box(W, panel, D, 0, top + panel / 2, 0, mats.panel());
    lcd.mesh.position.set(0, top + panel / 2, D / 2 + 0.002);
    group.add(lcd.mesh);
  }
  const lamp = new THREE.PointLight(0xe8f2ff, 0, 3.5, 2);
  lamp.position.set(0, split - 0.3, 0.3);
  group.add(lamp);
  const accent = mats.plastic(o.accent ?? 'blue');
  const doors = {} as Record<FridgeBay, THREE.Group>;
  const handles = {} as Record<FridgeBay, THREE.Object3D>;
  const door = (bay: FridgeBay, y0: number, y1: number) => {
    const pivot = new THREE.Group();
    pivot.name = `fridge-door-${bay}`;
    pivot.position.set(-W / 2, 0, D / 2);
    group.add(pivot);
    const h = y1 - y0;
    box(W, h - 0.02, 0.12, W / 2, (y0 + y1) / 2, 0.06, doorMat, pivot);
    box(W - 0.12, h - 0.14, 0.05, W / 2, (y0 + y1) / 2, -0.02, liner, pivot);
    box(0.05, h - 0.12, 0.02, W - 0.1, (y0 + y1) / 2, 0.125, accent, pivot);
    handles[bay] = box(0.07, Math.min(0.9, h * 0.5), 0.09, W - 0.22, (y0 + y1) / 2, 0.17, mats.trim(), pivot);
    handles[bay].name = `fridge-handle-${bay}`;
    doors[bay] = pivot;
  };
  door('main', feet, hasFreezer ? split + 0.08 : top);
  if (hasFreezer) door('freezer', split + 0.08, top);
  else {
    doors.freezer = doors.main;
    handles.freezer = handles.main;
  }
  const k: Record<FridgeBay, number> = { freezer: 0, main: 0 };
  const want: Record<FridgeBay, number> = { freezer: 0, main: 0 };
  const pose = () => {
    for (const bay of BAYS) {
      const s = k[bay] * k[bay] * (3 - 2 * k[bay]);
      if (hasFreezer || bay === 'main') doors[bay].rotation.y = -1.9 * s;
    }
    lamp.intensity = k.main > 0.05 || (hasFreezer && k.freezer > 0.05) ? 0.7 : 0;
  };
  const alias = (bay: FridgeBay): FridgeBay => (hasFreezer ? bay : 'main');
  const spotY: Record<FridgeBay, number> = { freezer: hasFreezer ? split + 0.11 : (shelves.at(-1)?.y ?? floor), main: shelves[0]?.y ?? floor };
  const api: LabFridge = {
    group,
    spots: { freezer: new THREE.Vector3(0, spotY.freezer, 0.1), main: new THREE.Vector3(0, spotY.main, 0.1) },
    shelves,
    mouth: { freezer: new THREE.Vector3(0, spotY.freezer + 0.25, D / 2 + 0.5), main: new THREE.Vector3(0, spotY.main + 0.25, D / 2 + 0.5) },
    doors,
    handles,
    grid(bay, cols, rows, pitch = 0.4) {
      const y = bay === 'main' ? floor : spotY[bay];
      const out: THREE.Vector3[] = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(new THREE.Vector3((c - (cols - 1) / 2) * pitch, y, t / 2 + (r - (rows - 1) / 2) * pitch));
      return out;
    },
    open: (bay, on) => (want[alias(bay)] = on ? 1 : 0),
    setOpen(bay, v) {
      const b = alias(bay);
      k[b] = want[b] = THREE.MathUtils.clamp(v, 0, 1);
      pose();
    },
    isOpen: (bay) => k[alias(bay)] > 0.5,
    setDisplay(main, freezer) {
      lcd.draw((g, w, h) => {
        g.fillStyle = '#0b1420';
        g.fillRect(0, 0, w, h);
        g.font = 'bold 26px monospace';
        g.textBaseline = 'middle';
        if (hasFreezer) {
          g.fillStyle = '#7fd4ff';
          g.fillText(`❄${freezer.toFixed(0)}°C`, 8, h / 2 + 1);
        }
        g.fillStyle = '#9dffbf';
        g.fillText(`${main.toFixed(0)}°C`, hasFreezer ? 150 : 90, h / 2 + 1);
      });
    },
    update(dt) {
      let moved = false;
      for (const bay of BAYS) {
        if (k[bay] === want[bay]) continue;
        k[bay] = want[bay] > k[bay] ? Math.min(1, k[bay] + dt / 0.8) : Math.max(0, k[bay] - dt / 0.8);
        moved = true;
      }
      if (moved) pose();
    },
  };
  for (const bay of BAYS) if (o.open?.[bay] !== undefined) api.setOpen(bay, o.open[bay]!);
  api.setDisplay(4, -18);
  return api;
}
