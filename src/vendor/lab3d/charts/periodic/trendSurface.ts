import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { bilinear } from './bilinear';
import { SCALE_COOL_WARM, valueColor } from './colorScale';

export interface TrendSurfaceOptions {
  /** Số cột/hàng của lưới giá trị (tâm ô). */
  cols: number;
  rows: number;
  /** Số đoạn chia mỗi ô (mịn). */
  sub?: number;
  opacity?: number;
  stops?: readonly number[];
}

export interface TrendSurface {
  group: THREE.Group;
  /**
   * Cập nhật: `heights[row][col]` (đv cảnh, đỉnh cột), `values[row][col]` (tô màu theo [min, max]),
   * `at(col, row)` → toạ độ x, z của tâm ô (cục bộ).
   */
  set(heights: readonly (readonly number[])[], values: readonly (readonly number[])[], min: number, max: number, at: (c: number, r: number) => [number, number]): void;
  setOpacity(v: number): void;
}

/**
 * "Bề mặt xu hướng": tấm lưới bán trong suốt phủ qua đỉnh các cột, độ cao nội suy song tuyến tính giữa các tâm ô,
 * màu theo thang giá trị, kèm lưới dây nối đỉnh các ô cạnh nhau (thấy "sườn dốc" của xu hướng).
 */
export function createTrendSurface(ctx: Pick<SimContext, 'track'>, o: TrendSurfaceOptions): TrendSurface {
  const sub = o.sub ?? 6;
  const nu = (o.cols - 1) * sub;
  const nv = (o.rows - 1) * sub;
  const opacity = o.opacity ?? 0.42;
  const geo = ctx.track(new THREE.PlaneGeometry(1, 1, nu, nv));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((nu + 1) * (nv + 1) * 3), 3));
  const mat = ctx.track(
    new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, roughness: 0.35, metalness: 0.05 }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  const nLines = o.rows * (o.cols - 1) + o.cols * (o.rows - 1);
  const wireGeo = ctx.track(new THREE.BufferGeometry());
  wireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nLines * 6), 3));
  const wireMat = ctx.track(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
  const wire = new THREE.LineSegments(wireGeo, wireMat);
  wire.renderOrder = 4;
  mesh.frustumCulled = wire.frustumCulled = false;
  const group = new THREE.Group();
  group.name = 'trend-surface';
  group.add(mesh, wire);
  const c = new THREE.Color();
  const lift = 0.03;

  return {
    group,
    set(heights, values, min, max, at) {
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const col = geo.getAttribute('color') as THREE.BufferAttribute;
      for (let j = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++) {
          const k = j * (nu + 1) + i;
          const u = i / sub;
          const v = j / sub;
          const iu = Math.min(o.cols - 2, Math.floor(u));
          const jv = Math.min(o.rows - 2, Math.floor(v));
          const [x0, z0] = at(iu, jv);
          const [x1, z1] = at(iu + 1, jv + 1);
          pos.setXYZ(k, x0 + (x1 - x0) * (u - iu), bilinear(heights, u, v) + lift, z0 + (z1 - z0) * (v - jv));
          c.setHex(valueColor(bilinear(values, u, v), min, max, o.stops ?? SCALE_COOL_WARM));
          col.setXYZ(k, c.r, c.g, c.b);
        }
      }
      pos.needsUpdate = col.needsUpdate = true;
      geo.computeVertexNormals();
      const w = wireGeo.getAttribute('position') as THREE.BufferAttribute;
      let n = 0;
      const put = (ca: number, ra: number, cb: number, rb: number) => {
        const [xa, za] = at(ca, ra);
        const [xb, zb] = at(cb, rb);
        w.setXYZ(n++, xa, heights[ra][ca] + lift, za);
        w.setXYZ(n++, xb, heights[rb][cb] + lift, zb);
      };
      for (let r = 0; r < o.rows; r++) for (let q = 0; q < o.cols - 1; q++) put(q, r, q + 1, r);
      for (let q = 0; q < o.cols; q++) for (let r = 0; r < o.rows - 1; r++) put(q, r, q, r + 1);
      w.needsUpdate = true;
    },
    setOpacity(v) {
      mat.opacity = opacity * v;
      wireMat.opacity = 0.55 * v;
      group.visible = v > 0.01;
    },
  };
}
