import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createMetalMaterial, createPlasticMaterial } from '../materials/factories';
import { LAB_PALETTE } from '../materials/palette';
import type { Tracker } from '../types';
import { labText } from '../../text';

/**
 * A-GIA-NUOI: giá nuôi cấy mô inox hai tầng, mỗi tầng có đèn LED trắng gắn dưới tầng trên; bảng hiển thị nhiệt độ phòng nuôi,
 * quang chu kì và số ngày nuôi. Gốc ở tâm đáy, mặt trước +z. Mặc định 3,2 × 2 × 4,4 dm.
 */
export interface GrowthShelf {
  group: THREE.Group;
  /** Mặt khay dưới / khay trên (cục bộ group). */
  shelves: number[];
  setLights(on: boolean): void;
  setDisplay(tempC: number, lightHours: number, day: number | null): void;
}

export function createGrowthShelf(ctx: Tracker, o: { width?: number; depth?: number; height?: number } = {}): GrowthShelf {
  const W = o.width ?? 3.2;
  const D = o.depth ?? 2;
  const H = o.height ?? 4.4;
  const group = new THREE.Group();
  group.name = 'growth-shelf';
  const steel = ctx.track(createMetalMaterial(0x9aa2ab, 0.3, 0.9));
  const tray = ctx.track(createPlasticMaterial(LAB_PALETTE.cabinet, 0.5));
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(ctx.track(geo), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) add(new THREE.CylinderGeometry(0.05, 0.05, H, 10), steel, x, H / 2, z);
  const shelves = [0.25, 2.25];
  const ledMats: THREE.MeshStandardMaterial[] = [];
  const lights: THREE.PointLight[] = [];
  for (const y of [...shelves, H - 0.04]) add(new THREE.BoxGeometry(W + 0.06, 0.04, D + 0.06), tray, 0, y - 0.02, 0);
  for (const y of [shelves[1], H - 0.04]) {
    const m = ctx.track(new THREE.MeshStandardMaterial({ color: LAB_PALETTE.liner, emissive: 0xf4f8ff, emissiveIntensity: 0, roughness: 0.3 }));
    ledMats.push(m);
    for (const z of [-0.45, 0.35]) add(new THREE.BoxGeometry(W - 0.4, 0.05, 0.14), m, 0, y - 0.07, z);
    const l = new THREE.PointLight(0xf3f6ff, 0, 3.5, 1.5);
    l.position.set(0, y - 0.3, 0.2);
    group.add(l);
    lights.push(l);
  }
  // Bảng hiển thị gắn ở mép trước tầng trên.
  const { canvas, g } = makeCanvas(512, 96);
  const tex = ctx.track(canvasTexture(canvas));
  const box = add(new THREE.BoxGeometry(1.5, 0.3, 0.06), ctx.track(createPlasticMaterial('#2c333b', 0.4)), 0, shelves[1] + 0.2, D / 2 + 0.05);
  const lcd = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(1.42, 0.26)), ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  lcd.position.z = 0.032;
  box.add(lcd);
  const api: GrowthShelf = {
    group,
    shelves,
    setLights(on) {
      ledMats.forEach((m) => (m.emissiveIntensity = on ? 1.4 : 0));
      lights.forEach((l) => (l.intensity = on ? 1.6 : 0));
    },
    setDisplay(T, hours, day) {
      g.fillStyle = '#0d1a14';
      g.fillRect(0, 0, 512, 96);
      g.textBaseline = 'middle';
      g.font = 'bold 40px monospace';
      g.fillStyle = '#5dff9a';
      g.fillText(`${T.toFixed(1).replace('.', ',')}°C`, 14, 48);
      g.font = 'bold 30px monospace';
      g.fillStyle = '#ffe07a';
      g.fillText(`☀${hours}h`, 200, 48);
      if (day !== null) {
        g.fillStyle = '#9fd3ff';
        g.fillText(`${labText('t_e196e19be238')}${Math.floor(day)}`, 320, 48);
      }
      tex.needsUpdate = true;
    },
  };
  api.setDisplay(25, 16, null);
  return api;
}
