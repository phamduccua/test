import * as THREE from 'three';
import { createFlame, type Flame } from '../effects/flame';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

export type SplintState = 'out' | 'ember' | 'flame';

export interface Splint {
  /** Gốc ở đầu que (tàn/lửa), thân que theo +y cục bộ. */
  group: THREE.Group;
  flame: Flame;
  readonly state: SplintState;
  setState(s: SplintState): void;
  update(dt: number, elapsed: number): void;
}

/** A-QUE-DOM – que đóm gỗ: đầu cháy đen, tàn đỏ rực (emissive nhấp nháy + đèn điểm), bùng lửa khi gặp O2. */
export function createSplint(ctx: Tracker, o: { length?: number } = {}): Splint {
  const L = o.length ?? mm(160);
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'splint';
  const r = mm(2.2);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L - mm(12), 10), mats.wood());
  stick.position.y = mm(12) + (L - mm(12)) / 2;
  stick.castShadow = true;
  const charMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0x1b1612, roughness: 0.95 }));
  const charred = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, mm(12), 10), charMat);
  charred.position.y = mm(6);
  const emberMat = ctx.track(
    new THREE.MeshStandardMaterial({ color: 0x2a0d05, emissive: 0xff4a12, emissiveIntensity: 2, roughness: 0.9 }),
  );
  const ember = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 12, 8), emberMat);
  ember.scale.set(1, 0.7, 1);
  const glow = new THREE.PointLight(0xff6a2a, 0, 1.2, 2);
  glow.position.y = mm(4);
  group.add(stick, charred, ember, glow);
  const flame = createFlame(ctx, { kind: 'candle', height: mm(38), width: mm(7), light: false });
  flame.setLit(false);
  group.add(flame.group);
  let state: SplintState = 'ember';
  const q = new THREE.Quaternion();
  return {
    group,
    flame,
    get state() {
      return state;
    },
    setState(s) {
      state = s;
      flame.setLit(s === 'flame');
    },
    update(dt, elapsed) {
      const pulse = 0.75 + 0.25 * Math.sin(elapsed * 4.1) * Math.sin(elapsed * 2.3 + 1);
      const on = state === 'ember' ? pulse : state === 'flame' ? 1.3 : 0;
      emberMat.emissiveIntensity = 2.6 * on;
      glow.intensity = (state === 'flame' ? 0.9 : 0.25) * on;
      // Lửa luôn hướng lên trên dù que nghiêng.
      group.getWorldQuaternion(q).invert();
      flame.group.quaternion.copy(q);
      flame.update(dt, elapsed);
    },
  };
}
