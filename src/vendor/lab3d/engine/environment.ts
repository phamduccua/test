import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Bake RoomEnvironment through PMREM into an env map (shared by all sims – never dispose per sim). */
export function createRoomEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const rt = pmrem.fromScene(room, 0.04);
  room.dispose();
  pmrem.dispose();
  return rt.texture;
}
