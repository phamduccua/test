import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createPlasticMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';
import { createBindingPost, electricMat, nickel, POLE_COLORS } from './parts';
import { labText } from '../../text';

export interface BatteryPackOptions {
  cells?: number;
  cellVoltage?: number;
  /** Dòng chữ trên nhãn hộp (mặc định "Nguồn điện: 2 × 1,5 V"). */
  label?: string;
}

export interface BatteryPack {
  group: THREE.Group;
  voltage: number;
  /** Điểm nối dây cực dương / âm (cục bộ). */
  plus: THREE.Vector3;
  minus: THREE.Vector3;
}

/** Vỏ pin AA kiểu alkaline (Hình 11.2): nửa đen, nửa vàng kim, chữ dọc thân. */
function cellMaterial(ctx: Tracker): THREE.MeshPhysicalMaterial {
  return electricMat(ctx, 'cell-label', () => {
    const { canvas, g } = makeCanvas(256, 512);
    g.fillStyle = '#16171a';
    g.fillRect(0, 0, 256, 512);
    const gold = g.createLinearGradient(0, 0, 256, 0);
    gold.addColorStop(0, '#b88a12');
    gold.addColorStop(0.5, '#ffd84a');
    gold.addColorStop(1, '#b88a12');
    g.fillStyle = gold;
    g.fillRect(0, 300, 256, 212);
    g.save();
    g.translate(128, 256);
    g.rotate(-Math.PI / 2);
    g.font = 'bold 64px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f2c230';
    g.fillText('ALKALINE', 40, 0);
    g.fillStyle = '#16171a';
    g.font = 'bold 54px sans-serif';
    g.fillText('1.5V', -170, 0);
    g.restore();
    return new THREE.MeshPhysicalMaterial({ map: canvasTexture(canvas), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  });
}

/** Hộp pin nối tiếp (mặc định 2 pin AA = 3 V) có cọc đỏ (+) / đen (−) và nhãn. Gốc ở đáy, pin nằm dọc trục x. */
export function createBatteryPack(ctx: Tracker, o: BatteryPackOptions = {}): BatteryPack {
  const n = o.cells ?? 2;
  const v = o.cellVoltage ?? 1.5;
  const group = new THREE.Group();
  group.name = 'battery-pack';
  const D = mm(14.5);
  const L = mm(50.5);
  const W = n * (D + mm(1.5)) + mm(5);
  const LEN = L + mm(10);
  const H = mm(13);
  const shell = electricMat(ctx, 'pack-shell', () => createPlasticMaterial(0x1f2329, 0.55));
  const floor = new THREE.Mesh(new RoundedBoxGeometry(LEN, mm(3), W, 2, mm(1)), shell);
  floor.position.y = mm(1.5);
  group.add(floor);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(LEN, H, mm(1.6)), shell);
    side.position.set(0, H / 2, (s * (W - mm(1.6))) / 2);
    const end = new THREE.Mesh(new THREE.BoxGeometry(mm(2.5), H, W), shell);
    end.position.set((s * (LEN - mm(2.5))) / 2, H / 2, 0);
    group.add(side, end);
  }
  const cellMat = cellMaterial(ctx);
  for (let i = 0; i < n; i++) {
    const cell = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(D / 2, D / 2, L - mm(2), 32), cellMat);
    const nub = new THREE.Mesh(new THREE.CylinderGeometry(mm(2.7), mm(2.7), mm(1.6), 16), nickel(ctx));
    nub.position.y = L / 2 - mm(0.4);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(D / 2 - mm(0.3), D / 2 - mm(0.3), mm(1), 32), nickel(ctx));
    cap.position.y = -L / 2 + mm(1.4);
    cell.add(body, nub, cap);
    cell.rotation.z = (i % 2 ? 1 : -1) * (Math.PI / 2);
    cell.rotation.x = Math.PI * 0.85;
    cell.position.set(0, mm(3) + D / 2, (i - (n - 1) / 2) * (D + mm(1.5)));
    cell.traverse((m) => (m.castShadow = true));
    group.add(cell);
  }
  // Khối cọc đấu dây phía trước (+z).
  const block = new THREE.Mesh(new RoundedBoxGeometry(LEN * 0.74, mm(13), mm(14), 2, mm(2)), shell);
  block.position.set(0, mm(6.5), W / 2 + mm(7));
  block.castShadow = true;
  group.add(block);
  const posts = [POLE_COLORS.minus, POLE_COLORS.plus].map((c, k) => {
    const p = createBindingPost(ctx, c);
    p.group.position.set((k ? 1 : -1) * LEN * 0.24, mm(13), W / 2 + mm(7));
    group.add(p.group);
    return p.group.position.clone().add(p.wirePoint);
  });
  // Nhãn.
  const { canvas, g } = makeCanvas(512, 128);
  g.fillStyle = '#f4f1e8';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#20252b';
  g.font = 'bold 44px sans-serif';
  g.textAlign = 'center';
  g.fillText(o.label ?? `${labText('t_c162aa500a8a')}${n}${labText('t_487162abb84b')}${String(v).replace('.', ',')} V`, 256, 62);
  g.font = '30px sans-serif';
  g.fillText('−            +', 256, 108);
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(LEN * 0.66, LEN * 0.165),
    ctx.track(new THREE.MeshStandardMaterial({ map: ctx.track(canvasTexture(canvas)), roughness: 0.6 })),
  );
  plate.position.set(0, mm(6.5), W / 2 + mm(14.05));
  group.add(plate);
  group.traverse((m) => ((m as THREE.Mesh).isMesh && (m.receiveShadow = true)));
  return { group, voltage: n * v, minus: posts[0], plus: posts[1] };
}
