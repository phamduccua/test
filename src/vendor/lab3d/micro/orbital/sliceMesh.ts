import * as THREE from 'three';
import { sliceImage, type SliceLayer, type SlicePlane } from './slice';

export interface DensitySlice {
  mesh: THREE.Mesh;
  /** Vẽ lại ảnh (đổi orbital / màu / mặt phẳng). */
  update(layers: SliceLayer[], plane: SlicePlane): void;
  setOpacity(o: number): void;
  dispose(): void;
}

const ORIENT: Record<SlicePlane, THREE.Euler> = {
  XY: new THREE.Euler(0, 0, 0),
  XZ: new THREE.Euler(-Math.PI / 2, 0, 0),
  YZ: new THREE.Euler(0, Math.PI / 2, 0),
};

/** Mặt cắt tô màu mật độ |ψ|² (ảnh DataTexture cộng màu trên tấm phẳng qua gốc – nền tối). Người gọi gọi `dispose()`. */
export function createDensitySlice(layers: SliceLayer[], plane: SlicePlane, half: number, res = 256): DensitySlice {
  const tex = new THREE.DataTexture(new Uint8Array(res * res * 4), res, res, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  const geo = new THREE.PlaneGeometry(2 * half, 2 * half);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'density-slice';
  mesh.renderOrder = 0;
  const s: DensitySlice = {
    mesh,
    update(ls, p) {
      tex.image.data = sliceImage(ls, p, half, res);
      tex.needsUpdate = true;
      mesh.rotation.copy(ORIENT[p]);
    },
    setOpacity(o) {
      mat.opacity = o;
    },
    dispose() {
      tex.dispose();
      geo.dispose();
      mat.dispose();
      mesh.removeFromParent();
    },
  };
  s.update(layers, plane);
  return s;
}
