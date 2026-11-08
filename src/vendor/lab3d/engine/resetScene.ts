import * as THREE from 'three';
import type { StagePreset } from './stages/types';

/** Đưa Scene về trạng thái mặc định (đối tượng con phải được dispose trước đó). */
export function resetScene(scene: THREE.Scene, envMap: THREE.Texture): THREE.Scene {
  scene.clear();
  scene.background = null;
  scene.backgroundIntensity = 1;
  scene.backgroundBlurriness = 0;
  scene.backgroundRotation.set(0, 0, 0);
  scene.environment = envMap;
  scene.environmentIntensity = 1;
  scene.environmentRotation.set(0, 0, 0);
  scene.fog = null;
  scene.overrideMaterial = null;
  scene.position.set(0, 0, 0);
  scene.rotation.set(0, 0, 0);
  scene.scale.set(1, 1, 1);
  scene.userData = {};
  return scene;
}

/** Camera dùng chung về mặc định của preset (bỏ lệch tâm chiếu, con, layer…). */
export function resetCamera(camera: THREE.PerspectiveCamera, preset: StagePreset, aspect: number): THREE.PerspectiveCamera {
  camera.clear();
  camera.fov = preset.camera.fov;
  camera.zoom = 1;
  camera.near = preset.camera.near;
  camera.far = preset.camera.far;
  camera.aspect = aspect;
  camera.up.set(0, 1, 0);
  camera.layers.set(0);
  camera.position.copy(preset.camera.position);
  camera.quaternion.identity();
  // Sim trước có thể đã lệch tâm chiếu (setViewOffset) – trả về mặc định.
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  return camera;
}

/** Trạng thái renderer sim được phép đổi → mặc định (cắt lớp, tone mapping, autoClear, pixelRatio). */
export function resetRenderer(renderer: THREE.WebGLRenderer, pixelRatio: number, exposure = 1): void {
  renderer.localClippingEnabled = false;
  renderer.clippingPlanes = [];
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.autoClear = true;
  if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio);
}
