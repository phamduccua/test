import * as THREE from 'three';

/**
 * Env map cho sân khấu địa cầu (vũ trụ – KHÔNG phải RoomEnvironment): khoảng tối gần đen, ánh xanh rất nhẹ phía trên
 * + một "Mặt Trời" sáng để vật liệu chuẩn (cột số liệu, mũi tên) có phản xạ. Bake qua PMREM (dùng chung, không dispose theo sim).
 * Nền sao/Ngân Hà thật do `kit/lab3d/geo/globe` (createStarfield) vẽ.
 */
export function createSkyEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  const dome = new THREE.SphereGeometry(10, 32, 16);
  const colors: number[] = [];
  const top = new THREE.Color(0x101c33);
  const bottom = new THREE.Color(0x010204);
  const pos = dome.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.smoothstep(pos.getY(i) / 10, -0.6, 1);
    const c = bottom.clone().lerp(top, t);
    colors.push(c.r, c.g, c.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  scene.add(new THREE.Mesh(dome, domeMat));
  const sunGeo = new THREE.SphereGeometry(0.9, 16, 8);
  const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2d8).multiplyScalar(18) });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(7, 3, 5);
  scene.add(sun);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  for (const res of [dome, domeMat, sunGeo, sunMat]) res.dispose();
  return rt.texture;
}
