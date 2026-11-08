import * as THREE from 'three';
import type { Tracker } from '../types';
import { floorBelow } from '../geometry/clearancePairs';
import type { DripAction, DripActionOptions, DripTask } from './dripTypes';

export type { DripTask, DripActionOptions, DripAction } from './dripTypes';

interface Key {
  p: THREE.Vector3;
  d: number;
  squeeze?: number;
  drip?: boolean;
  rest?: boolean;
}

const G = 9.8 * 10 * 0.35; // dm/s² (giảm nhẹ để mắt kịp theo dõi)

/**
 * Hoạt cảnh ống hút nhỏ giọt CHUẨN của kit: (bay tới lọ nguồn, nhúng + bóp để hút,) bay tới dụng cụ nhận,
 * nhả từng giọt rơi có gia tốc tới mặt thoáng (onDrop kèm điểm chạm), rồi về chỗ nghỉ (bỏ qua nếu còn lượt trong hàng đợi).
 * `createDropperAction` (dropperAction.ts) là lớp tương thích bọc hàm này.
 */
export function createDripAction(ctx: Tracker, o: DripActionOptions): DripAction {
  const lift = o.lift ?? 0.9;
  const R = o.dropRadius ?? 0.022;
  const g = o.gravity ?? G;
  const geo = ctx.track(new THREE.SphereGeometry(R, 14, 10));
  const mat = ctx.track(new THREE.MeshPhysicalMaterial({ color: o.dropColor ?? 0xdfefff, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.4 }));
  const pool: { m: THREE.Mesh; v: number; live: boolean; surf: () => number; done?: (hit: THREE.Vector3) => void }[] = [];
  const hanging = new THREE.Mesh(geo, mat);
  hanging.visible = false;
  const bulbBase = o.bulb?.scale.clone() ?? new THREE.Vector3(1, 1, 1);
  const queue: DripTask[] = [];
  let task: DripTask | null = null;
  let keys: Key[] = [];
  let ki = 0;
  let kt = 0;
  let start = o.rest.clone();
  let dropped = 0;
  let dripClock = 0;
  let arrived = false;
  o.tool.position.copy(o.rest);
  o.parent.add(o.tool);
  o.parent.add(hanging);
  ctx.track(() => o.parent.remove(hanging));

  const plan = (t: DripTask): Key[] => {
    const cur = o.tool.position.clone();
    const top = Math.max(cur.y, t.from?.y ?? -Infinity, t.to.y, o.travelY ?? -Infinity) + lift;
    const dip = t.dip ?? 0.5;
    const up = (v: THREE.Vector3) => new THREE.Vector3(v.x, top, v.z);
    const ks: Key[] = [{ p: up(cur), d: Math.abs(top - cur.y) > 0.05 ? 0.45 : 0.01 }];
    if (t.from) {
      // Nhúng sâu `dip` nhưng đầu nhọn không xuống quá đáy trong lọ nguồn (+3 mm) – proxy va chạm của vật chứa.
      let root: THREE.Object3D = o.parent;
      while (root.parent) root = root.parent;
      const w = o.parent.localToWorld(t.from.clone());
      const floor = floorBelow(root, w, 0.03, o.tool);
      const low = new THREE.Vector3(t.from.x, t.from.y - dip, t.from.z);
      if (floor !== null) low.y = Math.max(low.y, o.parent.worldToLocal(w.setY(floor)).y);
      ks.push({ p: up(t.from), d: 0.7 }, { p: low, d: 0.5, squeeze: 1 }, { p: low.clone(), d: 0.35, squeeze: 0 }, { p: up(t.from), d: 0.5 });
    }
    ks.push(
      { p: up(t.to), d: 0.75 },
      { p: t.to.clone(), d: 0.45 },
      { p: t.to.clone(), d: 0.01, drip: true },
      { p: up(t.to), d: 0.5 },
      { p: up(o.rest), d: 0.7, rest: true },
      { p: o.rest.clone(), d: 0.45, rest: true },
    );
    if (o.pace && o.pace !== 1) for (const k of ks) if (!k.drip) k.d = Math.max(0.01, k.d * o.pace);
    if (o.speed) {
      let prev = cur;
      for (const k of ks) {
        if (!k.drip && k.squeeze === undefined) k.d = Math.max(0.01, prev.distanceTo(k.p) / o.speed);
        prev = k.p;
      }
    }
    return ks;
  };
  const begin = () => {
    task = queue.shift() ?? null;
    if (!task) return;
    if (task.color !== undefined) mat.color.set(task.color);
    keys = plan(task);
    ki = 0;
    kt = 0;
    start = o.tool.position.clone();
    dropped = 0;
    dripClock = 0;
    arrived = false;
  };
  const surfFn = (t: DripTask) => (typeof t.surfaceY === 'function' ? t.surfaceY : () => t.surfaceY as number);
  const spawn = (t: DripTask, i: number) => {
    let d = pool.find((x) => !x.live);
    if (!d) {
      d = { m: new THREE.Mesh(geo, mat), v: 0, live: false, surf: surfFn(t) };
      d.m.castShadow = true;
      pool.push(d);
    }
    d.live = true;
    d.v = 0;
    d.surf = surfFn(t);
    d.done = (hit) => t.onDrop?.(i, hit);
    d.m.position.copy(o.tool.position);
    d.m.scale.set(1, 1.15, 1);
    d.m.visible = true;
    o.parent.add(d.m);
  };
  const squeezeBulb = (s: number) => o.bulb?.scale.set(bulbBase.x * (1 + 0.12 * s), bulbBase.y * (1 - 0.22 * s), bulbBase.z * (1 + 0.12 * s));

  return {
    get busy() {
      return !!task || queue.length > 0 || pool.some((d) => d.live);
    },
    run(t) {
      queue.push(t);
      if (!task) begin();
    },
    cancel() {
      queue.length = 0;
      task = null;
      o.tool.position.copy(o.rest);
      squeezeBulb(0);
      hanging.visible = false;
      for (const d of pool) {
        d.live = false;
        d.m.visible = false;
      }
    },
    update(dt) {
      for (const d of pool) {
        if (!d.live) continue;
        d.v += g * dt;
        d.m.position.y -= d.v * dt;
        const s = d.surf();
        if (d.m.position.y <= s) {
          d.live = false;
          d.m.visible = false;
          d.done?.(new THREE.Vector3(d.m.position.x, s, d.m.position.z));
        }
      }
      if (!task) return;
      const k = keys[ki];
      if (k.rest && queue.length) ki = keys.length;
      if (ki < keys.length) {
        if (k.drip) {
          if (!arrived) {
            arrived = true;
            task.onArrive?.();
          }
          const n = task.drops;
          const iv = task.interval ?? 0.35;
          dripClock -= dt;
          if (dropped < n && dripClock <= 0) {
            spawn(task, dropped++);
            dripClock = iv;
          }
          hanging.visible = !!o.hang && dropped < n;
          if (hanging.visible) {
            hanging.scale.setScalar(0.3 + 0.7 * Math.min(1, 1 - dripClock / iv));
            hanging.position.copy(o.tool.position);
          }
          squeezeBulb(Math.min(1, 0.3 + (0.7 * dropped) / Math.max(1, n)));
          if (dropped < n || dripClock > 0) return;
        }
        kt = Math.min(1, kt + dt / k.d);
        const e = kt * kt * (3 - 2 * kt);
        o.tool.position.lerpVectors(start, k.p, e);
        if (k.squeeze !== undefined) squeezeBulb(k.squeeze ? e : 1 - e);
        if (kt < 1) return;
        start = k.p.clone();
        kt = 0;
        ki++;
      }
      if (ki >= keys.length) {
        squeezeBulb(0);
        const t = task;
        task = null;
        // Lấy việc kế tiếp TRƯỚC khi báo xong: onDone gọi run() ngay (xâu chuỗi) thì việc mới vào hàng đợi, không bị xoá.
        begin();
        t.onDone?.();
      }
    },
  };
}
