import * as THREE from 'three';
import { pointerHub, type InteractCtx } from '../../interact/index';

export interface ViewAnchorOptions {
  /** Chỗ trên khung (px, gốc trên trái canvas) – null = giữ nguyên lần trước. */
  at(): { x: number; y: number } | null;
  /** Bao nhiêu px trên màn hình cho 1 đv của vật (cỡ cố định khi thu/phóng); hàm → đổi theo khung (vd. theo vòng thị trường). */
  pixels: number | (() => number);
  /** Khoảng cách tới camera = depth × khoảng cách camera ↔ tâm quay (mặc định 0,35 – nằm trước cảnh vi mô). */
  depth?: number;
  /** Xoay thêm (hệ camera) – vd. nghiêng nhẹ cho thấy khối. */
  tilt?: THREE.Euler;
}

export interface ViewAnchor {
  /** Đặt lại ngay theo camera hiện tại – gọi trong `Simulation.frame` để không trễ một khung khi xoay camera. */
  update(): void;
}

/**
 * Neo một vật 3D (gadget điều khiển: xi lanh bơm vi tiêm, núm…) vào một chỗ cố định của KHUNG NHÌN: luôn hướng theo camera, cỡ cố định
 * trên màn hình, nằm trước cảnh. Vật vẫn là vật 3D trong scene nên kéo được bằng `createPiston` / `createHandle` như vật thường.
 * Vật được gắn thẳng vào `ctx.scene` (toạ độ thế giới).
 */
export function anchorToView(ctx: InteractCtx, object: THREE.Object3D, o: ViewAnchorOptions): ViewAnchor {
  ctx.scene.add(object);
  ctx.track(() => object.removeFromParent());
  const cam = ctx.camera;
  const ndc = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const tilt = new THREE.Quaternion().setFromEuler(o.tilt ?? new THREE.Euler());
  const update = () => {
    const p = o.at();
    if (!p) return;
    const el = ctx.renderer.domElement;
    const W = Math.max(1, el.clientWidth), H = Math.max(1, el.clientHeight);
    cam.updateMatrixWorld();
    ndc.set((p.x / W) * 2 - 1, 1 - (p.y / H) * 2, 0.5).unproject(cam);
    dir.subVectors(ndc, cam.position).normalize();
    cam.getWorldDirection(fwd);
    const d = (o.depth ?? 0.35) * cam.position.distanceTo(ctx.controls.target);
    object.position.copy(cam.position).addScaledVector(dir, d / Math.max(1e-3, dir.dot(fwd)));
    object.quaternion.copy(cam.quaternion).multiply(tilt);
    // Đv thế giới / px ở khoảng cách d (khung cao H px ↔ 2·d·tan(fov/2) đv, tính cả zoom).
    const perPx = (2 * d * Math.tan((cam.fov * Math.PI) / 360)) / (H * cam.zoom);
    object.scale.setScalar((typeof o.pixels === 'function' ? o.pixels() : o.pixels) * perPx);
    object.updateMatrixWorld(true);
  };
  ctx.track(pointerHub(ctx).onFrame(update));
  update();
  return { update };
}
