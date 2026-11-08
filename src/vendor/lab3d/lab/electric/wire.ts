import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface WireOptions {
  color?: THREE.ColorRepresentation;
  /** Bán kính vỏ dây (đv). */
  radius?: number;
  /** Số đoạn dọc / quanh ống. */
  segments?: number;
  radial?: number;
  /** Hạt electron chạy dọc dây: số hạt, màu, bán kính. */
  flowCount?: number;
  flowColor?: THREE.ColorRepresentation;
  flowRadius?: number;
  /** Khoảng cách giữa hai hạt electron (đv); số hạt = độ dài / spacing (≤ flowCount). */
  flowSpacing?: number;
}

export interface WirePathOptions {
  /** Độ võng (tỉ lệ theo khoảng cách hai đầu). */
  sag?: number;
  /** Hướng dây rời khỏi mỗi đầu (đơn vị) và độ dài đoạn thẳng đầu dây. */
  dirA?: THREE.Vector3;
  dirB?: THREE.Vector3;
  lead?: number;
  /** Dây không xuống thấp hơn y này (mặt bàn + bán kính). */
  minY?: number;
  /** Điểm trung gian bắt buộc đi qua. */
  via?: THREE.Vector3[];
}

export interface Wire {
  mesh: THREE.Mesh;
  /** Hạt electron (InstancedMesh) – cùng hệ toạ độ với mesh. */
  flow: THREE.InstancedMesh;
  curve: THREE.CatmullRomCurve3;
  readonly length: number;
  /** Dựng lại dây theo điểm (toạ độ cha của mesh). */
  setPoints(pts: THREE.Vector3[]): void;
  /** Dựng dây mềm giữa hai đầu a → b có võng. */
  connect(a: THREE.Vector3, b: THREE.Vector3, o?: WirePathOptions): void;
  /** Tốc độ hạt electron (đv/s); dương = chạy từ đầu a về b; 0 = ẩn. */
  setFlow(speed: number): void;
  update(dt: number): void;
}

/** Các điểm điều khiển một dây mềm võng xuống giữa hai đầu. */
export function wirePath(a: THREE.Vector3, b: THREE.Vector3, o: WirePathOptions = {}): THREE.Vector3[] {
  const d = a.distanceTo(b);
  const lead = o.lead ?? Math.min(mm(25), d * 0.2);
  const pa = a.clone().addScaledVector(o.dirA ?? new THREE.Vector3(0, 1, 0), lead);
  const pb = b.clone().addScaledVector(o.dirB ?? new THREE.Vector3(0, 1, 0), lead);
  const sag = (o.sag ?? 0.18) * d;
  const minY = o.minY ?? -Infinity;
  const pts = [a.clone(), pa];
  const mids = o.via ?? [new THREE.Vector3().lerpVectors(pa, pb, 0.5)];
  if (!o.via) mids[0].y -= sag;
  for (const m of mids) pts.push(m.clone().setY(Math.max(minY, m.y)));
  pts.push(pb, b.clone());
  return pts;
}

/** Dây điện bọc nhựa theo đường cong (TubeGeometry) + hạt electron phát sáng chạy dọc dây. */
export function createWire(ctx: Tracker, o: WireOptions = {}): Wire {
  const r = o.radius ?? mm(1.6);
  const segs = o.segments ?? 96;
  const radial = o.radial ?? 8;
  const mat = ctx.track(
    new THREE.MeshPhysicalMaterial({ color: o.color ?? 0xc8242b, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  );
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.castShadow = true;
  mesh.name = 'wire';
  const n = o.flowCount ?? 40;
  const spacing = o.flowSpacing ?? r * 40;
  let active = n;
  const flowMat = ctx.track(new THREE.MeshBasicMaterial({ color: o.flowColor ?? 0x7fe4ff, toneMapped: false }));
  const flow = new THREE.InstancedMesh(ctx.track(new THREE.SphereGeometry(1, 10, 8)), flowMat, n);
  flow.frustumCulled = false;
  flow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  flow.visible = false;
  mesh.add(flow);
  const fr = o.flowRadius ?? r * 1.25;
  let curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0.01, 0)]);
  let length = 0.01;
  let speed = 0;
  let phase = 0;
  const m4 = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(fr, fr, fr);
  const zero = new THREE.Vector3(0, 0, 0);
  const placeFlow = () => {
    for (let i = 0; i < n; i++) {
      const u = (((i / active + phase) % 1) + 1) % 1;
      curve.getPointAt(u, p);
      flow.setMatrixAt(i, m4.compose(p, q, i < active ? s : zero));
    }
    flow.instanceMatrix.needsUpdate = true;
  };
  const w: Wire = {
    mesh, flow,
    get curve() {
      return curve;
    },
    get length() {
      return length;
    },
    setPoints(pts) {
      curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      length = curve.getLength();
      active = Math.max(2, Math.min(n, Math.round(length / spacing)));
      mesh.geometry.dispose();
      mesh.geometry = new THREE.TubeGeometry(curve, segs, r, radial, false);
      if (flow.visible) placeFlow();
    },
    connect(a, b, opt) {
      w.setPoints(wirePath(a, b, opt));
    },
    setFlow(v) {
      speed = v;
      flow.visible = Math.abs(v) > 1e-4;
    },
    update(dt) {
      if (!flow.visible) return;
      phase += (speed * dt) / Math.max(1e-3, length);
      placeFlow();
    },
  };
  return w;
}
