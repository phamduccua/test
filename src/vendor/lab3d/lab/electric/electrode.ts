import * as THREE from 'three';
import { createMetalMaterial, createPlasticMaterial, createRubberMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';
import { electricMat, nickel, POLE_COLORS } from './parts';

export type ElectrodeMaterial = 'graphite' | 'copper' | 'steel' | 'platinum';

export interface ElectrodeOptions {
  material?: ElectrodeMaterial;
  /** Chiều dài thanh (đv). */
  length?: number;
  diameter?: number;
  /** Kẹp cá sấu ở đầu trên (màu vỏ cao su). null = không kẹp. */
  clip?: THREE.ColorRepresentation | null;
}

export interface Electrode {
  group: THREE.Group;
  rod: THREE.Mesh;
  length: number;
  radius: number;
  /** Điểm nối dây ở đuôi kẹp (cục bộ, gốc = đầu dưới thanh). */
  wirePoint: THREE.Vector3;
  /** Hướng dây rời kẹp (cục bộ). */
  wireDir: THREE.Vector3;
}

export function electrodeMaterial(ctx: Tracker, kind: ElectrodeMaterial): THREE.Material {
  return electricMat(ctx, `electrode-${kind}`, () => {
    if (kind === 'graphite') return new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.55, metalness: 0.35 });
    if (kind === 'copper') return createMetalMaterial(0xc77b4d, 0.32, 1);
    if (kind === 'platinum') return createMetalMaterial(0xe1e3e6, 0.18, 1);
    return createMetalMaterial(0xb9bec4, 0.3, 1);
  });
}

/** Kẹp cá sấu: hai hàm răng cưa kim loại + vỏ cao su màu. Gốc ở miệng kẹp, đuôi theo +y. */
export function createCrocClip(ctx: Tracker, color: THREE.ColorRepresentation): { group: THREE.Group; tail: THREE.Vector3 } {
  const group = new THREE.Group();
  group.name = 'croc-clip';
  const boot = electricMat(ctx, `boot-${new THREE.Color(color).getHexString()}`, () => {
    const m = createRubberMaterial(color);
    m.roughness = 0.5;
    return m;
  });
  for (const s of [-1, 1]) {
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(mm(1), mm(20), mm(5)), nickel(ctx));
    jaw.position.set(s * mm(1.6), mm(10), 0);
    jaw.rotation.z = s * 0.06;
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(mm(1.4), mm(6), mm(5.2)), nickel(ctx));
    teeth.position.set(s * mm(1.2), mm(3), 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(mm(3.4), mm(2.6), mm(16), 12), boot);
    sleeve.position.set(s * mm(2.6), mm(22), 0);
    sleeve.rotation.z = s * 0.1;
    sleeve.scale.z = 0.8;
    group.add(jaw, teeth, sleeve);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(mm(2.2), mm(3), mm(8), 12), boot);
  tail.position.y = mm(32);
  group.add(tail);
  group.traverse((m) => (m.castShadow = true));
  return { group, tail: new THREE.Vector3(0, mm(36), 0) };
}

/** Điện cực thanh (than chì / đồng / thép), gốc ở đầu dưới, có thể gắn kẹp cá sấu ở đầu trên. */
export function createElectrode(ctx: Tracker, o: ElectrodeOptions = {}): Electrode {
  const length = o.length ?? mm(110);
  const radius = (o.diameter ?? mm(6)) / 2;
  const group = new THREE.Group();
  group.name = 'electrode';
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 20), electrodeMaterial(ctx, o.material ?? 'graphite'));
  rod.position.y = length / 2;
  rod.castShadow = true;
  group.add(rod);
  const wirePoint = new THREE.Vector3(0, length, 0);
  if (o.clip !== null) {
    const c = createCrocClip(ctx, o.clip ?? POLE_COLORS.plus);
    c.group.position.y = length - mm(8);
    group.add(c.group);
    wirePoint.copy(c.tail).add(c.group.position);
  }
  return { group, rod, length, radius, wirePoint, wireDir: new THREE.Vector3(0, 1, 0) };
}

export interface ElectrodePairOptions {
  material?: ElectrodeMaterial;
  /** Khoảng cách tâm hai điện cực (đv). */
  gap?: number;
  /** Phần thanh thò xuống dưới thanh giữ (đv). */
  reach?: number;
  diameter?: number;
  holderColor?: THREE.ColorRepresentation;
  /** Vẽ nhãn lên mặt trước thanh giữ (canvas 512×128). */
  decal?: (g: CanvasRenderingContext2D) => void;
}

export interface ElectrodePair {
  group: THREE.Group;
  /** [trái = nối cực âm, phải = nối cực dương]. */
  electrodes: [Electrode, Electrode];
  gap: number;
  /** Điểm nối dây của từng điện cực (cục bộ group). */
  wirePoints: [THREE.Vector3, THREE.Vector3];
}

/** Cặp điện cực song song gắn trên thanh giữ cách điện (gốc = đầu dưới hai điện cực, tâm giữa). */
export function createElectrodePair(ctx: Tracker, o: ElectrodePairOptions = {}): ElectrodePair {
  const gap = o.gap ?? mm(26);
  const reach = o.reach ?? mm(80);
  const group = new THREE.Group();
  group.name = 'electrode-pair';
  const hW = gap + mm(22);
  const hH = mm(16);
  const holder = new THREE.Mesh(
    new THREE.BoxGeometry(hW, hH, mm(12)),
    electricMat(ctx, `holder-${new THREE.Color(o.holderColor ?? 0x1f5fb0).getHexString()}`, () => {
      const m = createPlasticMaterial(o.holderColor ?? 0x1f5fb0, 0.35);
      m.clearcoat = 0.6;
      return m;
    }),
  );
  holder.position.y = reach + hH / 2;
  holder.castShadow = true;
  group.add(holder);
  if (o.decal) {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 128;
    const g = cv.getContext('2d');
    if (g) {
      o.decal(g);
      const tex = ctx.track(new THREE.CanvasTexture(cv));
      tex.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(hW * 0.86, hH * 0.7),
        ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, transparent: true })),
      );
      plate.position.set(0, holder.position.y, mm(6.05));
      group.add(plate);
    }
  }
  const len = reach + hH + mm(14);
  const colors = [POLE_COLORS.minus, POLE_COLORS.plus];
  const electrodes = [-1, 1].map((s, k) => {
    const e = createElectrode(ctx, { material: o.material, length: len, diameter: o.diameter, clip: colors[k] });
    e.group.position.x = (s * gap) / 2;
    group.add(e.group);
    return e;
  }) as [Electrode, Electrode];
  const wirePoints = electrodes.map((e) => e.group.position.clone().add(e.wirePoint)) as [THREE.Vector3, THREE.Vector3];
  return { group, electrodes, gap, wirePoints };
}
