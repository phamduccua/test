import * as THREE from 'three';
import { createHoverFx, type HoverFxOptions } from './hover';
import { dampFactor } from './math';
import { pointerHub } from './pointer';
import { planeConstraint } from './constraints';
import type { Constraint, HoverState, InteractCtx, PointerInfo, PointerTarget, StartVerdict } from './types';

export interface DraggableOptions {
  /** Vật được di chuyển (position theo hệ cha). */
  object: THREE.Object3D;
  /** Vật để bắt (mặc định `object`) – vd. `addPickProxy` cho vật nhỏ. */
  handle?: THREE.Object3D;
  /** Tia → điểm thế giới; hàm → dựng lúc nhấn từ điểm bắt (vd. `facingPlane(camera)`). */
  constraint: Constraint | ((grab: THREE.Vector3) => Constraint);
  /** Giữ khoảng lệch giữa điểm bắt và gốc vật (mặc định true; bề mặt/địa hình nên false). */
  keepOffset?: boolean;
  /** Quán tính nhẹ: vật đuổi theo con trỏ với hằng số λ (1/s, 0 = tức thì). Chạy theo thời gian thực. */
  smoothing?: number;
  priority?: number;
  layer?: string;
  /** Khung phụ (`hub.addFrame`) – vật nằm trong ô lồng có camera riêng. */
  frame?: string;
  /** Đang tắt vẫn che tia (vật cha nhận tương tác không nhận hộ) – PointerTarget.opaque. */
  opaque?: boolean;
  cursor?: string;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, nhấn chỉ báo lí do, camera không xoay); null = không. */
  blocked?(): string | null | undefined;
  /** Phản hồi rê chuột (mặc định viền sáng); false = không; hàm = tự xử lí. */
  hover?: HoverFxOptions | false | ((s: HoverState) => void);
  /** Chỉnh điểm đích (thế giới) trước khi áp – kẹp tuỳ biến, va chạm, bước nhảy theo mô hình. */
  filter?(world: THREE.Vector3): void;
  /** Áp vị trí (thế giới) – mặc định đặt `object.position` theo hệ cha. */
  apply?(world: THREE.Vector3): void;
  /**
   * Bắt đầu kéo (`world` = gốc vật, `grab` = điểm nắm trên vật). false = từ chối, camera xoay như thường (có onTap → vẫn bấm được);
   * `'block'` / lí do = từ chối nhưng GIỮ phiên con trỏ (camera không xoay, vật đứng yên, lí do hiện toast).
   */
  onStart?(world: THREE.Vector3, p: PointerInfo, grab: THREE.Vector3): StartVerdict;
  onMove?(world: THREE.Vector3, p: PointerInfo): void;
  onEnd?(world: THREE.Vector3, p: PointerInfo, cancelled: boolean): void;
  onTap?(p: PointerInfo): void;
}

export interface Draggable {
  readonly dragging: boolean;
  /** Điểm đích hiện tại (thế giới). */
  readonly goal: THREE.Vector3;
  /** Đặt vị trí bằng mã (demo) – qua filter/apply như khi kéo, không gọi onMove. */
  moveTo(world: THREE.Vector3): void;
  dispose(): void;
}

/** Mặt phẳng qua điểm bắt, vuông góc hướng nhìn – kéo tự do theo màn hình. */
export const facingPlane =
  (camera: THREE.Camera) =>
  (grab: THREE.Vector3): Constraint =>
    planeConstraint(new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), grab));

/**
 * Kéo một vật theo ràng buộc (mặt phẳng / trục / đường cong / bề mặt – constraints.ts). OrbitControls tự tắt khi đang kéo
 * (hub), bật lại khi nhả; rê chuột → con trỏ bàn tay + viền sáng + tooltip `hint`.
 */
export function createDraggable(ctx: InteractCtx, o: DraggableOptions): Draggable {
  const hub = pointerHub(ctx);
  const offset = new THREE.Vector3();
  const goal = new THREE.Vector3();
  const cur = new THREE.Vector3();
  const hit = new THREE.Vector3();
  let constraint: Constraint | null = null;
  let dragging = false;
  let settling = false;
  const hoverFn = typeof o.hover === 'function' ? o.hover : o.hover === false ? undefined : createHoverFx(ctx, o.object, o.hover ?? {});
  const applyWorld = (w: THREE.Vector3) => {
    if (o.apply) return o.apply(w);
    const p = o.object.parent;
    o.object.position.copy(p ? p.worldToLocal(w.clone()) : w);
  };
  const toGoal = (p: PointerInfo) => {
    if (!constraint?.project(p.ray, hit)) return false;
    goal.copy(hit).add(offset);
    o.filter?.(goal);
    return true;
  };
  const target: PointerTarget = {
    object: o.handle ?? o.object,
    priority: o.priority,
    layer: o.layer,
    frame: o.frame,
    opaque: o.opaque,
    cursor: o.cursor,
    hint: o.hint,
    enabled: o.enabled,
    blocked: o.blocked,
    onHover: hoverFn,
    onTap: o.onTap ? (_h, p) => o.onTap?.(p) : undefined,
    onDown(h, p) {
      o.object.getWorldPosition(cur);
      constraint = typeof o.constraint === 'function' ? o.constraint(h.point) : o.constraint;
      if (!constraint.project(p.ray, hit)) hit.copy(h.point);
      offset.copy(o.keepOffset === false ? new THREE.Vector3() : cur.clone().sub(hit));
      goal.copy(cur);
      const v = o.onStart?.(cur.clone(), p, h.point.clone());
      if (v === false) return o.onTap ? undefined : false;
      if (typeof v === 'string') return v;
      dragging = true;
      return {
        move(q) {
          if (!toGoal(q)) return;
          if (!o.smoothing) applyWorld(goal);
          else settling = true;
          o.onMove?.(goal.clone(), q);
        },
        end(q, cancelled) {
          dragging = false;
          if (!o.smoothing) applyWorld(goal);
          o.onEnd?.(goal.clone(), q, cancelled);
        },
      };
    },
  };
  const remove = hub.add(target);
  const off = o.smoothing
    ? hub.onFrame((dt) => {
        if (!settling) return;
        o.object.getWorldPosition(cur);
        cur.lerp(goal, dampFactor(o.smoothing ?? 0, dt));
        if (!dragging && cur.distanceToSquared(goal) < 1e-10) settling = false;
        applyWorld(cur);
      })
    : () => {};
  const api: Draggable = {
    get dragging() {
      return dragging;
    },
    goal,
    moveTo(w) {
      goal.copy(w);
      o.filter?.(goal);
      settling = false;
      applyWorld(goal);
    },
    dispose() {
      remove();
      off();
    },
  };
  ctx.track(() => api.dispose());
  return api;
}
