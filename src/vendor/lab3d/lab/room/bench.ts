import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { labMaterials } from '../materials/kit';
import { epoxyTextures, woodTexture } from '../materials/textures';
import type { Tracker } from '../types';
import { mm } from '../units';

export type BenchTop = 'epoxy' | 'white' | 'wood';

export interface BenchOptions {
  width?: number;
  depth?: number;
  /** Chiều cao bàn (mặt bàn ở y = 0, sàn ở y = −height). */
  height?: number;
  top?: BenchTop;
  /** Nhân màu mặt bàn (mặc định như cũ) – preset ánh sáng đỡ chói mặt bàn trắng. */
  topTint?: THREE.ColorRepresentation;
  /** Màu cánh tủ dưới bàn (mặc định trắng như cũ) – preset ánh sáng đặt LAB_PALETTE.cabinet cho khỏi trắng chồng trắng. */
  cabinetColor?: THREE.ColorRepresentation;
}

function topMaterial(kind: BenchTop): THREE.MeshPhysicalMaterial {
  if (kind === 'wood') {
    return new THREE.MeshPhysicalMaterial({ map: woodTexture('#b88a58', '#7a4f2a', 9), roughness: 0.45, clearcoat: 0.4 });
  }
  if (kind === 'white') {
    return new THREE.MeshPhysicalMaterial({ color: 0xf2f3f4, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  }
  const { map, rough } = epoxyTextures();
  return new THREE.MeshPhysicalMaterial({
    map,
    roughnessMap: rough,
    roughness: 0.7,
    clearcoat: 0.18,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.4,
  });
}

/** A-BAN-THI-NGHIEM – mặt bàn chống hoá chất + tủ ngăn kéo bên dưới. Mặt bàn ở y = 0. */
export function createBench(ctx: Tracker, o: BenchOptions = {}): THREE.Group {
  const W = o.width ?? 18;
  const D = o.depth ?? 7.5;
  const H = o.height ?? 9;
  const T = mm(30);
  const mats = labMaterials(ctx);
  const g = new THREE.Group();
  g.name = 'bench';
  const topMat = ctx.track(topMaterial(o.top ?? 'epoxy'));
  if (o.topTint !== undefined) topMat.color.multiply(new THREE.Color(o.topTint));
  const top = new THREE.Mesh(new RoundedBoxGeometry(W, T, D, 3, mm(6)), topMat);
  top.position.y = -T / 2;
  top.receiveShadow = true;
  top.castShadow = true;
  g.add(top);
  const cabMat = ctx.track(new THREE.MeshPhysicalMaterial({ color: o.cabinetColor ?? 0xe9edf1, roughness: 0.45, clearcoat: 0.2 }));
  const gapMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0x8a939d, roughness: 0.8 }));
  const cabH = H - T - mm(120);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, cabH, D - 0.6), gapMat);
  cab.position.set(0, -T - cabH / 2, -0.15);
  g.add(cab);
  // Cánh tủ / ngăn kéo: các tấm bo góc lồi ra phía trước
  const cols = Math.max(3, Math.round(W / 4.5));
  const cw = (W - 0.3) / cols;
  for (let i = 0; i < cols; i++) {
    const rows = i % 2 === 0 ? 3 : 1;
    const rh = cabH / rows;
    for (let j = 0; j < rows; j++) {
      const panel = new THREE.Mesh(new RoundedBoxGeometry(cw - mm(30), rh - mm(30), mm(20), 2, mm(6)), cabMat);
      const y = -T - j * rh - rh / 2;
      panel.position.set(-W / 2 + 0.15 + cw * (i + 0.5), y, D / 2 - 0.45);
      panel.castShadow = panel.receiveShadow = true;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.2, cw * 0.35), mm(14), mm(16)), o.cabinetColor === undefined ? mats.steel() : mats.trim());
      handle.position.set(0, rows === 1 ? rh / 2 - mm(120) : rh / 2 - mm(70), mm(16));
      panel.add(handle);
      g.add(panel);
    }
  }
  const kick = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, mm(120), D - 1), mats.darkPlastic());
  kick.position.set(0, -H + mm(60), -0.3);
  g.add(kick);
  return g;
}
