import * as THREE from 'three';
import type { Tracker } from '../types';

/** Ngẫu nhiên có hạt giống (mulberry32). */
export function seededRandom(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vật liệu tinh thể á kim ánh kim (I₂ tím đen): kim loại tối, mặt phẳng lấp lánh, ánh giao thoa tím–lam. */
export function createLusterMaterial(ctx: Tracker, color: THREE.ColorRepresentation = 0x2c2338): THREE.MeshPhysicalMaterial {
  return ctx.track(
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.85,
      roughness: 0.2,
      flatShading: true,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      iridescence: 0.75,
      iridescenceIOR: 1.8,
      iridescenceThicknessRange: [220, 520],
      envMapIntensity: 1.7,
    }),
  );
}

/** Mảnh tinh thể đa diện dẹt méo ngẫu nhiên (bán kính ~1, dày ~0,3). */
export function flakeGeometry(seed = 7): THREE.BufferGeometry {
  const rnd = seededRandom(seed);
  const g = new THREE.DodecahedronGeometry(1, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const key = (x: number, y: number, z: number) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const jit = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const k = key(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!jit.has(k)) jit.set(k, 0.75 + rnd() * 0.5);
    const s = jit.get(k) ?? 1;
    pos.setXYZ(i, pos.getX(i) * s * 1.15, pos.getY(i) * s * 0.28, pos.getZ(i) * s * 0.8);
  }
  g.computeVertexNormals();
  return g;
}

export interface CrystalFlakesOptions {
  count?: number;
  /** Bán kính vùng rải (đv cảnh) & kích thước mảnh [min, max]. */
  radius: number;
  size?: [number, number];
  /** Độ cao đống ở tâm (đv). */
  pileHeight?: number;
  color?: THREE.ColorRepresentation;
  seed?: number;
}

export interface CrystalFlakes {
  mesh: THREE.InstancedMesh;
  /** Lượng còn lại 0…1: mảnh trên cùng biến mất trước, mảnh cuối co dần. */
  setAmount(f: number): void;
}

/** A-CHAT-RAN-I2 – đống vảy tinh thể (InstancedMesh) nằm trên mặt phẳng y = 0 cục bộ. */
export function createCrystalFlakes(ctx: Tracker, o: CrystalFlakesOptions): CrystalFlakes {
  const n = o.count ?? 160;
  const [s0, s1] = o.size ?? [0.012, 0.03];
  const rnd = seededRandom(o.seed ?? 11);
  const geo = ctx.track(flakeGeometry((o.seed ?? 11) + 3));
  const mesh = new THREE.InstancedMesh(geo, createLusterMaterial(ctx, o.color), n);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const H = o.pileHeight ?? o.radius * 0.35;
  const items: { m: THREE.Matrix4; y: number; s: number }[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const r = o.radius * Math.pow(rnd(), 0.7);
    const a = rnd() * Math.PI * 2;
    const s = s0 + (s1 - s0) * rnd();
    const top = H * (1 - (r / o.radius) ** 2);
    const y = s * 0.2 + top * Math.pow(rnd(), 0.6);
    e.set((rnd() - 0.5) * 1.1, rnd() * Math.PI * 2, (rnd() - 0.5) * 1.1);
    q.setFromEuler(e);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3(s, s, s));
    items.push({ m, y, s });
  }
  items.sort((p, q2) => p.y - q2.y);
  items.forEach((it, i) => mesh.setMatrixAt(i, it.m));
  const tmp = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let last = -1;
  return {
    mesh,
    setAmount(f) {
      const x = Math.max(0, Math.min(1, f)) * n;
      const full = Math.floor(x);
      const k = full;
      if (last >= 0) mesh.setMatrixAt(last, items[last].m);
      last = -1;
      if (full < n) {
        // Mảnh dở dang co lại theo phần lẻ.
        const frac = x - full;
        items[k].m.decompose(pos, q, sc);
        sc.setScalar(items[k].s * Math.cbrt(frac));
        mesh.setMatrixAt(k, tmp.compose(pos, q, sc));
        last = k;
      }
      mesh.count = Math.min(n, full + (x > full ? 1 : 0));
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
