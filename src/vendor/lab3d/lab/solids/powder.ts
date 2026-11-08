import * as THREE from 'three';
import { latheFromProfile } from '../glassware/vessel';
import { levelForVolume, radiusAt, type VesselProfile } from '../glassware/profile';
import type { Tracker } from '../types';
import { fromML, mm } from '../units';

export interface PowderHeap {
  mesh: THREE.Mesh;
  /** Thể tích khối bột (mL, gồm cả khe hở) – khối bột lấp đáy theo lòng dụng cụ, đỉnh hơi vồng. */
  setVolume(mL: number): void;
  readonly volumeML: number;
  /** Độ cao đỉnh khối bột (toạ độ dụng cụ). */
  readonly top: number;
  setColor(c: THREE.ColorRepresentation): void;
}

/**
 * A-CHAT-RAN (lớp bột lắng đáy) – khối bột đục lấp đáy ống nghiệm/bình theo profile trong, mặt trên vồng và lởm chởm nhẹ.
 * Thể tích đổi được (bột tan dần). Thêm `mesh` vào `vessel.group`.
 */
export function createPowderHeap(ctx: Tracker, profile: VesselProfile, o: { color?: THREE.ColorRepresentation; dome?: number } = {}): PowderHeap {
  const mat = ctx.track(new THREE.MeshStandardMaterial({ color: o.color ?? 0xf4f4f0, roughness: 0.95, metalness: 0, flatShading: true }));
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.name = 'powder-heap';
  mesh.castShadow = false;
  mesh.visible = false;
  const base = profile.innerBottom;
  let vol = -1;
  let top = base;
  const build = (mL: number) => {
    vol = mL;
    mesh.visible = mL > 0.002;
    if (!mesh.visible) {
      top = base;
      return;
    }
    const h = levelForVolume(profile.inner, fromML(mL));
    const rTop = Math.max(mm(0.5), radiusAt(profile.inner, h) - mm(0.35));
    const dome = Math.min(o.dome ?? mm(2.5), (h - base) * 0.6);
    const pts: { r: number; y: number }[] = [{ r: 0, y: base + mm(0.2) }];
    const N = 8;
    for (let k = 1; k <= N; k++) {
      const y = base + ((h - base) * k) / N;
      pts.push({ r: Math.max(mm(0.3), radiusAt(profile.inner, y) - mm(0.35)), y });
    }
    for (let k = 1; k <= 5; k++) {
      const t = k / 5;
      pts.push({ r: rTop * (1 - t), y: h + dome * Math.sin((t * Math.PI) / 2) * 0.8 - dome * 0.3 });
    }
    top = h + dome * 0.5;
    mesh.geometry.dispose();
    const g = latheFromProfile(pts, 28);
    // Mặt bột lởm chởm: dịch nhẹ các đỉnh phía trên theo nhiễu.
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < h - mm(0.5)) continue;
      const x = p.getX(i);
      const z = p.getZ(i);
      p.setY(i, y + mm(0.45) * Math.sin(x * 2100 + z * 1700) * Math.cos(z * 2600 - x * 900));
    }
    g.computeVertexNormals();
    mesh.geometry = g;
  };
  return {
    mesh,
    get volumeML() {
      return Math.max(0, vol);
    },
    get top() {
      return top;
    },
    setVolume(mL) {
      if (Math.abs(mL - vol) < 0.004 && (mL > 0.002) === mesh.visible) return;
      build(mL);
    },
    setColor(c) {
      mat.color.set(c);
    },
  };
}

export interface PowderFall {
  mesh: THREE.InstancedMesh;
  /** Rắc `count` hạt trong `duration` giây từ quanh điểm `from` (toạ độ nhóm cha của mesh), rơi tới `floor()`. */
  pour(from: THREE.Vector3, count: number, duration: number, floor: number | (() => number)): void;
  readonly active: boolean;
  update(dt: number): void;
  clear(): void;
}

/** Dòng hạt bột rơi (thìa đổ bột vào ống nghiệm/cốc): hạt đục nhỏ, rơi theo trọng lực rồi biến mất ở mặt đáy/đống bột. */
export function createPowderFall(ctx: Tracker, o: { color?: THREE.ColorRepresentation; size?: number; max?: number; gravity?: number; spread?: number } = {}): PowderFall {
  const max = o.max ?? 220;
  const size = o.size ?? mm(0.55);
  const g = o.gravity ?? 6;
  const spread = o.spread ?? mm(2.5);
  const mat = ctx.track(new THREE.MeshStandardMaterial({ color: o.color ?? 0xf6f6f2, roughness: 0.9 }));
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat, max);
  mesh.name = 'powder-fall';
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const pos = new Float32Array(max * 3);
  const vy = new Float32Array(max);
  const sz = new Float32Array(max);
  const alive = new Uint8Array(max);
  const src = new THREE.Vector3();
  let toEmit = 0;
  let rate = 0;
  let acc = 0;
  let floor: () => number = () => 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const api: PowderFall = {
    mesh,
    get active() {
      return toEmit > 0 || alive.some((a) => a === 1);
    },
    pour(from, count, duration, fl) {
      src.copy(from);
      toEmit = count;
      rate = count / Math.max(0.05, duration);
      floor = typeof fl === 'number' ? () => fl : fl;
    },
    update(dt) {
      acc += rate * dt;
      while (toEmit > 0 && acc >= 1) {
        acc -= 1;
        toEmit--;
        const i = alive.indexOf(0);
        if (i < 0) break;
        alive[i] = 1;
        const r = Math.sqrt(Math.random()) * spread;
        const a = Math.random() * Math.PI * 2;
        pos.set([src.x + Math.cos(a) * r, src.y - Math.random() * mm(2), src.z + Math.sin(a) * r], i * 3);
        vy[i] = -Math.random() * 0.15;
        sz[i] = size * (0.5 + Math.random() * 0.7);
      }
      if (toEmit <= 0) acc = 0;
      const f = floor();
      let top = 0;
      for (let i = 0; i < max; i++) {
        if (!alive[i]) continue;
        vy[i] -= g * dt;
        pos[i * 3 + 1] += vy[i] * dt;
        if (pos[i * 3 + 1] < f) alive[i] = 0;
        else top = i + 1;
        v.fromArray(pos, i * 3);
        s.setScalar(alive[i] ? sz[i] : 0);
        mesh.setMatrixAt(i, m.compose(v, q, s));
      }
      mesh.count = top;
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear() {
      alive.fill(0);
      toEmit = 0;
      mesh.count = 0;
    },
  };
  return api;
}
