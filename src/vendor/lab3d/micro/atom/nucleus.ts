import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { assignProtons, clusterRadius, packSpheres } from './packing';

/** 'chrome' = cầu ánh kim như bìa sách; 'science' = proton đỏ / neutron xám xanh. */
export type NucleusStyle = 'chrome' | 'science';

export interface NucleusOptions {
  protons: number;
  neutrons: number;
  /** Bán kính một nucleon (đơn vị cảnh). */
  nucleonRadius?: number;
  style?: NucleusStyle;
  protonColor?: THREE.ColorRepresentation;
  neutronColor?: THREE.ColorRepresentation;
  seed?: number;
}

export interface Nucleus {
  mesh: THREE.InstancedMesh;
  /** Bán kính bao của cả khối. */
  radius: number;
  /** true = proton, theo thứ tự instance. */
  isProton: boolean[];
  positions: THREE.Vector3[];
  setStyle(style: NucleusStyle): void;
  /** Trộn mượt giữa 2 kiểu: 0 = chrome, 1 = science. */
  setMix(t: number): void;
}

/** Hạt nhân: InstancedMesh các quả cầu proton/neutron xếp chặt (packSpheres). */
export function createNucleus(ctx: Tracker, o: NucleusOptions): Nucleus {
  const r = o.nucleonRadius ?? 0.1;
  const total = Math.max(1, o.protons + o.neutrons);
  const pts = packSpheres(total, r);
  const isProton = assignProtons(total, o.protons, o.seed);
  const geo = ctx.track(new THREE.SphereGeometry(r * 0.985, 40, 28));
  const mat = ctx.track(
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.7 }),
  );
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.name = 'nucleus';
  const m = new THREE.Matrix4();
  const positions = pts.map((p) => new THREE.Vector3(...p));
  positions.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p)));
  mesh.castShadow = true;

  const chrome = new THREE.Color(0xf2f5fa);
  const pc = new THREE.Color(o.protonColor ?? 0xe0402f);
  const nc = new THREE.Color(o.neutronColor ?? 0x8d9db8);
  const tmp = new THREE.Color();
  const setMix = (t: number) => {
    const k = THREE.MathUtils.clamp(t, 0, 1);
    for (let i = 0; i < total; i++) mesh.setColorAt(i, tmp.lerpColors(chrome, isProton[i] ? pc : nc, k));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mat.metalness = 1 - 0.85 * k;
    mat.roughness = 0.1 + 0.22 * k;
  };
  setMix(o.style === 'science' ? 1 : 0);
  return {
    mesh,
    radius: clusterRadius(total, r),
    isProton,
    positions,
    setStyle: (s) => setMix(s === 'science' ? 1 : 0),
    setMix,
  };
}
