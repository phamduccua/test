import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface PourStream {
  mesh: THREE.Mesh;
  /** Dòng chảy từ `from` (mép miệng) rơi xuống `to` (mặt chất lỏng đích); flow 0…1 = độ to dòng; 0 = ẩn. */
  set(from: THREE.Vector3, to: THREE.Vector3, flow: number): void;
  setColor(c: THREE.ColorRepresentation): void;
}

export interface PourStreamOptions {
  color?: THREE.ColorRepresentation;
  radius?: number;
  /**
   * 'clear' (mặc định) = transmission như nước thật – mảnh, khó thấy trên nền sáng/đồ đục (có thể hoá đen);
   * 'visible' = nước trong nhưng hơi ngả xanh + viền sáng, thấy rõ trên mọi nền; 'opaque' = dịch đục (sữa, huyền phù) màu `color`.
   */
  look?: 'clear' | 'visible' | 'opaque';
}

function streamMaterial(o: PourStreamOptions): THREE.MeshStandardMaterial {
  if (o.look === 'opaque') return new THREE.MeshStandardMaterial({ color: o.color ?? 0xf6f1e6, roughness: 0.35, side: THREE.DoubleSide });
  if (o.look === 'visible')
    return new THREE.MeshPhysicalMaterial({
      color: o.color ?? 0xbfe3ff, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.6, depthWrite: false,
      emissive: 0x6fb6ff, emissiveIntensity: 0.12, side: THREE.DoubleSide,
    });
  return new THREE.MeshPhysicalMaterial({
    color: o.color ?? 0xf4fbff, roughness: 0.05, transmission: 1, ior: 1.33, thickness: mm(3),
    specularIntensity: 1, envMapIntensity: 1.4, side: THREE.DoubleSide,
  });
}

/** Dòng chất lỏng rót (ống cong parabol thon dần; mặc định trong suốt khúc xạ). Toạ độ theo nhóm cha của `mesh`. */
export function createPourStream(ctx: Tracker, o: PourStreamOptions = {}): PourStream {
  const mat = ctx.track(streamMaterial(o));
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.name = 'pour-stream';
  mesh.visible = false;
  mesh.renderOrder = -1;
  const R = o.radius ?? mm(1.6);
  const pts = Array.from({ length: 10 }, () => new THREE.Vector3());
  return {
    mesh,
    set(from, to, flow) {
      mesh.visible = flow > 0.01;
      if (!mesh.visible) return;
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      for (let i = 0; i < pts.length; i++) {
        const t = i / (pts.length - 1);
        // Vọt ngang nhanh lúc đầu rồi rơi thẳng (quỹ đạo ném ngang).
        const h = 1 - (1 - t) ** 3;
        pts[i].set(from.x + dx * h, from.y + (to.y - from.y) * t * t, from.z + dz * h);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 24, R * Math.sqrt(flow), 8);
      // Thon dần theo chiều rơi (dòng tăng tốc).
      const pos = geo.getAttribute('position');
      const rings = 25;
      const per = pos.count / rings;
      for (let k = 0; k < rings; k++) {
        const c = curve.getPointAt(k / (rings - 1));
        const f = 1 - 0.45 * (k / (rings - 1));
        for (let j = 0; j < per; j++) {
          const idx = k * per + j;
          pos.setXYZ(idx, c.x + (pos.getX(idx) - c.x) * f, c.y + (pos.getY(idx) - c.y) * f, c.z + (pos.getZ(idx) - c.z) * f);
        }
      }
      mesh.geometry.dispose();
      mesh.geometry = geo;
    },
    setColor(c) {
      mat.color.set(c);
    },
  };
}

export interface PourPose {
  position: THREE.Vector3;
  /** Góc nghiêng quanh trục z cục bộ (rad, dương = nghiêng sang −x). */
  tilt: number;
}

export interface PourAction {
  readonly active: boolean;
  /** 0…1 độ mở dòng hiện tại (đang rót). */
  readonly flow: number;
  /** Bắt đầu rót: tới `pose`, giữ `duration` giây, rồi về chỗ cũ; `onDone` khi đã đặt lại. */
  start(pose: PourPose, duration: number, onDone?: () => void): void;
  update(dt: number): void;
  cancel(): void;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Thao tác rót của một dụng cụ (ống đong, cốc): nhấc lên → tới trên miệng bình đích → nghiêng → rót → quay về.
 * Chỉ điều khiển transform của `object`; dòng chảy vẽ bằng createPourStream theo `flow`.
 */
export function createPourAction(object: THREE.Object3D, o: { lift?: number; move?: number; tiltTime?: number } = {}): PourAction {
  const rest = object.position.clone();
  let restRot = object.rotation.z;
  const lift = o.lift ?? 0.6;
  const tMove = o.move ?? 0.9;
  const tTilt = o.tiltTime ?? 0.5;
  let pose: PourPose | null = null;
  let hold = 0;
  let t = 0;
  let flow = 0;
  let done: (() => void) | undefined;
  const up = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  return {
    get active() {
      return pose !== null;
    },
    get flow() {
      return flow;
    },
    start(p, duration, onDone) {
      rest.copy(object.position);
      // Đọc lại góc lúc bắt đầu: rót được từ vật đang nghiêng sẵn, trả về đúng góc đó.
      restRot = object.rotation.z;
      pose = p;
      hold = duration;
      t = 0;
      done = onDone;
    },
    cancel() {
      if (!pose) return;
      object.position.copy(rest);
      object.rotation.z = restRot;
      pose = null;
      flow = 0;
    },
    update(dt) {
      if (!pose) return;
      t += dt;
      const T1 = tMove;
      const T2 = T1 + tTilt;
      const T3 = T2 + hold;
      const T4 = T3 + tTilt;
      const T5 = T4 + tMove;
      up.set(0, lift, 0);
      flow = 0;
      if (t < T1) {
        const e = smooth(t / T1);
        a.copy(rest).add(up.clone().multiplyScalar(Math.min(1, e * 2)));
        b.copy(pose.position);
        object.position.lerpVectors(a, b, e);
        object.rotation.z = restRot;
      } else if (t < T2) {
        object.position.copy(pose.position);
        object.rotation.z = restRot + pose.tilt * smooth((t - T1) / tTilt);
      } else if (t < T3) {
        object.rotation.z = restRot + pose.tilt * (1 + 0.04 * Math.sin(t * 3));
        flow = Math.min(1, (t - T2) / 0.25, (T3 - t) / 0.25);
      } else if (t < T4) {
        object.rotation.z = restRot + pose.tilt * (1 - smooth((t - T3) / tTilt));
      } else if (t < T5) {
        const e = smooth((t - T4) / tMove);
        a.copy(pose.position);
        b.copy(rest).add(up.clone().multiplyScalar(Math.min(1, (1 - e) * 2)));
        object.position.lerpVectors(a, b, e);
        object.rotation.z = restRot;
      } else {
        object.position.copy(rest);
        object.rotation.z = restRot;
        pose = null;
        done?.();
      }
    },
  };
}
