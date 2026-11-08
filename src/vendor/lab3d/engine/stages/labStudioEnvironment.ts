import * as THREE from 'three';

/**
 * Env map "studio phòng thí nghiệm" cho thuỷ tinh: phòng tối (xám than, sàn tối hơn trần) + các softbox chữ nhật:
 * tấm lớn trên đỉnh (mặt chất lỏng/miệng ống sáng), hai dải đứng hai bên phía trước (hai vệt sáng dọc thân ống),
 * một dải ngang phía sau-trên (viền sáng mép, mặt khum) và tấm hắt trước rất mờ (giữ màu dung dịch không bị "sương").
 * Khác RoomEnvironment (sáng đều mọi hướng → kính phản chiếu trắng xoá, mất mép).
 */
export function createLabStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  const res: { dispose(): void }[] = [];
  const room = new THREE.SphereGeometry(20, 48, 24);
  const colors: number[] = [];
  const pos = room.getAttribute('position');
  const floor = new THREE.Color(0.012, 0.013, 0.015);
  const wall = new THREE.Color(0.05, 0.055, 0.062);
  const ceil = new THREE.Color(0.09, 0.095, 0.1);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 20;
    if (y < 0) c.copy(wall).lerp(floor, THREE.MathUtils.smoothstep(-y, 0, 0.5));
    else c.copy(wall).lerp(ceil, THREE.MathUtils.smoothstep(y, 0.2, 1));
    colors.push(c.r, c.g, c.b);
  }
  room.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const roomMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  scene.add(new THREE.Mesh(room, roomMat));
  res.push(room, roomMat);

  const box = (w: number, h: number, intensity: number, p: [number, number, number], tint = 0xffffff) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p);
    m.lookAt(0, 0, 0);
    scene.add(m);
    res.push(geo, mat);
  };
  box(8, 4, 2.6, [0, 11, 1]); // softbox trên đỉnh
  box(1.6, 9, 7, [-8, 2.5, 5.5], 0xf4f8ff); // dải đứng trái-trước
  box(1.6, 9, 5.5, [8, 2.5, 5.5], 0xfff8ef); // dải đứng phải-trước
  box(14, 1.4, 4, [0, 4.5, -10]); // dải ngang sau-trên (viền mép, mặt khum)
  box(3, 7, 2.2, [-9, 1.5, -6], 0xe8f0ff); // dải viền sau-trái
  box(12, 3, 0.35, [0, 1, 12]); // tấm hắt trước rất mờ

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  for (const r of res) r.dispose();
  return rt.texture;
}
