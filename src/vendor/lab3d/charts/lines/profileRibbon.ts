import * as THREE from 'three';
import type { SimContext } from '../../sim/types';

export interface ProfileRibbon {
  mesh: THREE.Mesh;
  /** Vùng tô từ đường gấp khúc xuống mặt y = `base` (cùng mặt phẳng với các điểm). */
  set(points: readonly THREE.Vector3[], base?: number): void;
  setOpacity(v: number): void;
}

/**
 * "Địa hình" dưới đồ thị đường: dải tô bán trong suốt (đậm ở mép trên, nhạt dần xuống đáy) – như vùng
 * dưới đường cong, giúp thấy rõ các đỉnh/thung lũng. Màu đỉnh theo `color`, độ trong theo `opacity`.
 */
export function createProfileRibbon(ctx: Pick<SimContext, 'track'>, max: number, color = 0xe8322f, opacity = 0.42): ProfileRibbon {
  const pos = new Float32Array(max * 2 * 3);
  const col = new Float32Array(max * 2 * 4);
  const geo = ctx.track(new THREE.BufferGeometry());
  const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const idx: number[] = [];
  for (let i = 0; i < max - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  const c = new THREE.Color(color);
  const deep = c.clone().multiplyScalar(0.35);
  for (let i = 0; i < max; i++) {
    col.set([c.r, c.g, c.b, 1], i * 8);
    col.set([deep.r, deep.g, deep.b, 0.12], i * 8 + 4);
  }
  const mat = ctx.track(
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'profile-ribbon';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return {
    mesh,
    set(points, base = 0) {
      const n = Math.min(max, points.length);
      for (let i = 0; i < n; i++) {
        const p = points[i];
        pos.set([p.x, p.y, p.z, p.x, base, p.z], i * 6);
      }
      geo.setDrawRange(0, Math.max(0, n - 1) * 6);
      aPos.needsUpdate = true;
    },
    setOpacity(v) {
      mat.opacity = opacity * v;
      mesh.visible = v > 0.01;
    },
  };
}
