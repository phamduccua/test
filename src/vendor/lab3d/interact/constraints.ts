import * as THREE from 'three';
import { clamp, snapStep } from './math';
import type { Constraint } from './types';

const tmp = new THREE.Vector3();

/** Kẹp điểm vào hộp (bỏ qua trục có min = −∞). */
const clampBox = (p: THREE.Vector3, box?: THREE.Box3) => (box ? p.clamp(box.min, box.max) : p);

/** Kéo trên mặt phẳng (thế giới); `bounds` giới hạn; `step` làm tròn x/z theo lưới. */
export function planeConstraint(plane: THREE.Plane, o: { bounds?: THREE.Box3; step?: number } = {}): Constraint {
  return {
    project(ray, out) {
      if (!ray.intersectPlane(plane, out)) return false;
      if (o.step) out.set(snapStep(out.x, o.step), out.y, snapStep(out.z, o.step));
      clampBox(out, o.bounds);
      return true;
    },
  };
}

/** Mặt phẳng ngang y = h (h là số hoặc hàm – vd. độ cao mang dụng cụ đổi theo vùng). */
export function horizontalConstraint(h: number | (() => number), o: { bounds?: THREE.Box3; step?: number } = {}): Constraint {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const inner = planeConstraint(plane, o);
  return {
    project(ray, out) {
      plane.constant = -(typeof h === 'function' ? h() : h);
      return inner.project(ray, out);
    },
  };
}

export interface AxisConstraint extends Constraint {
  /** Tham số t ∈ [0, 1] của lần chiếu gần nhất (0 = `from`, 1 = `to`). */
  readonly t: number;
  pointAt(t: number, out?: THREE.Vector3): THREE.Vector3;
}

/** Kéo dọc đoạn thẳng from → to (thế giới): điểm trên đoạn gần tia con trỏ nhất; `steps` = số nấc (0 = liên tục). */
export function axisConstraint(from: THREE.Vector3, to: THREE.Vector3, steps = 0): AxisConstraint {
  let t = 0;
  const seg = new THREE.Vector3();
  return {
    get t() {
      return t;
    },
    pointAt: (k, out = new THREE.Vector3()) => out.lerpVectors(from, to, k),
    project(ray, out) {
      seg.subVectors(to, from);
      const len2 = seg.lengthSq() || 1;
      ray.distanceSqToSegment(from, to, undefined, tmp);
      t = clamp(tmp.sub(from).dot(seg) / len2, 0, 1);
      if (steps > 0) t = Math.round(t * steps) / steps;
      out.lerpVectors(from, to, t);
      return true;
    },
  };
}

export interface CurveConstraint extends Constraint {
  /** Tham số 0…1 theo chỉ số mẫu của lần chiếu gần nhất. */
  readonly t: number;
}

/**
 * Kéo dọc đường cong (đường đi khối khí, quỹ đạo, dòng sông…): điểm mẫu (thế giới) gần tia nhất, nội suy giữa hai mẫu.
 * `points` là hàm → đường đổi theo thời gian vẫn đúng.
 */
export function curveConstraint(points: THREE.Vector3[] | (() => THREE.Vector3[])): CurveConstraint {
  let t = 0;
  return {
    get t() {
      return t;
    },
    project(ray, out) {
      const pts = typeof points === 'function' ? points() : points;
      if (pts.length < 2) return false;
      let best = Infinity;
      let bi = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = ray.distanceSqToSegment(pts[i], pts[i + 1]);
        if (d < best) {
          best = d;
          bi = i;
        }
      }
      const a = pts[bi], b = pts[bi + 1];
      ray.distanceSqToSegment(a, b, undefined, out);
      const k = Math.sqrt(out.distanceToSquared(a) / Math.max(1e-12, a.distanceToSquared(b)));
      t = (bi + k) / (pts.length - 1);
      return true;
    },
  };
}

/**
 * Kéo trên mặt cầu (tâm/bán kính thế giới); tia trượt khỏi cầu → điểm trên vành nhìn thấy gần tia nhất.
 * `strict` → tia trượt khỏi cầu = không có điểm (thả thẻ ra ngoài địa cầu không tính).
 */
export function sphereConstraint(center: THREE.Vector3 | (() => THREE.Vector3), radius: number, o: { strict?: boolean } = {}): Constraint {
  const s = new THREE.Sphere(new THREE.Vector3(), radius);
  return {
    project(ray, out) {
      s.center.copy(typeof center === 'function' ? center() : center);
      if (ray.intersectSphere(s, out)) return true;
      if (o.strict) return false;
      ray.closestPointToPoint(s.center, tmp);
      out.copy(tmp).sub(s.center).setLength(radius).add(s.center);
      return true;
    },
  };
}

/** Kéo trên bề mặt mesh (raycast); trượt ra ngoài → `fallback` (vd. mặt phẳng ngang) nếu có. */
export function surfaceConstraint(meshes: THREE.Object3D[], fallback?: Constraint): Constraint {
  const rc = new THREE.Raycaster();
  return {
    project(ray, out) {
      rc.ray.copy(ray);
      const hit = rc.intersectObjects(meshes, true)[0];
      if (hit) return !!out.copy(hit.point);
      return fallback ? fallback.project(ray, out) : false;
    },
  };
}

/**
 * Kéo trên địa hình cho bởi hàm độ cao `heightAt(x, z)` (thế giới) – dò dọc tia rồi chia đôi; không cần mesh.
 * `bounds` (xz) giữ điểm trong vùng; `maxDist` = tầm dò.
 */
export function heightConstraint(heightAt: (x: number, z: number) => number, o: { bounds?: THREE.Box3; maxDist?: number; steps?: number } = {}): Constraint {
  const maxD = o.maxDist ?? 2000;
  const n = o.steps ?? 160;
  // Độ cao của điểm trên tia (tham số t) so với mặt đất: > 0 = còn ở trên.
  const above = (ray: THREE.Ray, t: number) => {
    ray.at(t, tmp);
    return tmp.y - heightAt(tmp.x, tmp.z);
  };
  return {
    project(ray, out) {
      let t0 = 0;
      let f0 = above(ray, 0);
      for (let i = 1; i <= n; i++) {
        const t1 = (maxD * i * i) / (n * n);
        const f1 = above(ray, t1);
        if (f0 > 0 && f1 <= 0) {
          let a = t0, b = t1;
          for (let k = 0; k < 18; k++) {
            const m = (a + b) / 2;
            if (above(ray, m) > 0) a = m;
            else b = m;
          }
          ray.at(b, out);
          if (o.bounds) {
            clampBox(out, o.bounds);
            out.y = heightAt(out.x, out.z);
          }
          return true;
        }
        t0 = t1;
        f0 = f1;
      }
      return false;
    },
  };
}

/**
 * Va chạm đơn giản theo mặt bằng: kẹp `w` vào `bounds` (xz) rồi đẩy ra khỏi các hộp cản (nới `r`, chỉ khi thấp hơn nóc hộp + r).
 * Dùng cho dụng cụ mang trên bàn (không xuyên giá, chai…).
 */
export function pushOutXZ(w: THREE.Vector3, boxes: THREE.Box3[], r = 0, bounds?: THREE.Box3): THREE.Vector3 {
  if (bounds) w.set(clamp(w.x, bounds.min.x, bounds.max.x), w.y, clamp(w.z, bounds.min.z, bounds.max.z));
  for (const b of boxes) {
    const d = [w.x - (b.min.x - r), b.max.x + r - w.x, w.z - (b.min.z - r), b.max.z + r - w.z];
    if (d.some((v) => v <= 0) || w.y > b.max.y + r) continue;
    const m = Math.min(...d);
    const i = d.indexOf(m);
    if (i === 0) w.x -= m;
    else if (i === 1) w.x += m;
    else if (i === 2) w.z -= m;
    else w.z += m;
  }
  return w;
}
