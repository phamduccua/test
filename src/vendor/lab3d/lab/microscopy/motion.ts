import * as THREE from 'three';

/** Di chuyển vật theo chuỗi tư thế (vị trí + góc), nội suy smoothstep; và chuỗi bước thao tác nối tiếp. */
export interface Pose {
  pos: THREE.Vector3;
  rot?: THREE.Euler;
}

export interface Mover {
  readonly busy: boolean;
  play(poses: Pose[], durs: number[], onDone?: () => void): void;
  cancel(): void;
  update(dt: number): void;
}

export function createMover(obj: THREE.Object3D): Mover {
  let legs: { from: Pose; to: Pose; d: number }[] = [];
  let t = 0;
  let done: (() => void) | undefined;
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const snap = (): Pose => ({ pos: obj.position.clone(), rot: obj.rotation.clone() });
  return {
    get busy() {
      return legs.length > 0;
    },
    play(poses, durs, onDone) {
      legs = [];
      let prev = snap();
      poses.forEach((p, i) => {
        const to = { pos: p.pos.clone(), rot: (p.rot ?? prev.rot)!.clone() };
        legs.push({ from: prev, to, d: Math.max(0.01, durs[i] ?? 1) });
        prev = to;
      });
      t = 0;
      done = onDone;
    },
    cancel() {
      legs = [];
      done = undefined;
    },
    update(dt) {
      if (!legs.length) return;
      t += dt;
      const leg = legs[0];
      const k = Math.min(1, t / leg.d);
      const s = k * k * (3 - 2 * k);
      obj.position.lerpVectors(leg.from.pos, leg.to.pos, s);
      qa.setFromEuler(leg.from.rot!);
      qb.setFromEuler(leg.to.rot!);
      obj.quaternion.slerpQuaternions(qa, qb, s);
      if (k < 1) return;
      legs.shift();
      t = 0;
      if (!legs.length) {
        const cb = done;
        done = undefined;
        cb?.();
      }
    },
  };
}

export type Step = (next: () => void) => void;

/** Chạy các bước nối tiếp (mỗi bước gọi `next` khi xong). `cancel` bỏ phần còn lại. */
export function createSequence() {
  let token = 0;
  let running = false;
  return {
    get busy() {
      return running;
    },
    run(steps: Step[], onDone?: () => void) {
      const my = ++token;
      running = true;
      const go = (i: number) => {
        if (my !== token) return;
        if (i >= steps.length) {
          running = false;
          onDone?.();
          return;
        }
        steps[i](() => go(i + 1));
      };
      go(0);
    },
    cancel() {
      token++;
      running = false;
    },
  };
}

/** Chờ `sec` giây (theo update của sim). */
export function createTimers() {
  let list: { t: number; cb: () => void }[] = [];
  return {
    after(sec: number, cb: () => void) {
      list.push({ t: sec, cb });
    },
    clear() {
      list = [];
    },
    update(dt: number) {
      const due = list.filter((x) => (x.t -= dt) <= 0);
      list = list.filter((x) => x.t > 0);
      due.forEach((x) => x.cb());
    },
  };
}
