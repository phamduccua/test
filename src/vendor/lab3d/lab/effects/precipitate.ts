import * as THREE from 'three';
import { radiusAt, type VesselProfile } from '../glassware/profile';
import { latheFromProfile } from '../glassware/vessel';
import { liquidInner, liquidShape } from '../liquid/meniscus';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface PrecipitateOptions {
  color?: THREE.ColorRepresentation;
  /** Hạt sinh / giây khi `forming`. */
  rate?: number;
  /** Vận tốc lắng (đơn vị/s, đã tua nhanh). */
  fallSpeed?: number;
  maxCount?: number;
  /** Bề dày tối đa lớp lắng đáy. */
  maxLayer?: number;
  surface: () => number;
}

export interface Precipitate {
  group: THREE.Group;
  forming: boolean;
  /** Số bông sinh ra mỗi giây khi `forming` – gán được lúc chạy (vd. theo tốc độ phản ứng). */
  rate: number;
  /** Bề dày tối đa lớp lắng đáy; 0 = không tạo lớp lắng (chỉ bông lơ lửng/rơi). */
  maxLayer: number;
  /** Bề dày lớp lắng hiện tại. */
  readonly layer: number;
  update(dt: number): void;
  clear(): void;
}

/** A-KET-TUA – bông kết tủa (InstancedMesh đục) lắng dần + lớp lắng đáy dày lên. */
export function createPrecipitate(ctx: Tracker, profile: VesselProfile, o: PrecipitateOptions): Precipitate {
  const group = new THREE.Group();
  group.name = 'precipitate';
  const n = o.maxCount ?? 400;
  let rate = o.rate ?? 60;
  const fall = o.fallSpeed ?? 0.08;
  let maxLayer = o.maxLayer ?? mm(6);
  const inner = liquidInner(profile.inner, mm(0.4));
  const mat = ctx.track(new THREE.MeshStandardMaterial({ color: o.color ?? 0xf2f2f0, roughness: 0.9 }));
  const flakes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat, n);
  flakes.count = 0;
  flakes.frustumCulled = false;
  flakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const layerMesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  layerMesh.receiveShadow = true;
  group.add(flakes, layerMesh);
  const xs = new Float32Array(n * 4); // x, y, z, size
  let count = 0;
  let acc = 0;
  let layer = 0;
  let builtLayer = -1;
  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const rebuildLayer = () => {
    if (Math.abs(layer - builtLayer) < mm(0.15)) return;
    builtLayer = layer;
    const shape = liquidShape(inner, inner[0].y + layer, -mm(0.6));
    layerMesh.visible = !!shape;
    if (!shape) return;
    layerMesh.geometry.dispose();
    layerMesh.geometry = latheFromProfile(shape.points, 40);
  };
  const api: Precipitate = {
    group,
    forming: false,
    get rate() {
      return rate;
    },
    set rate(v) {
      rate = Math.max(0, v);
    },
    get maxLayer() {
      return maxLayer;
    },
    set maxLayer(v) {
      maxLayer = Math.max(0, v);
    },
    get layer() {
      return layer;
    },
    update(dt) {
      const top = o.surface();
      if (api.forming) acc += rate * dt;
      while (acc >= 1 && count < n) {
        acc -= 1;
        const y = top - Math.random() * (top - inner[0].y) * 0.5;
        const R = radiusAt(inner, y) * 0.85 * Math.sqrt(Math.random());
        const a = Math.random() * Math.PI * 2;
        xs.set([Math.cos(a) * R, y, Math.sin(a) * R, mm(0.3 + Math.random() * 0.6)], count * 4);
        count++;
      }
      if (count >= n) acc = 0;
      const floor = inner[0].y + layer;
      for (let i = 0; i < count; i++) {
        const k = i * 4;
        xs[k + 1] -= fall * (0.6 + xs[k + 3] / mm(1)) * dt;
        if (xs[k + 1] <= floor) {
          layer = Math.min(maxLayer, layer + mm(0.012));
          xs.copyWithin(k, (count - 1) * 4, count * 4);
          count--;
          i--;
          continue;
        }
        p.set(xs[k], xs[k + 1], xs[k + 2]);
        q.setFromEuler(e.set(i, i * 1.7, 0));
        s.setScalar(xs[k + 3]);
        flakes.setMatrixAt(i, m.compose(p, q, s));
      }
      flakes.count = count;
      flakes.instanceMatrix.needsUpdate = true;
      rebuildLayer();
    },
    clear() {
      count = 0;
      layer = 0;
      acc = 0;
      rebuildLayer();
    },
  };
  rebuildLayer();
  return api;
}
