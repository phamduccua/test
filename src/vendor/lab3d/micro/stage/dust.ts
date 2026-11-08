import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { seeded } from '../atom/packing';
import { microMaterials } from '../materials';

/** Bụi sáng lơ lửng rất mờ quanh cảnh vi mô – tạo chiều sâu. */
export function createDust(ctx: Tracker, o: { count?: number; radius?: number; color?: THREE.ColorRepresentation } = {}) {
  const n = o.count ?? 260;
  const R = o.radius ?? 10;
  const rnd = seeded(5);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = R * (0.45 + 0.55 * Math.cbrt(rnd()));
    const u = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
  }
  const geo = ctx.track(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = ctx.track(
    new THREE.PointsMaterial({
      color: o.color ?? 0x9cc8ff,
      size: R * 0.012,
      map: microMaterials(ctx).glowTexture(),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const points = new THREE.Points(geo, mat);
  points.name = 'micro-dust';
  return {
    points,
    update(dt: number) {
      points.rotation.y += dt * 0.012;
      points.rotation.x += dt * 0.004;
    },
  };
}
