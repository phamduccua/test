import * as THREE from 'three';
import { fitDistance } from '../../engine/cameraRig';
import type { SimContext } from '../../sim/types';

export interface FrameBox {
  cx: number;
  cy: number;
  cz?: number;
  w: number;
  h: number;
}

/**
 * Đặt camera để khối `box` (đv cảnh, mặt phẳng nhìn ≈ XY) vừa phần khung trống: trừ toolbar/caption/lil-gui (viewInsets)
 * và thêm `reserve` px (vd. thẻ câu hỏi dưới trái). Giữ hướng nhìn hiện tại (hoặc `dir`). Lệch dọc bằng cách dời target.
 * Ngang: nên bật `ctx.fitSafeArea()` một lần. Trả về khoảng cách camera.
 */
export function frameBox(
  ctx: SimContext,
  box: FrameBox,
  o: { reserve?: { top?: number; bottom?: number; left?: number }; dir?: THREE.Vector3; margin?: number } = {},
): number {
  const { camera, controls } = ctx;
  const ins = { ...ctx.viewInsets() };
  ins.top += o.reserve?.top ?? 0;
  ins.bottom += o.reserve?.bottom ?? 0;
  ins.left += o.reserve?.left ?? 0;
  const d = fitDistance(camera, box.w, box.h, ins, o.margin ?? 1.06);
  const pxToWorld = (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / ins.height;
  const up = ((ins.bottom - ins.top) / 2) * pxToWorld;
  const left = (ins.left / 2) * pxToWorld;
  const dir = (o.dir ?? camera.position.clone().sub(controls.target)).clone().normalize();
  const target = new THREE.Vector3(box.cx - left, box.cy - up, box.cz ?? 0);
  controls.target.copy(target);
  camera.position.copy(target).addScaledVector(dir, d);
  camera.near = Math.max(0.01, d / 200);
  camera.far = Math.max(100, d * 50);
  camera.updateProjectionMatrix();
  controls.update();
  return d;
}
