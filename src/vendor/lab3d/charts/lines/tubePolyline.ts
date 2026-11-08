import * as THREE from 'three';
import type { SimContext } from '../../sim/types';

export interface TubePolylineOptions {
  /** Số điểm tối đa. */
  max: number;
  /** Bán kính thân ống (đv cảnh). */
  radius?: number;
  /** Bán kính chấm tại các đỉnh (0 = không có chấm). */
  dotRadius?: number;
  color?: number;
  dotColor?: number;
}

export interface TubePolyline {
  group: THREE.Group;
  /**
   * Đặt các điểm. `dots` = số điểm đầu có chấm (mặc định = tất cả; điểm cuối của nét đang vẽ dở thường không có chấm).
   * `weight(i)` ∈ 0…1 = độ dày đoạn i → i+1 (0 = ẩn đoạn, vd. nối giữa hai chu kì trong bố cục lưới).
   */
  set(points: readonly THREE.Vector3[], o?: { dots?: number; weight?(i: number): number }): void;
  setColor(c: number): void;
  setVisible(v: boolean): void;
}

/** Đường gấp khúc 3D: các đoạn trụ (InstancedMesh) + chấm cầu tại đỉnh – nét dày, có bóng, đẹp hơn THREE.Line 1 px. */
export function createTubePolyline(ctx: Pick<SimContext, 'track'>, o: TubePolylineOptions): TubePolyline {
  const r = o.radius ?? 0.045;
  const dr = o.dotRadius ?? r * 2.4;
  const segGeo = ctx.track(new THREE.CylinderGeometry(1, 1, 1, 14, 1, true));
  segGeo.translate(0, 0.5, 0);
  const mat = ctx.track(
    new THREE.MeshStandardMaterial({ color: o.color ?? 0xe8322f, roughness: 0.35, metalness: 0.1, emissive: o.color ?? 0xe8322f, emissiveIntensity: 0.45 }),
  );
  const dotMat = ctx.track(
    new THREE.MeshStandardMaterial({ color: o.dotColor ?? 0x1b1e24, roughness: 0.3, metalness: 0.2, emissive: 0x000000 }),
  );
  const segs = new THREE.InstancedMesh(segGeo, mat, Math.max(1, o.max - 1));
  const dots = new THREE.InstancedMesh(ctx.track(new THREE.SphereGeometry(1, 20, 14)), dotMat, o.max);
  segs.castShadow = dots.castShadow = true;
  segs.frustumCulled = dots.frustumCulled = false;
  segs.count = dots.count = 0;
  ctx.track(() => {
    segs.dispose();
    dots.dispose();
  });
  const group = new THREE.Group();
  group.name = 'tube-polyline';
  group.add(segs, dots);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const d = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  return {
    group,
    set(points, opt = {}) {
      const n = Math.min(points.length, o.max);
      let k = 0;
      for (let i = 0; i < n - 1; i++) {
        const w = opt.weight ? opt.weight(i) : 1;
        d.subVectors(points[i + 1], points[i]);
        const len = d.length();
        if (w < 0.02 || len < 1e-4) continue;
        q.setFromUnitVectors(UP, d.divideScalar(len));
        s.set(r * w, len, r * w);
        segs.setMatrixAt(k++, m.compose(points[i], q, s));
      }
      segs.count = k;
      segs.instanceMatrix.needsUpdate = true;
      const nd = dr > 0 ? Math.min(n, opt.dots ?? n) : 0;
      q.identity();
      s.setScalar(dr);
      for (let i = 0; i < nd; i++) dots.setMatrixAt(i, m.compose(points[i], q, s));
      dots.count = nd;
      dots.instanceMatrix.needsUpdate = true;
    },
    setColor(c) {
      mat.color.setHex(c);
      mat.emissive.setHex(c);
    },
    setVisible(v) {
      group.visible = v;
    },
  };
}
