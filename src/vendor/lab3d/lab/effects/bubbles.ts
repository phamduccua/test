import * as THREE from 'three';
import { radiusAt, type VesselProfile } from '../glassware/profile';
import type { Tracker } from '../types';
import { mm } from '../units';
import { createBubbleState, type BubbleSource } from './bubbleModel';

export interface BubbleOptions {
  rate?: number;
  sizeMin?: number;
  sizeMax?: number;
  rise?: number;
  wobble?: number;
  maxCount?: number;
  /** Vùng sinh; mặc định: đĩa phủ đáy trong. */
  source?: Partial<BubbleSource>;
  /** Hàm trả về mực chất lỏng (vd. () => liquid.level). */
  surface: () => number;
}

export interface Bubbles {
  mesh: THREE.InstancedMesh;
  /** Số bọt/giây (0 = ngừng sinh). */
  rate: number;
  update(dt: number): void;
  clear(): void;
}

/** A-BOT-KHI – bọt khí InstancedMesh trong lòng dụng cụ (đục, ánh bạc → thấy được qua kính transmission). */
export function createBubbles(ctx: Tracker, profile: VesselProfile, o: BubbleOptions): Bubbles {
  const maxCount = o.maxCount ?? 300;
  const y0 = profile.innerBottom + mm(1);
  const cfg = {
    rate: o.rate ?? 30,
    sizeMin: o.sizeMin ?? mm(0.5),
    sizeMax: o.sizeMax ?? mm(2),
    rise: o.rise ?? 0.6,
    wobble: o.wobble ?? mm(0.8),
    maxCount,
    source: {
      x: 0,
      y: y0,
      z: 0,
      radius: radiusAt(profile.inner, y0) * 0.75,
      ...o.source,
    },
    radiusAt: (y: number) => radiusAt(profile.inner, y),
    surface: o.surface,
  };
  const state = createBubbleState(cfg);
  const mat = ctx.track(
    new THREE.MeshPhysicalMaterial({ color: 0xd6e4ee, metalness: 0.9, roughness: 0.06, envMapIntensity: 1.6 }),
  );
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), mat, maxCount);
  mesh.name = 'bubbles';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const api: Bubbles = {
    mesh,
    get rate() {
      return cfg.rate;
    },
    set rate(v: number) {
      cfg.rate = v;
    },
    update(dt) {
      state.step(dt);
      for (let i = 0; i < state.count; i++) {
        const r = state.size[i];
        const flat = r > mm(1.5) ? 0.8 : 1;
        p.set(state.x[i], state.y[i], state.z[i]);
        s.set(r, r * flat, r);
        mesh.setMatrixAt(i, m.compose(p, q, s));
      }
      mesh.count = state.count;
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear() {
      state.clear();
      mesh.count = 0;
    },
  };
  return api;
}
