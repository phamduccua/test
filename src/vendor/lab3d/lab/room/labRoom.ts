import * as THREE from 'three';
import { tileTexture } from '../materials/textures';
import type { Tracker } from '../types';

export interface LabRoomOptions {
  /** Độ cao sàn (âm, mặt bàn ở 0). */
  floorY?: number;
  /** Vị trí tường sau (z). */
  backZ?: number;
  width?: number;
  /** Nhân màu tường/sàn/chân tường (mặc định trắng = như cũ); preset ánh sáng làm tối phòng để thuỷ tinh nổi. */
  tone?: THREE.ColorRepresentation;
}

/** A-PHONG-THI-NGHIEM – vỏ phòng: sàn gạch xám, tường gạch men trắng xanh, tường bên, dải LED trần. */
export function createLabRoom(ctx: Tracker, o: LabRoomOptions = {}): THREE.Group {
  const floorY = o.floorY ?? -9;
  const backZ = o.backZ ?? -4.6;
  const W = o.width ?? 60;
  const g = new THREE.Group();
  g.name = 'lab-room';
  const floorTex = tileTexture('#7f878f', '#666e76', 4, 0.06);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(W / 12, W / 12);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, W),
    ctx.track(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, floorY, backZ + W / 2);
  floor.receiveShadow = true;
  const wallTex = tileTexture('#bfcbd6', '#a5b2bf', 6, 0.025);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(W / 9, 30 / 9);
  const wallMat = ctx.track(new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.35 }));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, 30), wallMat);
  back.position.set(0, floorY + 15, backZ);
  back.receiveShadow = true;
  const sideTex = wallTex.clone();
  sideTex.repeat.set(W / 9, 30 / 9);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(W, 30), ctx.track(new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.4, color: 0xdfe7ee })));
  side.rotation.y = Math.PI / 2;
  side.position.set(-W * 0.35, floorY + 15, backZ + W / 2);
  side.receiveShadow = true;
  // Dải chân tường
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.8, 0.1),
    ctx.track(new THREE.MeshStandardMaterial({ color: 0x5d6873, roughness: 0.6 })),
  );
  skirt.position.set(0, floorY + 0.4, backZ + 0.05);
  // Đèn LED trần (emissive)
  const ledMat = ctx.track(new THREE.MeshBasicMaterial({ color: 0xf4f8ff, toneMapped: false }));
  for (let i = -1; i <= 1; i++) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 0.5), ledMat);
    led.position.set(i * 14, floorY + 29.9, backZ + 6);
    g.add(led);
  }
  g.add(floor, back, side, skirt);
  if (o.tone !== undefined) {
    const tone = new THREE.Color(o.tone);
    for (const m of [floor, back, side, skirt]) (m.material as THREE.MeshStandardMaterial).color.multiply(tone);
  }
  return g;
}
