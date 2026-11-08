import * as THREE from 'three';
import { radiusAt, type VesselProfile } from '../glassware/profile';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface SuspensionOptions {
  count?: number;
  color?: THREE.ColorRepresentation;
  /** Cỡ hạt (bán kính lớn nhất). */
  size?: number;
  roughness?: number;
  /** Vận tốc lắng khi không bị khuấy (đơn vị/s). */
  settleSpeed?: number;
  surface: () => number;
}

export interface Suspension {
  mesh: THREE.InstancedMesh;
  /** Mức khuấy 0 (lắng yên) … 1 (cuộn xoáy mạnh – bọt khí, khuấy). */
  stir: number;
  /** Số hạt đang hiện (≤ count) – vd. ∝ khối lượng bột. */
  visible: number;
  /** Rắc hạt từ điểm (x,z) gần mặt dung dịch (thả bột vào). */
  sprinkle(x?: number, z?: number): void;
  update(dt: number, elapsed: number): void;
  clear(): void;
}

/**
 * A-CHAT-RAN – bột rắn lơ lửng trong chất lỏng (MnO2, than, đồng vụn…): khi khuấy/sủi bọt thì cuộn theo dòng đối lưu,
 * khi yên thì lắng xuống đáy thành lớp. Hạt đục (InstancedMesh) → nhìn được qua kính.
 */
export function createSuspension(ctx: Tracker, profile: VesselProfile, o: SuspensionOptions): Suspension {
  const n = o.count ?? 300;
  const size = o.size ?? mm(0.45);
  const settle = o.settleSpeed ?? mm(6);
  const mat = ctx.track(
    new THREE.MeshStandardMaterial({ color: o.color ?? 0x1a1a1a, roughness: o.roughness ?? 1, metalness: 0 }),
  );
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat, n);
  mesh.name = 'suspension';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Toạ độ trụ: bán kính chuẩn hoá, góc, độ cao; pha riêng cho chuyển động cuộn.
  const rr = new Float32Array(n);
  const aa = new Float32Array(n);
  const yy = new Float32Array(n);
  const vy = new Float32Array(n);
  const ph = new Float32Array(n);
  const sz = new Float32Array(n);
  const floor = profile.innerBottom + mm(0.4);
  const reset = () => {
    for (let i = 0; i < n; i++) {
      rr[i] = Math.sqrt(Math.random()) * 0.92;
      aa[i] = Math.random() * Math.PI * 2;
      yy[i] = floor;
      vy[i] = 0;
      ph[i] = Math.random() * 50;
      sz[i] = size * (0.4 + 0.6 * Math.random());
    }
  };
  reset();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const api: Suspension = {
    mesh,
    stir: 0,
    visible: 0,
    sprinkle(x = 0, z = 0) {
      const top = o.surface();
      for (let i = 0; i < n; i++) {
        const R = radiusAt(profile.inner, top) || 1;
        const px = x + (Math.random() - 0.5) * mm(8);
        const pz = z + (Math.random() - 0.5) * mm(8);
        rr[i] = Math.min(0.92, Math.hypot(px, pz) / R);
        aa[i] = Math.atan2(pz, px);
        yy[i] = top - Math.random() * mm(2);
        vy[i] = -settle * (0.5 + Math.random());
      }
    },
    update(dt, elapsed) {
      const top = o.surface() - mm(0.6);
      const st = THREE.MathUtils.clamp(api.stir, 0, 1);
      const k = Math.min(n, Math.max(0, Math.round(api.visible)));
      for (let i = 0; i < k; i++) {
        // Dòng đối lưu: trồi lên ở tâm, chìm ở thành + nhiễu; lắng theo trọng lực.
        const up = (0.55 - rr[i]) * 2 * st * mm(60) + Math.sin(elapsed * 2.3 + ph[i]) * st * mm(25);
        vy[i] += ((up - settle * (0.6 + sz[i] / size)) - vy[i]) * Math.min(1, dt * 3);
        yy[i] += vy[i] * dt;
        aa[i] += dt * st * (0.8 + 0.6 * Math.sin(ph[i]));
        rr[i] = THREE.MathUtils.clamp(rr[i] + Math.sin(elapsed * 1.7 + ph[i] * 1.3) * st * dt * 0.4, 0.02, 0.92);
        if (yy[i] < floor) {
          yy[i] = floor;
          vy[i] = 0;
        }
        if (yy[i] > top) {
          yy[i] = top;
          vy[i] = -Math.abs(vy[i]) * 0.3;
        }
        const R = radiusAt(profile.inner, yy[i]) - sz[i];
        p.set(Math.cos(aa[i]) * R * rr[i], yy[i], Math.sin(aa[i]) * R * rr[i]);
        q.setFromEuler(e.set(ph[i], ph[i] * 1.7 + elapsed * st, 0));
        s.setScalar(sz[i]);
        mesh.setMatrixAt(i, m.compose(p, q, s));
      }
      mesh.count = k;
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear() {
      reset();
      mesh.count = 0;
    },
  };
  return api;
}
