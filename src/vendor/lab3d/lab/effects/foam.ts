import * as THREE from 'three';
import { radiusAt, type VesselProfile } from '../glassware/profile';
import { latheFromProfile } from '../glassware/vessel';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface FoamOptions {
  /** Số bọt tối đa (InstancedMesh). */
  count?: number;
  /** Bán kính bọt lớn nhất. */
  size?: number;
  /** Màu đáy lớp bọt (sát dung dịch) và màu đỉnh. */
  bottomColor?: THREE.ColorRepresentation;
  topColor?: THREE.ColorRepresentation;
  /** Mặt dung dịch (gốc lớp bọt). */
  surface: () => number;
  seed?: number;
}

export interface Foam {
  mesh: THREE.InstancedMesh;
  /** Chiều cao lớp bọt hiện tại (đơn vị cảnh). */
  readonly height: number;
  /** Đặt chiều cao đích; bọt dâng/xẹp mượt trong update. */
  setHeight(h: number, instant?: boolean): void;
  setColors(bottom: THREE.ColorRepresentation, top: THREE.ColorRepresentation): void;
  update(dt: number, elapsed: number): void;
}

/**
 * A-BOT-KHI (foam) – lớp bọt dày dâng trên mặt dung dịch trong lòng dụng cụ (bọt O2 khi H2O2 phân huỷ, bọt xà phòng…).
 * Mỗi bọt có toạ độ chuẩn hoá (u = độ cao 0…1, góc, bán kính) → co giãn theo chiều cao lớp bọt và bám thành theo profile.
 * Bọt đục, ướt (clearcoat) → thấy được qua kính transmission.
 */
export function createFoam(ctx: Tracker, profile: VesselProfile, o: FoamOptions): Foam {
  const n = o.count ?? 700;
  const size = o.size ?? mm(2.2);
  let seed = o.seed ?? 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const u = new Float32Array(n);
  const ang = new Float32Array(n);
  const rad = new Float32Array(n);
  const sz = new Float32Array(n);
  const ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    u[i] = rnd();
    ang[i] = rnd() * Math.PI * 2;
    // Dồn về phía thành (thấy qua kính) nhưng vẫn lấp kín lòng.
    rad[i] = rnd() < 0.8 ? 0.72 + 0.26 * rnd() : Math.sqrt(rnd()) * 0.8;
    sz[i] = size * (0.35 + 0.65 * rnd() ** 1.5);
    ph[i] = rnd() * 20;
  }
  const mat = ctx.track(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.3,
    }),
  );
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), mat, n);
  mesh.name = 'foam';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Lõi bọt đục (lấp khe giữa các bọt cầu) – lathe theo lòng dụng cụ, co nhẹ vào trong.
  const coreMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 }));
  const core = new THREE.Mesh(new THREE.BufferGeometry(), coreMat);
  core.name = 'foam-core';
  core.visible = false;
  mesh.add(core);
  let coreH = -1;
  let coreBase = -1;
  const buildCore = (base: number, h: number) => {
    if (Math.abs(h - coreH) < mm(0.6) && Math.abs(base - coreBase) < mm(0.3)) return;
    coreH = h;
    coreBase = base;
    core.visible = h > mm(2);
    if (!core.visible) return;
    const pts = [];
    const N = 14;
    const top = Math.min(maxY, base + h * 0.9);
    pts.push({ r: 0, y: base });
    for (let k = 0; k <= N; k++) {
      const y = base + ((top - base) * k) / N;
      pts.push({ r: Math.max(0, radiusAt(profile.inner, y) - size * 0.9), y });
    }
    pts.push({ r: 0, y: top + size });
    core.geometry.dispose();
    core.geometry = latheFromProfile(pts, 32);
  };
  const cBottom = new THREE.Color(o.bottomColor ?? 0xe8ecef);
  const cTop = new THREE.Color(o.topColor ?? 0xffffff);
  const col = new THREE.Color();
  const paint = () => {
    coreMat.color.copy(cBottom).lerp(cTop, 0.35);
    for (let i = 0; i < n; i++) mesh.setColorAt(i, col.copy(cBottom).lerp(cTop, Math.min(1, u[i] * 1.3)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  paint();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let height = 0;
  let target = 0;
  const maxY = profile.height - mm(1);
  return {
    mesh,
    get height() {
      return height;
    },
    setHeight(h, instant = false) {
      target = Math.max(0, h);
      if (instant) height = target;
    },
    setColors(b, t) {
      cBottom.set(b);
      cTop.set(t);
      paint();
    },
    update(dt, elapsed) {
      height += (target - height) * Math.min(1, dt * (target > height ? 1.6 : 0.5));
      const base = o.surface();
      buildCore(base, height);
      if (height < mm(0.3)) {
        mesh.count = 0;
        return;
      }
      // Lớp mỏng: chỉ dùng một phần bọt (mật độ ổn định), lớp dày dùng hết.
      const k = Math.min(n, Math.ceil(n * Math.min(1, 0.12 + height / mm(40))));
      let c = 0;
      for (let i = 0; i < k; i++) {
        const y = Math.min(maxY, base + u[i] * height);
        const R = radiusAt(profile.inner, y) - sz[i] * 0.8;
        if (R <= 0) continue;
        const wob = 1 + 0.12 * Math.sin(elapsed * 3 + ph[i]);
        const r = sz[i] * wob * (u[i] > 0.92 ? 0.7 : 1);
        p.set(Math.cos(ang[i]) * R * rad[i], y, Math.sin(ang[i]) * R * rad[i]);
        s.set(r, r * 0.92, r);
        mesh.setMatrixAt(c, m.compose(p, q, s));
        if (c !== i) mesh.setColorAt(c, col.copy(cBottom).lerp(cTop, Math.min(1, u[i] * 1.3)));
        c++;
      }
      mesh.count = c;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
