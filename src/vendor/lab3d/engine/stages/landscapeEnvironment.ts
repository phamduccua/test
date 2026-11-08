import * as THREE from 'three';

/**
 * Env map cho sân khấu cảnh quan ngoài trời: vòm trời xanh (đỉnh) → chân trời sáng → mặt đất nâu lục + một Mặt Trời buổi chiều.
 * Chỉ là env mặc định cho vật liệu chuẩn; `kit/lab3d/geo/landscape` (createLandscapeSky) bake env từ Sky.js thật và ghi đè.
 */
export function createLandscapeEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  const dome = new THREE.SphereGeometry(10, 48, 24);
  const zenith = new THREE.Color(0x3d6fb3);
  const horizon = new THREE.Color(0xc9dcef);
  const ground = new THREE.Color(0x4a4a38);
  const colors: number[] = [];
  const pos = dome.getAttribute('position');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    if (y >= 0) c.copy(horizon).lerp(zenith, Math.pow(y, 0.55));
    else c.copy(horizon).lerp(ground, THREE.MathUtils.smoothstep(-y, 0, 0.25));
    colors.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  scene.add(new THREE.Mesh(dome, domeMat));
  const sunGeo = new THREE.SphereGeometry(0.7, 16, 8);
  const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1d6).multiplyScalar(30) });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(6, 5, 5.5);
  scene.add(sun);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.04);
  pmrem.dispose();
  for (const res of [dome, domeMat, sunGeo, sunMat]) res.dispose();
  return rt.texture;
}
