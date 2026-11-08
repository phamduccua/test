import * as THREE from 'three';
import { levelForVolume, radiusAt, type VesselProfile } from '../glassware/profile';
import { latheFromProfile } from '../glassware/vessel';
import { liquidInner, liquidShape } from '../liquid/meniscus';
import type { Tracker } from '../types';
import { fromML, mm } from '../units';

export interface PrecipitateCloudOptions {
  color?: THREE.ColorRepresentation;
  /** Mực chất lỏng (cục bộ dụng cụ). */
  surface: () => number;
  maxCount?: number;
  /** Cỡ bông [min, max] (bán kính, đv cảnh). */
  size?: [number, number];
  /** Vận tốc lắng của bông lớn nhất (đv/s, đã tua nhanh) – nhỏ hơn thì lắng chậm hơn (Stokes ~ r²). */
  settle?: number;
  /** Cường độ khuếch tán ngẫu nhiên (đv/√s). */
  diffusion?: number;
  /** Thể tích lớp lắng mỗi bông đóng góp (mL). */
  depositML?: number;
  /** Bông "vón cục" (kết tủa dạng sữa đông như AgCl) thay vì vảy mịn. */
  curdy?: boolean;
}

export interface PrecipitateCloud {
  group: THREE.Group;
  /** Số bông còn lơ lửng (dùng để điều khiển độ đục chất lỏng). */
  readonly suspended: number;
  /** Bề dày lớp lắng đáy. */
  readonly layer: number;
  /** Sinh `n` bông quanh điểm (x, z) ngay dưới mặt thoáng – vệt đục loang ra rồi lắng. */
  burst(n: number, x?: number, z?: number): void;
  /** Đổi màu (mượt trong `duration` giây). */
  setColor(c: THREE.ColorRepresentation, duration?: number): void;
  update(dt: number): void;
  clear(): void;
}

const F = 7; // x, y, z, vx, vy, vz, size
const GROW = 0.9; // giây bông lớn từ 0 → đủ cỡ (vẩn đục "hiện ra")

/**
 * A-KET-TUA (dạng đám mây): kết tủa sinh tại chỗ giọt thuốc thử rơi, loang ra (khuếch tán + quán tính giọt),
 * lắng theo Stokes và tích thành lớp lắng đáy (thể tích → mực theo profile). Bông là InstancedMesh đục.
 */
export function createPrecipitateCloud(ctx: Tracker, profile: VesselProfile, o: PrecipitateCloudOptions): PrecipitateCloud {
  const group = new THREE.Group();
  group.name = 'precipitate-cloud';
  const n = o.maxCount ?? 700;
  const [s0, s1] = o.size ?? [mm(0.25), mm(0.7)];
  const settle = o.settle ?? mm(7);
  const diff = o.diffusion ?? mm(5);
  const dep = fromML(o.depositML ?? 0.0005);
  const inner = liquidInner(profile.inner, mm(0.35));
  const mat = ctx.track(new THREE.MeshStandardMaterial({ color: o.color ?? 0xf5f5f0, roughness: 0.92 }));
  const geo = ctx.track(o.curdy === false ? new THREE.IcosahedronGeometry(1, 0) : new THREE.DodecahedronGeometry(1, 0));
  const flakes = new THREE.InstancedMesh(geo, mat, n);
  flakes.count = 0;
  flakes.frustumCulled = false;
  flakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const layerMesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  layerMesh.receiveShadow = true;
  group.add(flakes, layerMesh);
  const st = new Float32Array(n * F);
  const age = new Float32Array(n);
  let count = 0;
  let deposited = 0;
  let layer = 0;
  let built = -1;
  const colFrom = new THREE.Color();
  const colTo = new THREE.Color();
  let colT = 1;
  let colDur = 1;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;

  const rebuildLayer = () => {
    const y = deposited > 0 ? levelForVolume(inner, deposited) : inner[0].y;
    layer = y - inner[0].y;
    if (Math.abs(layer - built) < mm(0.08)) return;
    built = layer;
    const shape = liquidShape(inner, y, -mm(0.5));
    layerMesh.visible = !!shape;
    if (!shape) return;
    layerMesh.geometry.dispose();
    layerMesh.geometry = latheFromProfile(shape.points, 40);
  };

  const api: PrecipitateCloud = {
    group,
    get suspended() {
      return count;
    },
    get layer() {
      return layer;
    },
    burst(k, x = 0, z = 0) {
      const top = o.surface();
      for (let j = 0; j < k && count < n; j++, count++) {
        const i = count * F;
        const a = Math.random() * Math.PI * 2;
        const r = mm(1.2) * Math.sqrt(Math.random());
        const size = s0 + (s1 - s0) * Math.random() ** 1.5;
        // Quán tính của giọt: chùm đục lao xuống rồi toả ngang.
        st.set([x + Math.cos(a) * r, top - mm(0.6 + Math.random() * 2), z + Math.sin(a) * r,
          Math.cos(a) * mm(4) * Math.random(), -mm(10 + Math.random() * 30), Math.sin(a) * mm(4) * Math.random(), size], i);
        age[count] = -Math.random() * 0.4;
      }
    },
    setColor(c, duration = 0) {
      colFrom.copy(mat.color);
      colTo.set(c);
      colDur = Math.max(1e-3, duration);
      colT = duration > 0 ? 0 : 1;
      if (duration <= 0) mat.color.copy(colTo);
    },
    update(dt) {
      if (colT < 1) {
        colT = Math.min(1, colT + dt / colDur);
        mat.color.copy(colFrom).lerp(colTo, colT);
      }
      if (!count) return;
      const top = o.surface() - mm(0.4);
      const floor = inner[0].y + layer;
      const damp = Math.min(1, dt * 2.5);
      const kick = diff * Math.sqrt(Math.max(dt, 1e-4));
      let dropped = 0;
      for (let k = 0; k < count; k++) {
        const i = k * F;
        age[k] += dt;
        const size = st[i + 6];
        const vt = -settle * (size / s1) ** 2;
        st[i + 3] += -st[i + 3] * damp;
        st[i + 4] += (vt - st[i + 4]) * damp;
        st[i + 5] += -st[i + 5] * damp;
        st[i] += st[i + 3] * dt + gauss() * kick;
        st[i + 1] += st[i + 4] * dt + gauss() * kick * 0.6;
        st[i + 2] += st[i + 5] * dt + gauss() * kick;
        if (st[i + 1] > top) st[i + 1] = top;
        const rMax = radiusAt(inner, Math.max(st[i + 1], inner[0].y)) - size;
        const rr = Math.hypot(st[i], st[i + 2]);
        if (rr > rMax) {
          const f = Math.max(0, rMax) / (rr || 1);
          st[i] *= f;
          st[i + 2] *= f;
        }
        if (st[i + 1] - size <= floor + mm(0.1) || rMax <= 0) {
          dropped++;
          st.copyWithin(i, (count - 1) * F, count * F);
          age[k] = age[count - 1];
          count--;
          k--;
          continue;
        }
        const g = Math.min(1, Math.max(0, age[k]) / GROW);
        p.set(st[i], st[i + 1], st[i + 2]);
        q.setFromEuler(e.set(k * 0.7, k * 1.3, k * 0.37));
        s.set(size * (0.8 + 0.4 * ((k * 7) % 5) / 4), size * 0.75, size).multiplyScalar(0.15 + 0.85 * g);
        flakes.setMatrixAt(k, m.compose(p, q, s));
      }
      flakes.count = count;
      flakes.instanceMatrix.needsUpdate = true;
      if (dropped) {
        deposited += dropped * dep;
        rebuildLayer();
      }
    },
    clear() {
      count = 0;
      flakes.count = 0;
      deposited = 0;
      rebuildLayer();
    },
  };
  rebuildLayer();
  return api;
}
