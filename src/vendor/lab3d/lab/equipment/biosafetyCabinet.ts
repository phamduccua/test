import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { labMaterials } from '../materials/kit';
import { LAB_PALETTE, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { boxAdder, cabinetGlass, createLcd, drawLed } from './parts';
import { labText } from '../../text';

/**
 * A-TU-CAY / A-TU-ATSH: tủ cấy vô trùng (laminar) / tủ an toàn sinh học cấp II để bàn. Vỏ xám xanh (LAB_PALETTE.cabinet), dải màu nhận diện
 * dưới bảng điều khiển, mặt làm việc inox, tấm lọc HEPA đục lỗ phía sau, vách bên + kính chắn trước là kính `transparent` (thấy đồ thuỷ tinh
 * transmission bên trong), kính chắn TRƯỢT lên/xuống (`setSash`), đèn huỳnh quang + đèn UV. Gốc ở tâm đáy ngoài, mặt trước +z.
 * Mặc định 7,2 × 5 × 6,6 dm, cửa thao tác cao 2,6 dm.
 */
export interface BiosafetyCabinetOptions {
  width?: number;
  depth?: number;
  height?: number;
  /** Chiều cao cửa thao tác ban đầu (dm, từ mặt làm việc tới mép dưới kính chắn). */
  opening?: number;
  /** Chữ trên bảng điều khiển (mặc định theo `kind`). */
  title?: string;
  kind?: 'laminar' | 'biosafety';
  /** Màu dải nhận diện (mặc định xanh dương). */
  accent?: LabAccent | string;
  /** Vách bên bằng kính (mặc định) hay tôn kín. */
  glassSides?: boolean;
}

export interface BiosafetyCabinet {
  group: THREE.Group;
  /** Độ cao mặt làm việc (cục bộ group). */
  workY: number;
  inner: { width: number; depth: number; height: number };
  /** Tâm mặt làm việc (cục bộ) – chỗ đặt đĩa/giá. */
  center: THREE.Vector3;
  /** Giữa cửa thao tác (cục bộ) – điểm đồ vật đi qua khi đưa vào/ra tủ. */
  mouth: THREE.Vector3;
  /** Kính chắn trượt (con của group; y = mép dưới kính) + thanh tay nắm để kéo (createHandle). */
  sash: THREE.Group;
  grip: THREE.Object3D;
  /** Cửa thao tác (dm) ↔ vị trí kính chắn; kẹp trong [0, max]. */
  setSash(opening: number): void;
  sashRange: [number, number];
  setLight(on: boolean): void;
  setUV(on: boolean): void;
  setFan(on: boolean): void;
}

export function createBiosafetyCabinet(ctx: Tracker, o: BiosafetyCabinetOptions = {}): BiosafetyCabinet {
  const W = o.width ?? 7.2;
  const D = o.depth ?? 5;
  const H = o.height ?? 6.6;
  const t = 0.12;
  const canopy = 1.1;
  const group = new THREE.Group();
  group.name = 'biosafety-cabinet';
  const mats = labMaterials(ctx);
  const shell = mats.cabinet();
  const steel = mats.steel();
  const trim = mats.trim();
  const accent = mats.plastic(o.accent ?? 'blue');
  const glassMat = cabinetGlass(ctx, 0.13);
  const box = boxAdder(ctx, group);
  const workY = 0.32;
  const top = H - canopy;
  // Chân đế + mặt làm việc inox (gờ trước tối để thấy mép).
  box(W, workY - 0.02, D, 0, (workY - 0.02) / 2, 0, mats.cabinetDark());
  box(W - 2 * t, 0.04, D - t, 0, workY - 0.02, t / 2, steel);
  box(W - 2 * t, 0.06, 0.08, 0, workY + 0.01, D / 2 - 0.08, trim);
  // Hộp quạt + lọc phía trên; bảng điều khiển + dải màu nhận diện phía trước.
  box(W, canopy, D, 0, top + canopy / 2, 0, shell);
  box(W, 0.12, 0.05, 0, top + 0.08, D / 2 + 0.01, accent);
  const lcd = createLcd(ctx, W - 0.5, (W - 0.5) / 8, 1024);
  lcd.mesh.position.set(0, top + canopy / 2 + 0.06, D / 2 + 0.004);
  group.add(lcd.mesh);
  // Vách sau: tấm lọc HEPA đục lỗ (nhạt hơn vỏ, không trắng).
  const { canvas: hc, g: hg } = makeCanvas(512, 256);
  hg.fillStyle = LAB_PALETTE.liner;
  hg.fillRect(0, 0, 512, 256);
  hg.fillStyle = '#717b86';
  for (let y = 6; y < 256; y += 10) for (let x = 6 + ((y / 10) % 2) * 5; x < 512; x += 10) hg.fillRect(x, y, 3, 3);
  const hepaMat = ctx.track(new THREE.MeshStandardMaterial({ map: ctx.track(canvasTexture(hc)), roughness: 0.6, metalness: 0.3 }));
  const hepa = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(W - 2 * t, top - workY)), hepaMat);
  hepa.position.set(0, (top + workY) / 2, -D / 2 + t);
  group.add(hepa);
  box(W, top, t, 0, top / 2, -D / 2 + t / 2, shell);
  // Vách bên (kính trong hoặc tôn) + trụ khung tối.
  for (const s of [-1, 1]) {
    if (o.glassSides ?? true) {
      const side = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(D - 0.1, top - workY)), glassMat);
      side.rotation.y = Math.PI / 2;
      side.position.set(s * (W / 2 - 0.03), (top + workY) / 2, 0);
      side.renderOrder = 5;
      group.add(side);
    } else box(0.06, top - workY, D - 0.1, s * (W / 2 - 0.03), (top + workY) / 2, 0, shell);
    box(0.1, top - workY, 0.12, s * (W / 2 - 0.05), (top + workY) / 2, D / 2 - 0.06, trim);
    box(0.08, 0.1, D, s * (W / 2 - 0.04), top - 0.05, 0, shell);
  }
  // Kính chắn trượt: tấm kính + khung trên + thanh tay nắm ở mép dưới; ray hai bên.
  const sashH = Math.max(0.6, top - workY - (o.opening ?? 2.6));
  const sash = new THREE.Group();
  sash.name = 'sash';
  group.add(sash);
  const pane = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(W - 0.22, sashH)), glassMat);
  pane.position.set(0, sashH / 2, D / 2 - 0.02);
  pane.renderOrder = 6;
  sash.add(pane);
  box(W - 0.22, 0.05, 0.05, 0, sashH - 0.02, D / 2 - 0.02, trim, sash);
  const grip = box(W - 0.3, 0.1, 0.12, 0, 0, D / 2 - 0.01, trim, sash);
  grip.name = 'sash-grip';
  const maxOpen = top - workY - 0.3;
  const sashRange: [number, number] = [0, maxOpen];
  const setSash = (k: number) => {
    sash.position.y = workY + THREE.MathUtils.clamp(k, 0, maxOpen);
  };
  setSash(o.opening ?? 2.6);
  // Đèn huỳnh quang + đèn UV dưới hộp quạt.
  const tube = (color: number, z: number) => {
    const m = ctx.track(new THREE.MeshStandardMaterial({ color: LAB_PALETTE.liner, emissive: color, emissiveIntensity: 0, roughness: 0.3 }));
    const mesh = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.06, 0.06, W - 0.8, 12)), m);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(0, top - 0.1, z);
    group.add(mesh);
    return m;
  };
  const lightMat = tube(0xfff4e0, 0.6);
  const uvMat = tube(0x8a3cff, -0.6);
  const lamp = new THREE.PointLight(0xfff3dd, 0, 9, 1.6);
  lamp.position.set(0, top - 0.4, 0.5);
  const uvLamp = new THREE.PointLight(0x9a5cff, 0, 6, 1.6);
  uvLamp.position.set(0, top - 0.4, -0.6);
  group.add(lamp, uvLamp);
  const state = { light: false, uv: false, fan: false };
  const title = o.title ?? (o.kind === 'biosafety' ? labText('t_830eaa77f7d2') : labText('t_2ee70ff35523'));
  const draw = () =>
    lcd.draw((g, w, h) => {
      g.fillStyle = LAB_PALETTE.panel;
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8edf2';
      g.font = 'bold 44px system-ui';
      g.textBaseline = 'middle';
      g.fillText(title, 30, h / 2);
      const led = (x: number, label: string, on: boolean, color: string) => {
        drawLed(g, x, h / 2, 14, on, color);
        g.fillStyle = '#cfd6dd';
        g.font = '30px system-ui';
        g.fillText(label, x + 24, h / 2);
      };
      led(600, labText('t_8e20358ed4fb'), state.fan, '#3ddc84');
      led(750, labText('t_cb994ef8399d'), state.light, '#ffd54a');
      led(890, 'UV', state.uv, '#b26bff');
    });
  draw();
  const inner = { width: W - 2 * t, depth: D - t, height: top - workY };
  return {
    group,
    workY,
    inner,
    center: new THREE.Vector3(0, workY, t / 2 + 0.2),
    mouth: new THREE.Vector3(0, workY + 0.6, D / 2 + 0.2),
    sash,
    grip,
    setSash,
    sashRange,
    setLight(on) {
      state.light = on;
      lightMat.emissiveIntensity = on ? 1.6 : 0;
      lamp.intensity = on ? 2.2 : 0;
      draw();
    },
    setUV(on) {
      state.uv = on;
      uvMat.emissiveIntensity = on ? 2.4 : 0;
      uvLamp.intensity = on ? 1.4 : 0;
      draw();
    },
    setFan(on) {
      state.fan = on;
      draw();
    },
  };
}
