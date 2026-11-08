import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Tracker } from '../lab/types';
import { microMaterials } from './materials';

/**
 * Gỡ và giải phóng một cây vật thể vi mô khi dựng lại giữa chừng (đổi phân tử, đổi kích thước tinh thể…):
 * dispose geometry/vật liệu riêng, xoá nhãn CSS2D, nhưng GIỮ tài nguyên dùng chung của `microMaterials(ctx)`.
 * Mặc định gỡ cả `root` khỏi cha. `keepRoot: true` = chỉ dọn và gỡ các con, giữ nhóm chứa trong cảnh để dựng lại vào đó.
 */
export function disposeMicroObject(ctx: Tracker, root: THREE.Object3D, o: { keepRoot?: boolean } = {}): void {
  const kit = microMaterials(ctx);
  const done = new Set<unknown>();
  const free = (res: { dispose(): void } | undefined) => {
    if (!res || done.has(res) || kit.isShared(res)) return;
    done.add(res);
    res.dispose();
  };
  root.traverse((o) => {
    const m = o as Partial<THREE.Mesh>;
    if (m.geometry instanceof THREE.BufferGeometry) free(m.geometry);
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mat of mats) free(mat);
    if (o instanceof THREE.InstancedMesh) o.dispose();
    if (o instanceof CSS2DObject) o.element.remove();
  });
  if (o.keepRoot) root.clear();
  else root.removeFromParent();
}
