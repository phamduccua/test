import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';
import { createSurfaceBubbleState, type SurfaceBubbleConfig, type SurfaceBubbleState } from './model';

export interface SurfaceBubbles {
  mesh: THREE.InstancedMesh;
  state: SurfaceBubbleState;
  /** Số bọt mới/giây (gán được; 0 = ngừng sinh, bọt cũ vẫn nổi hết). */
  rate: number;
  /** Trả về số bọt vỡ ở mặt thoáng trong frame (vd. để phát âm thanh). */
  update(dt: number): number;
  clear(): void;
}

export type SurfaceBubbleOptions = Pick<SurfaceBubbleConfig, 'sample' | 'radiusAt' | 'surface'> &
  Partial<Omit<SurfaceBubbleConfig, 'sample' | 'radiusAt' | 'surface'>>;

/**
 * A-BOT-KHI sinh trên bề mặt vật rắn (đinh sắt trong axit, viên kẽm…): InstancedMesh đục ánh bạc (thấy được qua kính
 * transmission). Toạ độ theo hệ của cha (thường `vessel.group`); `sample` trả điểm + pháp tuyến trong hệ đó.
 */
export function createSurfaceBubbles(ctx: Tracker, o: SurfaceBubbleOptions): SurfaceBubbles {
  const cfg: SurfaceBubbleConfig = {
    rate: 30,
    sizeMin: mm(0.25),
    sizeMax: mm(1.1),
    cling: [0.25, 1.6],
    rise: 0.32,
    wobble: mm(0.5),
    linger: [0.15, 0.7],
    maxCount: 400,
    ...o,
  };
  const state = createSurfaceBubbleState(cfg);
  const mat = ctx.track(new THREE.MeshPhysicalMaterial({ color: 0xdfe9f0, metalness: 0.9, roughness: 0.05, envMapIntensity: 1.7 }));
  const geo = ctx.track(new THREE.IcosahedronGeometry(1, 2));
  const mesh = new THREE.InstancedMesh(geo, mat, cfg.maxCount);
  mesh.name = 'surface-bubbles';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    mesh,
    state,
    get rate() {
      return cfg.rate;
    },
    set rate(v: number) {
      cfg.rate = Math.max(0, v);
    },
    update(dt) {
      const pops = state.step(Math.min(dt, 0.1));
      for (let i = 0; i < state.count; i++) {
        const r = state.size[i];
        m.compose(p.set(state.x[i], state.y[i], state.z[i]), q, s.set(r, r * 0.94, r));
        mesh.setMatrixAt(i, m);
      }
      mesh.count = state.count;
      mesh.instanceMatrix.needsUpdate = true;
      return pops;
    },
    clear() {
      state.clear();
      mesh.count = 0;
    },
  };
}
