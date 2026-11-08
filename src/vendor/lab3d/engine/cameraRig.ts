import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const DEFAULT_CAMERA_POS = new THREE.Vector3(4, 3, 6);
export const DEFAULT_TARGET = new THREE.Vector3(0, 0.8, 0);

/** Đưa camera về nhìn `target` từ khoảng cách `distance`, giữ hướng nhìn hiện tại. */
export function frameTo(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  target: THREE.Vector3,
  distance: number,
): void {
  const dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() < 1e-8) dir.copy(DEFAULT_CAMERA_POS).sub(DEFAULT_TARGET);
  dir.normalize().multiplyScalar(distance);
  controls.target.copy(target);
  camera.position.copy(target).add(dir);
  camera.near = Math.max(0.01, distance / 200);
  camera.far = Math.max(100, distance * 50);
  camera.updateProjectionMatrix();
  controls.update();
}

/** Vùng bị che (px) + kích thước khung – xem `ViewInsets` trong src/sim/types.ts. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Lệch tâm chiếu để tâm cảnh nằm giữa phần khung không bị che (mặc định chỉ theo chiều ngang).
 * Không đổi aspect/fov; `camera.clearViewOffset()` để bỏ. Trả về độ lệch (px) đã áp.
 */
export function applySafeViewOffset(
  camera: THREE.PerspectiveCamera,
  insets: Insets,
  o: { horizontal?: boolean; vertical?: boolean } = {},
): { x: number; y: number } {
  const { width: w, height: h } = insets;
  const x = o.horizontal === false ? 0 : Math.round((insets.right - insets.left) / 2);
  const y = o.vertical ? Math.round((insets.bottom - insets.top) / 2) : 0;
  if (!x && !y) camera.clearViewOffset();
  else camera.setViewOffset(w, h, x, y, w, h);
  return { x, y };
}

/** Khoảng cách cần lùi để một khối rộng `w` × cao `h` (đv) vừa phần khung trống theo `insets`. */
export function fitDistance(camera: THREE.PerspectiveCamera, w: number, h: number, insets?: Insets, margin = 1.08): number {
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fx = insets ? Math.max(0.2, 1 - (insets.left + insets.right) / insets.width) : 1;
  const fy = insets ? Math.max(0.2, 1 - (insets.top + insets.bottom) / insets.height) : 1;
  return Math.max(h / (2 * t * fy), w / (2 * t * camera.aspect * fx)) * margin;
}
