import * as THREE from 'three';
import { pushOutXZ } from './constraints';
import { createDraggable } from './drag';
import type { DropZone } from './dropZones';
import type { Grabbable, GrabOptions, GrabState } from './grabTypes';
import { dampFactor } from './math';
import { pointerHub } from './pointer';
import { createPoseTween, poseOf, toQuat } from './poseTween';
import type { InteractCtx, Pose } from './types';
import { labText } from '../text';

export type { Grabbable, GrabOptions, GrabState } from './grabTypes';

const num = (v: number | (() => number) | undefined) => (typeof v === 'function' ? v() : v);

/**
 * Cầm – nhấc – di chuyển – đặt dụng cụ: nhấn giữ trên vật → nhấc lên, xoay về tư thế cầm, đi theo con trỏ trên mặt phẳng đứng
 * hướng về camera (cỡ vật không đổi khi kéo lên/xuống; quán tính nhẹ). Vật trong ống/giá được rút theo trục vùng trước khi đi ngang.
 * Thả trên vùng hợp lệ → hạ theo `snap`; vùng sai → toast + về chỗ cũ; ngoài vùng → đặt xuống bàn hoặc về chỗ nghỉ.
 */
export function createGrabbable(ctx: InteractCtx, o: GrabOptions): Grabbable {
  const hub = pointerHub(ctx);
  const obj = o.object;
  const tween = createPoseTween(obj);
  let home: Pose = o.home ?? poseOf(obj);
  let state: GrabState = 'rest';
  let zone: string | null = null;
  let minY = 0;
  let exit: { x: number; z: number; y: number; y0: number } | null = null;
  const lift = o.lift ?? 0.3;
  const want = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
  const probeW = new THREE.Vector3();
  const pq = new THREE.Quaternion();
  const toLocal = (w: THREE.Vector3) => (obj.parent ? obj.parent.worldToLocal(w.clone()) : w.clone());
  const toWorld = (l: THREE.Vector3) => (obj.parent ? obj.parent.localToWorld(l.clone()) : l.clone());
  const worldY = () => obj.getWorldPosition(probeW).y;
  const probeOffset = () => (o.probe ?? new THREE.Vector3()).clone().applyQuaternion(want.q).applyQuaternion(obj.parent?.getWorldQuaternion(pq) ?? pq.identity());
  // Điểm dò theo tư thế ĐÍCH (không theo vật đang trượt trễ) – vùng sáng/thả khớp chỗ con trỏ.
  const probe = () => toWorld(want.pos).add(probeOffset());
  const lifted = (p: Pose, y: number): Pose => ({ pos: toLocal(toWorld(p.pos).setY(y)), rot: o.heldRot ?? p.rot });
  const travel = (a: number, b: number) => o.travelY ?? Math.max(a, b) + lift;
  const settle = (z: DropZone | null, path: Pose[], onDone?: (ok: boolean) => void) => {
    state = 'moving';
    tween.play(path, 0.55, () => {
      state = 'rest';
      zone = z?.id ?? null;
      o.onPlace?.(z);
      onDone?.(!!z);
    });
  };
  const snapPath = (z: DropZone, y: number): Pose[] | null => {
    const s = z.snap?.(o.item);
    if (!s) return null;
    const list = Array.isArray(s) ? s : [s];
    return [lifted(list[0], Math.max(y, toWorld(list[0].pos).y)), ...list];
  };

  createDraggable(ctx, {
    object: obj,
    handle: o.handle,
    priority: o.priority,
    layer: o.layer,
    hint: o.hint ?? labText('t_64d53f6a90d9'),
    enabled: () => state !== 'moving' && (o.enabled?.() ?? true),
    blocked: o.blocked,
    // Mặt phẳng đứng qua điểm bắt, vuông góc hướng nhìn (cỡ vật không đổi khi kéo lên/xuống); con trỏ xuống thấp hơn `minY`
    // thì trượt trên mặt ngang y = minY (kéo về phía người xem). Nhìn từ trên xuống → chỉ mặt ngang.
    constraint: (grab) => {
      const n = ctx.camera.getWorldDirection(new THREE.Vector3()).setY(0);
      const wall = new THREE.Plane().setFromNormalAndCoplanarPoint(n.lengthSq() < 0.04 ? n.set(0, 1, 0) : n.normalize(), grab);
      const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      return {
        project(ray, out) {
          const hit = ray.intersectPlane(wall, out);
          if (hit && out.y >= minY) return true;
          floor.constant = -minY;
          return !!ray.intersectPlane(floor, out);
        },
      };
    },
    keepOffset: false,
    filter: (w) => {
      w.y = Math.max(w.y, minY);
      if (exit) {
        // Đang trong ống/giá: kéo hướng nào cũng rút vật lên theo trục (kéo ngang xa hơn = rút cao hơn) tới khi ra khỏi miệng.
        const y = Math.max(w.y, exit.y0 + 1.5 * Math.hypot(w.x - exit.x, w.z - exit.z));
        if (y < exit.y) w.set(exit.x, y, exit.z);
        else exit = null;
      }
      pushOutXZ(w, o.colliders ?? [], o.radius ?? 0, o.bounds);
      w.sub(probeOffset()); // con trỏ dẫn điểm dò, không phải gốc vật
    },
    apply: (w) => want.pos.copy(toLocal(w)),
    onStart() {
      const v = o.onPick?.();
      if (v === false || typeof v === 'string') return v; // chuỗi / 'block' = giữ phiên (camera không xoay) + toast lí do
      tween.cancel();
      toQuat(o.heldRot ?? obj.quaternion, want.q);
      want.pos.copy(obj.position);
      const from = zone ? o.zones?.get(zone) : undefined;
      const ey = num(from?.exitY);
      const c = from && o.zones ? o.zones.center(from) : null;
      minY = worldY() + lift;
      exit = c && ey !== undefined ? { x: c.x, z: c.z, y: ey, y0: minY } : null;
      state = 'held';
      zone = null;
      o.zones?.begin(o.item);
    },
    onMove() {
      const z = o.zones?.over(o.item, probe()) ?? null;
      o.onMove?.(probe(), z);
    },
    onEnd(_w, _p, cancelled) {
      const res = !cancelled && o.zones ? o.zones.end(o.item, probe()) : (o.zones?.cancel(), { zone: null, ok: false });
      const y = worldY();
      if (res.ok && res.zone) return settle(res.zone, snapPath(res.zone, y) ?? [poseOf(obj)]);
      if (!res.zone && o.placeOnFloor) settle(null, [{ pos: obj.position.clone().setY(home.pos.y), rot: home.rot }]);
      else settle(null, [lifted(home, travel(y, toWorld(home.pos).y)), home]);
    },
  });
  ctx.track(hub.busy(() => state === 'moving'));
  // Đi theo con trỏ mượt (nhấc lên + xoay về tư thế cầm) – thời gian thực; vùng sáng cập nhật mỗi frame.
  ctx.track(
    hub.onFrame((dt) => {
      if (state !== 'held') return tween.update(dt);
      o.zones?.over(o.item, probe());
      obj.position.lerp(want.pos, dampFactor(16, dt));
      obj.quaternion.slerp(want.q, dampFactor(10, dt));
    }),
  );

  return {
    get state() {
      return state;
    },
    get zone() {
      return zone;
    },
    carryTo(id, onDone) {
      const z = o.zones?.get(id);
      if (!z || state === 'held') return;
      const first = z.snap?.(o.item);
      const fy = first ? toWorld((Array.isArray(first) ? first[0] : first).pos).y : worldY();
      const y = travel(worldY(), Math.max(fy, num(o.zones?.get(zone ?? '')?.exitY) ?? -Infinity));
      const path = snapPath(z, y) ?? [];
      o.zones?.begin(o.item);
      state = 'moving';
      tween.play([lifted(poseOf(obj), y), ...path], [0.5, 0.9, ...path.slice(1).map(() => 0.6)], () => {
        const res = o.zones!.dropInto(o.item, id);
        if (!res.ok) return settle(null, [lifted(home, y), home], () => onDone?.(false));
        state = 'rest';
        zone = id;
        o.onPlace?.(z);
        onDone?.(true);
      });
    },
    returnHome(onDone, pose) {
      const to = pose ?? home;
      const y = travel(worldY(), toWorld(to.pos).y);
      settle(null, [lifted(poseOf(obj), y), lifted(to, y), to], onDone && (() => onDone()));
    },
    setHome(p) {
      home = { pos: p.pos.clone(), rot: p.rot.clone() };
    },
    reset(p, z = null) {
      tween.cancel();
      const to = p ?? home;
      obj.position.copy(to.pos);
      toQuat(to.rot, obj.quaternion);
      state = 'rest';
      zone = z;
    },
  };
}
