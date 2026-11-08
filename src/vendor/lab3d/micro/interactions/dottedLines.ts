import * as THREE from 'three';
import type { Tracker } from '../../lab/types';

export interface DottedLinesOptions {
  /** Số đoạn tối đa. */
  max: number;
  /** Số chấm mỗi đoạn. */
  dots?: number;
  /** Bán kính chấm (đơn vị toạ độ của group). */
  radius?: number;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  /** Chừa hai đầu (tỉ lệ 0…0,5) để chấm không chui vào nguyên tử. */
  inset?: number;
}

export interface DottedLines {
  /** Thêm vào cùng hệ toạ độ với điểm truyền vào `set`. */
  mesh: THREE.InstancedMesh;
  /** Đặt đoạn thứ i từ a tới b; `size` nhân bán kính (độ mạnh). */
  set(i: number, a: THREE.Vector3, b: THREE.Vector3, size?: number): void;
  /** Ẩn các đoạn từ chỉ số `from` trở đi rồi đẩy lên GPU (gọi sau khi đặt xong mỗi frame). */
  commit(from: number): void;
  setColor(c: THREE.ColorRepresentation): void;
}

/**
 * Đường chấm "···" (liên kết hydrogen, tương tác van der Waals) giữa các phân tử: InstancedMesh hình cầu nhỏ,
 * cập nhật mỗi frame. Vật liệu không chiếu sáng → chấm luôn sáng rõ trên nền tối.
 */
export function createDottedLines(ctx: Tracker, o: DottedLinesOptions): DottedLines {
  const dots = o.dots ?? 4;
  const r = o.radius ?? 0.05;
  const inset = o.inset ?? 0.12;
  const mat = ctx.track(
    new THREE.MeshBasicMaterial({ color: o.color ?? 0xffd23f, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, depthWrite: (o.opacity ?? 1) >= 1 }),
  );
  const geo = ctx.track(new THREE.SphereGeometry(1, 10, 8));
  const mesh = new THREE.InstancedMesh(geo, mat, o.max * dots);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  const M = new THREE.Matrix4();
  const P = new THREE.Vector3();
  const Q = new THREE.Quaternion();
  const S = new THREE.Vector3();
  return {
    mesh,
    set(i, a, b, size = 1) {
      if (i >= o.max) return;
      S.setScalar(r * size);
      for (let k = 0; k < dots; k++) {
        const t = dots === 1 ? 0.5 : inset + ((1 - 2 * inset) * k) / (dots - 1);
        P.lerpVectors(a, b, t);
        mesh.setMatrixAt(i * dots + k, M.compose(P, Q, S));
      }
    },
    commit(from) {
      mesh.count = Math.min(o.max, from) * dots;
      mesh.instanceMatrix.needsUpdate = true;
    },
    setColor(c) {
      mat.color.set(c);
    },
  };
}
