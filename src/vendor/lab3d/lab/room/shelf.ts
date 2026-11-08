import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';

/** Kệ treo tường (tấm xám xanh tủ + nẹp mép tối + giá đỡ + dải LED dưới kệ). Gốc = giữa mặt trên kệ. */
export function createWallShelf(ctx: Tracker, width = 12, depth = 2.2): THREE.Group {
  const mats = labMaterials(ctx);
  const g = new THREE.Group();
  g.name = 'wall-shelf';
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, depth), mats.cabinet());
  board.position.y = -0.11;
  board.castShadow = board.receiveShadow = true;
  g.add(board);
  const edge = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(width + 0.01, 0.06, 0.03)), mats.trim());
  edge.position.set(0, -0.03, depth / 2);
  g.add(edge);
  for (const x of [-width * 0.4, width * 0.4]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.12), mats.steel());
    br.position.set(x, -0.55, -depth / 2 + 0.06);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, depth * 0.8), mats.steel());
    arm.position.set(x, -0.26, -depth * 0.1);
    g.add(arm);
    br.castShadow = true;
    g.add(br);
  }
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.9, 0.04, 0.12),
    ctx.track(new THREE.MeshBasicMaterial({ color: 0xeaf4ff, toneMapped: false })),
  );
  led.position.set(0, -0.24, depth * 0.35);
  g.add(led);
  return g;
}
