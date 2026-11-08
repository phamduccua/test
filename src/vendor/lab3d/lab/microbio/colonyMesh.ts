import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';
import type { Colony, ColonyKind } from './colonies';

/**
 * A-KHUAN-LAC: khuẩn lạc trên mặt thạch bằng InstancedMesh (đục – nhìn được qua nắp kính).
 * Vi khuẩn: vòm lồi trắng kem bóng ướt; nấm mốc: lõi xám lục + quầng sợi trắng xốp rộng hơn.
 * `place` nhận toạ độ đĩa (mm) → toạ độ cục bộ của `parent` (thường là `plate.toLocal`).
 */
export interface ColonyLayer {
  group: THREE.Group;
  /** Vẽ danh sách khuẩn lạc với bán kính (mm) hiện tại; r < 0,03 mm thì ẩn. */
  sync(list: Colony[], radius: (c: Colony) => number): void;
  clear(): void;
}

const KIND_COLOR: Record<ColonyKind, string> = { main: '#f4efe2', mould: '#7d8f72', yellow: '#e9c34a' };

export function createColonyLayer(
  ctx: Tracker,
  place: (u: number, v: number, out: THREE.Vector3) => THREE.Vector3,
  o: { max?: number; colors?: Partial<Record<ColonyKind, string>>; scale?: number; clip?: THREE.Plane[] } = {},
): ColonyLayer {
  const max = o.max ?? 3000;
  const unit = o.scale ?? mm(1);
  const group = new THREE.Group();
  group.name = 'colonies';
  const dome = ctx.track(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const wet = ctx.track(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.2 }));
  const fluffy = ctx.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
  // Cắt theo khung (vd. khung phóng to vi mô) – cần renderer.localClippingEnabled.
  if (o.clip) wet.clippingPlanes = fluffy.clippingPlanes = o.clip;
  const mk = (mat: THREE.Material, n: number) => {
    const m = new THREE.InstancedMesh(dome, mat, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const domes = mk(wet, max);
  const halo = mk(fluffy, Math.min(max, 200));
  const colors = { ...KIND_COLOR, ...o.colors };
  const col = new THREE.Color();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const mat = new THREE.Matrix4();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    group,
    sync(list, radius) {
      let n = 0;
      let h = 0;
      for (const c of list) {
        if (n >= max) break;
        const r = radius(c);
        if (r < 0.03) continue;
        place(c.u, c.v, p);
        const R = r * unit;
        if (c.kind === 'mould') {
          // Lõi sẫm nhô cao + quầng sợi nấm trắng xốp, phẳng, rộng gấp 1,5.
          sc.set(R, R * 0.45, R);
          domes.setMatrixAt(n, mat.compose(p, q, sc));
          domes.setColorAt(n++, col.set(colors.mould));
          if (h < halo.instanceMatrix.count) {
            sc.set(R * 1.5, R * 0.18, R * 1.5);
            halo.setMatrixAt(h, mat.compose(p, q, sc));
            halo.setColorAt(h++, col.set('#eef0ea'));
          }
          continue;
        }
        // Vòm thấp: cao ≈ 0,22 r, khuẩn lạc nhỏ thì tròn hơn.
        sc.set(R, R * (0.22 + 0.3 * Math.exp(-r / 0.2)), R);
        domes.setMatrixAt(n, mat.compose(p, q, sc));
        domes.setColorAt(n++, col.set(colors[c.kind]));
      }
      for (let i = n; i < domes.count; i++) domes.setMatrixAt(i, hide);
      domes.count = n;
      halo.count = h;
      domes.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = true;
      if (domes.instanceColor) domes.instanceColor.needsUpdate = true;
      if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
    },
    clear() {
      domes.count = halo.count = 0;
    },
  };
}
