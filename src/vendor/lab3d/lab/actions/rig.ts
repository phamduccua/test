import * as THREE from 'three';
import { createMover, createTimers, type Mover, type Step } from '../microscopy/motion';

/** Bộ chạy việc theo frame: `add(fn)` chạy fn(dt) mỗi frame tới khi trả về true. Việc thêm trong lúc đang chạy không bị mất. */
export function createJobs() {
  let jobs: ((dt: number) => boolean)[] = [];
  return {
    add(fn: (dt: number) => boolean) {
      jobs.push(fn);
    },
    get count() {
      return jobs.length;
    },
    clear() {
      jobs = [];
    },
    update(dt: number) {
      const cur = jobs;
      jobs = [];
      jobs = cur.filter((f) => !f(dt)).concat(jobs);
    },
  };
}

export interface RigOptions {
  /** Gốc toạ độ của các điểm (thường là lab root của bàn). */
  root: THREE.Object3D;
  caption?(text: string): void;
  fly?(target: THREE.Vector3, distance: number, dir?: THREE.Vector3): void;
}

const LEVEL = new THREE.Euler(0, 0, 0);
export const lift = (v: THREE.Vector3, dy: number) => v.clone().add(new THREE.Vector3(0, dy, 0));

/**
 * "Tay thí nghiệm" dùng chung (gộp các rig.ts của sim Sinh 10): mover theo vật, hẹn giờ, việc mỗi frame,
 * bước `wait`/`say` cho `createSequence`, mang vật giữa các cha (giá → tủ → bàn kính) giữ vị trí thế giới.
 */
export function createRig(o: RigOptions) {
  const movers = new Map<THREE.Object3D, Mover>();
  const timers = createTimers();
  const jobs = createJobs();
  const mv = (obj: THREE.Object3D) => movers.get(obj) ?? movers.set(obj, createMover(obj)).get(obj)!;
  const rootPos = (obj: THREE.Object3D) => {
    o.root.updateMatrixWorld(true);
    return o.root.worldToLocal(obj.getWorldPosition(new THREE.Vector3()));
  };
  const rig = {
    root: o.root,
    timers,
    mv,
    rootPos,
    /** Chạy fn(dt) mỗi frame tới khi trả về true. */
    during: (fn: (dt: number) => boolean) => jobs.add(fn),
    wait: (sec: number): Step => (next) => timers.after(sec, next),
    say: (text: string): Step => (next) => {
      o.caption?.(text);
      next();
    },
    fly: (target: THREE.Vector3, distance: number, dir?: THREE.Vector3) => o.fly?.(target, distance, dir),
    /** Mang `obj` qua `via` tới `to` (toạ độ root) rồi gắn vào `holder` (giữ vị trí thế giới). Mỗi chặng ≥ 0,35 s. */
    carry(obj: THREE.Object3D, via: THREE.Vector3[], to: THREE.Vector3, holder: THREE.Object3D, next: () => void, speed = 2.6, rot = LEVEL) {
      o.root.attach(obj);
      const pts = [...via, to];
      let prev = obj.position.clone();
      const durs = pts.map((p) => {
        const d = Math.max(0.35, p.distanceTo(prev) / speed);
        prev = p;
        return d;
      });
      mv(obj).play(pts.map((p) => ({ pos: p, rot })), durs, () => {
        holder.attach(obj);
        next();
      });
    },
    /** Nhấc lên, đi ngang ở độ cao ≥ `travel`, hạ xuống `to`. */
    hop(obj: THREE.Object3D, to: THREE.Vector3, holder: THREE.Object3D, next: () => void, travel = 2.2) {
      const from = rootPos(obj);
      const y = Math.max(travel, from.y + 0.6, to.y + 0.6);
      rig.carry(obj, [new THREE.Vector3(from.x, y, from.z), new THREE.Vector3(to.x, y, to.z)], to, holder, next);
    },
    cancel() {
      movers.forEach((m) => m.cancel());
      timers.clear();
      jobs.clear();
    },
    get busy() {
      for (const m of movers.values()) if (m.busy) return true;
      return jobs.count > 0;
    },
    update(dt: number) {
      movers.forEach((m) => m.update(dt));
      timers.update(dt);
      jobs.update(dt);
    },
  };
  return rig;
}

export type Rig = ReturnType<typeof createRig>;
