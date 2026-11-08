import * as THREE from 'three';
import type { SimContext } from '../../sim/types';

export interface CameraTween {
  /** Bay tới nhìn `target` từ khoảng `distance`; `dir` = hướng từ target tới camera (mặc định giữ hướng hiện tại). */
  flyTo(target: THREE.Vector3, distance: number, o?: { dir?: THREE.Vector3; duration?: number }): void;
  readonly busy: boolean;
  /** Gọi mỗi frame (dùng thời gian thực để không phụ thuộc tốc độ mô phỏng nếu muốn). */
  update(dt: number): void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Di chuyển camera + OrbitControls.target mượt (cubic in-out). */
export function createCameraTween(ctx: SimContext): CameraTween {
  const { camera, controls } = ctx;
  const fromPos = new THREE.Vector3();
  const fromTarget = new THREE.Vector3();
  const toPos = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  let t = 1;
  let dur = 1;
  return {
    get busy() {
      return t < 1;
    },
    flyTo(target, distance, o = {}) {
      fromPos.copy(camera.position);
      fromTarget.copy(controls.target);
      const dir = (o.dir?.clone() ?? camera.position.clone().sub(controls.target)).normalize();
      toTarget.copy(target);
      toPos.copy(target).addScaledVector(dir, distance);
      dur = o.duration ?? 1.1;
      t = 0;
    },
    update(dt) {
      if (t >= 1) return;
      t = Math.min(1, t + dt / dur);
      const e = ease(t);
      controls.target.lerpVectors(fromTarget, toTarget, e);
      camera.position.lerpVectors(fromPos, toPos, e);
      camera.near = Math.max(0.01, camera.position.distanceTo(controls.target) / 200);
      camera.updateProjectionMatrix();
    },
  };
}
