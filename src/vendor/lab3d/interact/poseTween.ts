import * as THREE from 'three';
import { easeInOut } from './math';
import type { Pose } from './types';

export interface PoseTween {
  readonly active: boolean;
  /** Đi qua các tư thế (hệ cha của vật), mỗi chặng `durations[i]` giây (số → mọi chặng như nhau). */
  play(poses: Pose[], durations: number[] | number, onDone?: () => void): void;
  update(dt: number): void;
  /** Dừng tại chỗ (không gọi onDone). */
  cancel(): void;
}

export const toQuat = (r: THREE.Euler | THREE.Quaternion, out = new THREE.Quaternion()): THREE.Quaternion =>
  (r as THREE.Quaternion).isQuaternion ? out.copy(r as THREE.Quaternion) : out.setFromEuler(r as THREE.Euler);

/** Đặt ngay vật vào tư thế. */
export function applyPose(obj: THREE.Object3D, p: Pose): void {
  obj.position.copy(p.pos);
  toQuat(p.rot, obj.quaternion);
}

/** Tư thế hiện tại của vật (bản sao). */
export const poseOf = (obj: THREE.Object3D): Pose => ({ pos: obj.position.clone(), rot: obj.quaternion.clone() });

/** Hoạt cảnh cầm–đặt: nội suy vị trí + slerp hướng qua các tư thế (ease in-out mỗi chặng). */
export function createPoseTween(obj: THREE.Object3D): PoseTween {
  let poses: { pos: THREE.Vector3; q: THREE.Quaternion }[] = [];
  let durs: number[] = [];
  let seg = -1;
  let t = 0;
  let done: (() => void) | undefined;
  return {
    get active() {
      return seg >= 0;
    },
    play(list, durations, onDone) {
      poses = [{ pos: obj.position.clone(), q: obj.quaternion.clone() }, ...list.map((p) => ({ pos: p.pos.clone(), q: toQuat(p.rot) }))];
      durs = typeof durations === 'number' ? list.map(() => durations) : durations.slice(0, list.length);
      while (durs.length < list.length) durs.push(durs[durs.length - 1] ?? 0.6);
      seg = list.length ? 0 : -1;
      t = 0;
      done = onDone;
      if (seg < 0) onDone?.();
    },
    update(dt) {
      if (seg < 0) return;
      t += dt;
      while (t >= durs[seg]) {
        t -= durs[seg];
        seg++;
        if (seg >= durs.length) {
          const last = poses[poses.length - 1];
          obj.position.copy(last.pos);
          obj.quaternion.copy(last.q);
          seg = -1;
          const cb = done;
          done = undefined;
          cb?.();
          return;
        }
      }
      const e = easeInOut(t / Math.max(1e-6, durs[seg]));
      obj.position.lerpVectors(poses[seg].pos, poses[seg + 1].pos, e);
      obj.quaternion.slerpQuaternions(poses[seg].q, poses[seg + 1].q, e);
    },
    cancel() {
      seg = -1;
      done = undefined;
    },
  };
}
