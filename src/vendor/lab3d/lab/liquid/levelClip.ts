import * as THREE from 'three';
import { radiusAt, type VesselProfile } from '../glassware/profile';
import { fromML } from '../units';
import type { Liquid } from './liquid';

const N = 64;

/** Diện tích phần đĩa bán kính R có toạ độ chiếu u ≤ s. */
const segment = (R: number, s: number) =>
  s >= R ? Math.PI * R * R : s <= -R ? 0 : R * R * (Math.PI - Math.acos(s / R)) + s * Math.sqrt(R * R - s * s);

/**
 * Mặt thoáng nằm ngang khi bình nghiêng (`createLiquid` chỉ có mặt vuông góc trục bình): khối lỏng lấp đầy lòng bình rồi bị cắt
 * bởi mặt phẳng ngang (clipping, toạ độ thế giới) ở mực giữ đúng thể tích. Mặt cắt hở nhìn qua mặt sau (DoubleSide) như mặt thoáng.
 * Cần `renderer.localClippingEnabled = true`. Dùng với createCarryPour: gọi `update(ml)` mỗi frame khi bình nghiêng, `off(ml)` khi dựng lại
 * (TN-014-01 lọ sucrose, cối, ống li tâm; TN-015-01 chai dung dịch dinh dưỡng).
 */
export function createLevelClip(liq: Liquid, profile: VesselProfile) {
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const mat = liq.mesh.material as THREE.Material;
  const y0 = profile.inner[0].y;
  const y1 = profile.height;
  const dy = (y1 - y0) / N;
  const ys = Array.from({ length: N }, (_, i) => y0 + (i + 0.5) * dy);
  const rs = ys.map((y) => radiusAt(profile.inner, y));
  const rTop = radiusAt(profile.inner, y1);
  /** Thể tích (đv cảnh³) dưới mặt ngang thế giới y = h, với hàng 2 của ma trận thế giới (b = hệ số theo y, k = độ dốc ngang, d). */
  const below = (h: number, b: number, k: number, d: number) => {
    let v = 0;
    for (let i = 0; i < N; i++) {
      const base = h - d - b * ys[i];
      v += (k < 1e-6 ? (base >= 0 ? Math.PI * rs[i] ** 2 : 0) : segment(rs[i], base / k)) * dy;
    }
    return v;
  };
  let on = false;
  return {
    get on() {
      return on;
    },
    /** Gọi mỗi frame khi bình đang nghiêng; `ml` = thể tích còn trong bình. */
    update(ml: number) {
      if (!on) {
        on = true;
        liq.setLevel(y1 - 1e-4);
        mat.clippingPlanes = [plane];
      }
      liq.mesh.updateMatrixWorld();
      const e = liq.mesh.matrixWorld.elements;
      const [a, b, c, d] = [e[1], e[5], e[9], e[13]];
      const k = Math.hypot(a, c);
      const want = fromML(ml);
      let lo = d + Math.min(b * y0, b * y1) - k * profile.maxRadius;
      // Mặt thoáng không cao hơn điểm thấp nhất của miệng (phần thừa đang chảy ra).
      let hi = d + b * y1 - k * rTop;
      if (below(hi, b, k, d) <= want) lo = hi;
      for (let i = 0; i < 28 && hi - lo > 1e-5; i++) {
        const m = (lo + hi) / 2;
        if (below(m, b, k, d) < want) lo = m;
        else hi = m;
      }
      plane.constant = lo;
      liq.mesh.visible = ml > 0.02;
    },
    /** Trả về mặt thoáng thường với thể tích `ml`. */
    off(ml: number) {
      if (!on) return;
      on = false;
      mat.clippingPlanes = null;
      liq.setVolume(ml);
    },
  };
}

export type LevelClip = ReturnType<typeof createLevelClip>;
