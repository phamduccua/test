import * as THREE from 'three';
import type { Tracker } from '../types';
import { createLusterMaterial, seededRandom } from './crystalFlakes';

export interface NeedleDepositOptions {
  /** Bán kính vùng mọc trên mặt phẳng y = 0 cục bộ (đv cảnh). */
  radius: number;
  count?: number;
  /** Chiều dài kim tối đa [min, max] & bề rộng (đv). */
  length?: [number, number];
  width?: [number, number];
  /** 1 = mọc xuống (mặt dưới đĩa), −1 = mọc lên. */
  direction?: 1 | -1;
  color?: THREE.ColorRepresentation;
  seed?: number;
}

export interface NeedleDeposit {
  mesh: THREE.InstancedMesh;
  /** Lượng ngưng kết 0…1: kim mới nảy mầm ở ngưỡng riêng rồi dài dần. */
  setGrowth(g: number): void;
}

/** Kim tinh thể lăng trụ nhọn, gốc ở y = 0, mũi ở y = −1. */
function needleGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.5, 0.12, 1, 5, 1).toNonIndexed();
  g.translate(0, -0.5, 0);
  g.computeVertexNormals();
  return g;
}

/** Tinh thể kim mọc dần (ngưng kết) trên một mặt phẳng tròn – InstancedMesh, ánh kim tím đen. */
export function createNeedleDeposit(ctx: Tracker, o: NeedleDepositOptions): NeedleDeposit {
  const n = o.count ?? 700;
  const [l0, l1] = o.length ?? [0.012, 0.05];
  const [w0, w1] = o.width ?? [0.003, 0.008];
  const dir = o.direction ?? 1;
  const rnd = seededRandom(o.seed ?? 5);
  const mesh = new THREE.InstancedMesh(ctx.track(needleGeometry()), createLusterMaterial(ctx, o.color ?? 0x30263c), n);
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  const seeds = Array.from({ length: n }, () => {
    // Mầm nhiều ở vùng giữa (lạnh nhất, hơi tới nhiều), lan dần ra mép.
    const r = o.radius * Math.sqrt(rnd()) * 0.97;
    const a = rnd() * Math.PI * 2;
    const tilt = rnd() * 0.9;
    const yaw = rnd() * Math.PI * 2;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt * Math.cos(yaw), 0, tilt * Math.sin(yaw)));
    if (dir < 0) q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
    return {
      p: new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
      q,
      len: l0 + (l1 - l0) * rnd() ** 1.6,
      w: w0 + (w1 - w0) * rnd(),
      born: Math.min(0.92, (r / o.radius) * 0.45 + rnd() * 0.5),
    };
  });
  seeds.sort((a, b) => a.born - b.born);
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  mesh.count = 0;
  return {
    mesh,
    setGrowth(g) {
      let k = 0;
      for (const sd of seeds) {
        if (sd.born >= g) break;
        const t = Math.min(1, (g - sd.born) / 0.3);
        s.set(sd.w * (0.4 + 0.6 * t), sd.len * t, sd.w * (0.4 + 0.6 * t));
        mesh.setMatrixAt(k++, m.compose(sd.p, sd.q, s));
      }
      mesh.count = k;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
