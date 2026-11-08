import * as THREE from 'three';
import type { Tracker } from '../types';

/** Vật liệu viền "vỏ lộn ngược" (inverted hull): đẩy đỉnh theo pháp tuyến, chỉ vẽ mặt sau. */
/** `width` = độ dày viền theo tỉ lệ khoảng cách tới camera (≈ 0,0022 → ~3 px với fov 38°). */
export function createOutlineMaterial(ctx: Tracker, color: THREE.ColorRepresentation = 0x38bdf8, width = 0.0022) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWidth = { value: width };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWidth;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nfloat olDist = -(modelViewMatrix * vec4(position, 1.0)).z;\ntransformed += normalize(normal) * uWidth * olDist / max(1e-4, length(mat3(modelMatrix) * normalize(normal)));\n',
      );
  };
  return ctx.track(mat);
}

/** Bật/tắt viền cho cả cây đối tượng (tạo lười các mesh viền dùng chung geometry). */
export function createOutline(root: THREE.Object3D, material: THREE.Material) {
  const shells: THREE.Mesh[] = [];
  let built = false;
  const build = () => {
    built = true;
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (o as THREE.InstancedMesh).isInstancedMesh) return;
      if (m.userData.noOutline || !m.visible) return;
      const mat = m.material as THREE.Material;
      if (mat instanceof THREE.ShaderMaterial || (mat as THREE.MeshBasicMaterial).transparent) return;
      meshes.push(m);
    });
    for (const m of meshes) {
      const shell = new THREE.Mesh(m.geometry, material);
      shell.raycast = () => {};
      shell.renderOrder = 20;
      shell.userData.outlineShell = true;
      shell.userData.sharedGeometry = true;
      m.add(shell);
      shells.push(shell);
    }
  };
  return {
    set(on: boolean) {
      if (on && !built) build();
      for (const s of shells) s.visible = on;
    },
  };
}
