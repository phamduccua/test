import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { element, massNumber } from '../elements';
import { layoutOrbits, type OrbitArrangement } from './layout';
import { createNucleus, type Nucleus, type NucleusStyle } from './nucleus';
import { createOrbit, type Orbit, type OrbitStyle } from './orbit';

export interface BohrAtomOptions {
  /** Số hiệu nguyên tử (số proton). */
  Z: number;
  /** Số khối (mặc định = nguyên tử khối làm tròn). */
  A?: number;
  /** Số electron từng lớp (mặc định theo cấu hình của Z; cho ion thì truyền vào). */
  shells?: number[];
  nucleonRadius?: number;
  /** Bán kính lớp K (mặc định ≈ 2,2 × bán kính hạt nhân). */
  firstRadius?: number;
  gap?: number;
  arrangement?: OrbitArrangement;
  tilt?: number;
  radiusJitter?: number;
  orbitStyle?: OrbitStyle;
  tube?: number;
  electronRadius?: number;
  ringColor?: THREE.ColorRepresentation;
  electronColor?: THREE.ColorRepresentation;
  nucleusStyle?: NucleusStyle;
  /** Vệt sáng sau electron (rad). */
  trail?: number;
  omega?: number;
  seed?: number;
}

export interface BohrAtom {
  group: THREE.Group;
  nucleus: Nucleus;
  orbits: Orbit[];
  /** Hệ số tốc độ electron (0 = dừng). */
  speed: number;
  /** Độ hiện của các vòng + electron (0…1) – để chuyển sang mô hình đám mây. */
  setOrbitsOpacity(v: number): void;
  update(dt: number): void;
}

/** Nguyên tử kiểu Rutherford–Bohr: hạt nhân xếp chặt + lớp electron dạng vòng, electron chạy quanh. */
export function createBohrAtom(ctx: Tracker, o: BohrAtomOptions): BohrAtom {
  const A = o.A ?? massNumber(o.Z);
  const nucleus = createNucleus(ctx, {
    protons: o.Z,
    neutrons: Math.max(0, A - o.Z),
    nucleonRadius: o.nucleonRadius ?? 0.1,
    style: o.nucleusStyle ?? 'science',
    seed: o.seed,
  });
  const group = new THREE.Group();
  group.name = `bohr-atom-${element(Math.min(o.Z, 36)).symbol}`;
  group.add(nucleus.mesh);
  const shells = o.shells ?? element(o.Z).shells;
  const first = o.firstRadius ?? Math.max(nucleus.radius * 2.2, nucleus.radius + 0.25);
  const specs = layoutOrbits(shells, {
    arrangement: o.arrangement,
    firstRadius: first,
    gap: o.gap ?? first * 0.6,
    tilt: o.tilt,
    omega: o.omega,
    seed: o.seed,
    radiusJitter: o.radiusJitter,
  });
  const style = o.orbitStyle ?? 'glow';
  const tube = o.tube ?? first * 0.006;
  const orbits = specs.map((spec) =>
    createOrbit(ctx, spec, {
      style,
      tube,
      electronRadius: o.electronRadius ?? Math.max(tube * 3, first * 0.035),
      ringColor: o.ringColor ?? 0x7cc4ff,
      electronColor: o.electronColor ?? 0x9fe2ff,
      trail: o.trail ?? (style === 'glow' ? 1.2 : 0),
    }),
  );
  for (const orb of orbits) group.add(orb.group);

  const mats = new Set<THREE.Material>();
  const base = new Map<THREE.Material, { opacity: number; depth: boolean; transparent: boolean }>();
  for (const orb of orbits) {
    orb.group.traverse((obj) => {
      const m = (obj as THREE.Mesh | THREE.Sprite).material as THREE.Material | undefined;
      if (m && !mats.has(m)) {
        mats.add(m);
        base.set(m, { opacity: m.opacity, depth: m.depthWrite, transparent: m.transparent });
      }
    });
  }

  const atom: BohrAtom = {
    group,
    nucleus,
    orbits,
    speed: 1,
    setOrbitsOpacity(v) {
      for (const m of mats) {
        const b = base.get(m);
        if (!b) continue;
        const full = v > 0.98;
        m.transparent = full ? b.transparent : true;
        m.opacity = b.opacity * v;
        m.depthWrite = full && b.depth;
      }
      for (const orb of orbits) orb.group.visible = v > 0.01;
    },
    update(dt) {
      for (const orb of orbits) {
        for (const p of orb.pivots) p.rotation.z += orb.spec.omega * atom.speed * dt;
      }
    },
  };
  return atom;
}
