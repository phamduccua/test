import * as THREE from 'three';
import { createDraggable, createPoseTween, pointerHub, toQuat, type InteractCtx, type Pose, type PointerTarget } from '../../interact/index';
import type { Mortar } from './mortar';
import { labText } from '../../text';

export interface PestleGestureOptions {
  mortar: Mortar;
  /** Cha của chày (thường mặt bàn) – chày KHÔNG là con của cối để cối mang đi được. */
  root: THREE.Object3D;
  /** Kéo giã lên cao bao nhiêu thì tính một nhát khi dập xuống (đv, mặc định 0,3). */
  stroke?: number;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, nhấn chỉ báo lí do, camera không xoay); null = không. */
  blocked?(): string | null | undefined;
  priority?: number;
  /** Mỗi nhát giã chạm đáy cối (tay hoặc demo); `n` = tổng số nhát. */
  onStrike(n: number): void;
}

export interface PestleGesture {
  readonly strikes: number;
  readonly busy: boolean;
  /** Đang được kéo bằng tay. */
  readonly dragging: boolean;
  /** Demo / phím tắt: một nhát giã (nhấc lên – dập xuống) qua cùng `onStrike`. */
  strike(onDone?: () => void): void;
  /** Đặt chày về tư thế nghỉ (`pose` mới nếu có, vd. nằm trên bàn sau khi giã xong). */
  rest(pose?: Pose, animate?: boolean): void;
  /** Đổi tư thế nghỉ dùng khi nhả chày / sau nhát demo, KHÔNG di chuyển chày ngay (không có `pose` = tựa vào thành cối). */
  setRest(pose?: Pose): void;
  reset(): void;
}

/**
 * KÉO CHÀY GIÃ trong cối (createMortar): nhấn chày, kéo lên – dập xuống đáy cối = một nhát (đầu chày bị kẹp trong lòng cối,
 * thân hơi ngả theo hướng kéo). Bấm vào chày = một nhát (cho chạm/khó kéo). Nhả → chày tựa lại vào thành cối.
 */
export function createPestleGesture(ctx: InteractCtx, o: PestleGestureOptions): PestleGesture {
  const hub = pointerHub(ctx);
  const m = o.mortar;
  const p = m.pestle;
  o.root.add(p);
  const tween = createPoseTween(p);
  const stroke = o.stroke ?? 0.3;
  const center = () => o.root.worldToLocal(m.group.localToWorld(new THREE.Vector3(0, m.surfaceY(0), 0)));
  const rimR = m.profile.inner[m.profile.inner.length - 1].r;
  const lean = (dx: number, dz: number, out = new THREE.Quaternion()) =>
    out.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx * 1.6 + 0.12, 1, dz * 1.6).normalize());
  const leanPose = (): Pose => {
    const c = center().add(new THREE.Vector3(-rimR * 0.25, 0.02, 0));
    return { pos: c, rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.42)) };
  };
  let restPose: Pose | null = null;
  let strikes = 0;
  let armed = false;
  let busy = false;
  const hit = () => {
    strikes++;
    o.onStrike(strikes);
  };
  const clampTip = (w: THREE.Vector3) => {
    const c = o.root.localToWorld(center());
    const h = Math.max(0, w.y - c.y);
    const rMax = Math.min(rimR * 0.55, rimR * 0.2 + h * 0.4);
    const dx = w.x - c.x;
    const dz = w.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d > rMax) w.set(c.x + (dx / d) * rMax, w.y, c.z + (dz / d) * rMax);
    w.y = THREE.MathUtils.clamp(w.y, c.y, c.y + stroke + 0.6);
    return { h, dx: w.x - c.x, dz: w.z - c.z };
  };
  const setTip = (w: THREE.Vector3) => {
    const { dx, dz } = clampTip(w);
    p.position.copy(o.root.worldToLocal(w.clone()));
    lean(dx, dz, p.quaternion);
  };
  const drag = createDraggable(ctx, {
    object: p,
    priority: o.priority ?? 2,
    hint: o.hint ?? labText('t_2583cc3791dc'),
    enabled: () => !busy && (o.enabled?.() ?? true),
    blocked: o.blocked,
    constraint: (grab) => {
      const n = ctx.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, grab);
      return { project: (ray, out) => !!ray.intersectPlane(plane, out) };
    },
    filter: (w) => void clampTip(w),
    apply: setTip,
    onStart: () => {
      tween.cancel();
      armed = false;
    },
    onMove(w) {
      const c = o.root.localToWorld(center());
      const h = w.y - c.y;
      if (h > stroke) armed = true;
      else if (armed && h < 0.04) {
        armed = false;
        hit();
      }
    },
    onEnd: () => tween.play([restPose ?? leanPose()], 0.35),
    onTap: () => api.strike(),
  });
  ctx.track(hub.onFrame((dt) => tween.update(dt)));
  const up = (): Pose => ({ pos: center().add(new THREE.Vector3(0, stroke + 0.15, 0)), rot: lean(0, 0) });
  const down = (): Pose => ({ pos: center(), rot: lean(0, 0) });
  const api: PestleGesture = {
    get strikes() {
      return strikes;
    },
    get busy() {
      return busy;
    },
    get dragging() {
      return drag.dragging;
    },
    strike(onDone) {
      if (busy) return;
      busy = true;
      tween.play([up(), down()], [0.28, 0.14], () => {
        hit();
        tween.play([restPose ?? leanPose()], 0.25, () => {
          busy = false;
          onDone?.();
        });
      });
    },
    rest(pose, animate = true) {
      restPose = pose ?? null;
      const to = restPose ?? leanPose();
      if (animate) tween.play([{ pos: to.pos.clone().setY(to.pos.y + 0.8), rot: to.rot }, to], [0.45, 0.4]);
      else {
        tween.cancel();
        p.position.copy(to.pos);
        toQuat(to.rot, p.quaternion);
      }
    },
    setRest(pose) {
      restPose = pose ?? null;
    },
    reset() {
      strikes = 0;
      armed = false;
      busy = false;
      api.rest(undefined, false);
    },
  };
  api.reset();
  return api;
}
