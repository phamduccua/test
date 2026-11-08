import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import { seeded } from './packing';
import { sample1sRadius } from './layout';

export interface ElectronCloud {
  points: THREE.Points;
  setOpacity(v: number): void;
  update(dt: number): void;
}

/** Đám mây electron kiểu orbital 1s: point cloud mật độ ∝ |ψ1s|² (cộng màu). */
export function createElectronCloud(
  ctx: Tracker,
  o: { count?: number; a0: number; color?: THREE.ColorRepresentation; size?: number; seed?: number },
): ElectronCloud {
  const n = o.count ?? 6000;
  const rnd = seeded(o.seed ?? 11);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = sample1sRadius(rnd, o.a0);
    const u = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
  }
  const geo = ctx.track(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = ctx.track(
    new THREE.PointsMaterial({
      color: o.color ?? 0x8fd3ff,
      size: o.size ?? 0.05,
      map: microMaterials(ctx).glowTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const points = new THREE.Points(geo, mat);
  points.name = 'electron-cloud';
  points.visible = false;
  return {
    points,
    setOpacity(v) {
      mat.opacity = v;
      points.visible = v > 0.01;
    },
    update(dt) {
      points.rotation.y += dt * 0.15;
    },
  };
}
