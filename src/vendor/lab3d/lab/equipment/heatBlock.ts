import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { labMaterials } from '../materials/kit';
import type { LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';
import { createLcd } from './parts';

/**
 * A-BO-U-NHIET: khối gia nhiệt / bộ ủ nhiệt khô (dry bath) n giếng một hàng – mặt nhôm có lỗ, vỏ xám xanh (LAB_PALETTE.device) + dải màu
 * nhận diện, dải màn số nghiêng ở mép trước hiện °C từng giếng (gradient nhiệt) hoặc một nhiệt độ chung. Gốc ở giữa đáy, mặt trước +z.
 * Mặc định 12 giếng Ø18 mm, bước 24 mm, sâu 44 mm (ống nghiệm 16 mm).
 */
export interface HeatBlockOptions {
  wells?: number;
  /** Bước giếng (đv). */
  pitch?: number;
  /** Đường kính lỗ giếng (mm). */
  wellDiameter?: number;
  /** Độ sâu giếng (mm). */
  wellDepth?: number;
  accent?: LabAccent | string;
  /** Màu mặt nhôm (mặc định 0xb9c0c8 – dưới preset bench hiện gần trắng; trên bàn sáng nên dùng 0x7a838d, nhám hơn). */
  plateColor?: THREE.ColorRepresentation;
}

export interface HeatBlock {
  group: THREE.Group;
  /** Đáy ống trong từng giếng (cục bộ group). */
  wells: THREE.Vector3[];
  /** Miệng từng giếng (cục bộ) – vùng thả ống. */
  mouths: THREE.Vector3[];
  /** Hiện nhiệt độ đặt của từng giếng (mảng 1 phần tử = chung); `active` = đang chạy (số sáng). */
  show(set: number[], active: boolean): void;
}

export function createHeatBlock(ctx: Tracker, o: HeatBlockOptions = {}): HeatBlock {
  const n = o.wells ?? 12;
  const pitch = o.pitch ?? mm(24);
  const r = mm((o.wellDiameter ?? 18) / 2);
  const depth = mm(o.wellDepth ?? 44);
  const W = n * pitch + mm(42);
  const D = mm(96);
  const H = depth + mm(14);
  const wellZ = -mm(10);
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'heat-block';
  const shell = new THREE.Mesh(ctx.track(new RoundedBoxGeometry(W + mm(20), H, D + mm(50), 3, mm(6))), mats.device());
  shell.position.set(0, H / 2, -mm(25));
  shell.castShadow = shell.receiveShadow = true;
  // Mặt nhôm có n lỗ (Shape có lỗ, đùn 2 mm).
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -D / 2);
  s.lineTo(W / 2, -D / 2);
  s.lineTo(W / 2, D / 2);
  s.lineTo(-W / 2, D / 2);
  s.closePath();
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch);
  for (const x of xs) {
    const h = new THREE.Path();
    h.absarc(x, wellZ, r, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const plateGeo = ctx.track(new THREE.ExtrudeGeometry(s, { depth: mm(2), bevelEnabled: false, curveSegments: 20 }));
  plateGeo.rotateX(Math.PI / 2);
  const plate = new THREE.Mesh(plateGeo, ctx.track(new THREE.MeshStandardMaterial({ color: o.plateColor ?? 0xb9c0c8, metalness: 0.85, roughness: o.plateColor === undefined ? 0.38 : 0.55 })));
  plate.position.y = H + mm(2.1);
  plate.receiveShadow = true;
  group.add(shell, plate);
  // Dải màu nhận diện quanh chân vỏ.
  const band = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(W + mm(21), mm(8), D + mm(51))), mats.plastic(o.accent ?? 'red'));
  band.position.set(0, mm(10), -mm(25));
  group.add(band);
  // Miệng giếng tối (ống cắm sâu vào khối, phần dưới bị khối che).
  const holeMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0x1d2126, metalness: 0.5, roughness: 0.7 }));
  const holeGeo = ctx.track(new THREE.CircleGeometry(r, 24));
  const wells: THREE.Vector3[] = [];
  const mouths: THREE.Vector3[] = [];
  for (const x of xs) {
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(x, H + mm(0.6), wellZ);
    group.add(hole);
    wells.push(new THREE.Vector3(x, H - depth + mm(2), wellZ));
    mouths.push(new THREE.Vector3(x, H + mm(2), wellZ));
  }
  // Dải màn số nghiêng ở mép trước, thẳng hàng với giếng.
  const lcd = createLcd(ctx, n * pitch, mm(24), Math.min(2048, n * 128));
  const panel = new THREE.Mesh(ctx.track(new RoundedBoxGeometry(n * pitch + mm(10), mm(30), mm(8), 2, mm(2.5))), mats.panel());
  lcd.mesh.position.z = mm(4.2);
  const face = new THREE.Group();
  face.add(panel, lcd.mesh);
  face.position.set(0, H + mm(6), mm(31));
  face.rotation.x = -1.05;
  group.add(face);
  let last = '';
  const api: HeatBlock = {
    group,
    wells,
    mouths,
    show(set, active) {
      const key = set.join(',') + active;
      if (key === last) return;
      last = key;
      lcd.draw((g, w, h) => {
        g.fillStyle = '#0b1612';
        g.fillRect(0, 0, w, h);
        const one = set.length === 1;
        const cw = one ? w : w / n;
        const cells = one ? [set[0]] : set.slice(0, n);
        cells.forEach((v, i) => {
          g.fillStyle = 'rgba(120,255,190,0.07)';
          g.fillRect(i * cw + 6, 8, cw - 12, h - 16);
          g.fillStyle = active ? '#7dffb6' : '#4c8f6c';
          g.font = `bold ${Math.round(h * 0.4)}px "DejaVu Sans Mono", monospace`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(v.toFixed(v % 1 ? 1 : 0).replace('.', ','), i * cw + cw / 2, h * 0.41);
          g.font = `${Math.round(h * 0.19)}px system-ui, sans-serif`;
          g.fillText(one ? '°C' : `°C · ${i + 1}`, i * cw + cw / 2, h * 0.8);
        });
      });
    },
  };
  api.show([37], false);
  return api;
}
