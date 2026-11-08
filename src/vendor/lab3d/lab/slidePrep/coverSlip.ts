import * as THREE from 'three';
import { createHandle, pointerHub, type Handle, type InteractCtx, type Pose } from '../../interact/index';
import { mm } from '../units';
import { labText } from '../../text';

export interface CoverSlipOptions {
  /** Lamen (con của `parent` khi chưa đậy). */
  cover: THREE.Object3D;
  parent: THREE.Object3D;
  /** Tâm giọt trên mặt lam (hệ `parent`). */
  center(): THREE.Vector3;
  /** Nửa cạnh lamen (mặc định 11 mm – lamen 22 × 22). */
  half?: number;
  /** Buông tay khi lamen còn nghiêng hơn mức này (độ, mặc định 8) → rơi phẳng, nhốt khí. */
  safeDeg?: number;
  /** Hạ nhanh hơn mức này (độ/s, mặc định 150) → không khí không kịp thoát. */
  fast?: number;
  hint?: string;
  /** Lamen đang tựa nghiêng 45° trên lam (sim giữ trạng thái – sau khi thả lamen vào vùng giọt với `coverHinge`). */
  hinged(): boolean;
  /** Lamen đã nằm phẳng trên lam; `tilt` = hạ từ từ (đúng cách, không bọt khí). */
  onLowered(tilt: boolean): void;
  /** Lời nhắc khi nhả lúc chưa hạ (không tính là lỗi). */
  info?(msg: string): void;
}

export interface CoverSlipLowering {
  handle: Handle;
  /** Góc lamen hiện tại (độ). */
  readonly angle: number;
  /** Demo: hạ từ từ tới 0° (đúng) hoặc buông sớm (`flat` – sai, rơi phẳng). */
  auto(flat: boolean, done: () => void): void;
  /** Về 45° (làm lại / hoàn tác). */
  reset(): void;
}

/** Tư thế lamen tựa một cạnh lên lam ở góc `deg` quanh mép trái của giọt (hệ toạ độ của `top`). */
export function coverPose(top: THREE.Vector3, deg: number, half = mm(11)): { pos: THREE.Vector3; rot: THREE.Euler } {
  const a = THREE.MathUtils.degToRad(deg);
  return { pos: top.clone().add(new THREE.Vector3(-half + half * Math.cos(a), half * Math.sin(a) + mm(0.3), 0)), rot: new THREE.Euler(0, 0, a) };
}

/** `snap` cho vùng thả lamen: hạ từ trên xuống rồi tựa nghiêng 45° (một mép chạm giọt). */
export function coverHinge(top: THREE.Vector3, half = mm(11)): Pose[] {
  const hinge = coverPose(top, 45, half);
  return [{ pos: hinge.pos.clone().add(new THREE.Vector3(0, mm(8), 0)), rot: hinge.rot }, hinge];
}

/**
 * Đậy lamen bằng tay (SGK Bài 9): lamen đã tựa một cạnh lên lam ở 45°; kéo MÉP TỰ DO hạ xuống TỪ TỪ tới khi nằm phẳng → không khí bị
 * đẩy ra một phía, không bọt khí. Hạ quá nhanh hoặc buông khi lamen còn nghiêng → lamen rơi phẳng, nhốt bọt khí. Rút từ TN-062-01.
 */
export function createCoverSlipLowering(ctx: InteractCtx, o: CoverSlipOptions): CoverSlipLowering {
  const hub = pointerHub(ctx);
  const half = o.half ?? mm(11);
  const safe = o.safeDeg ?? 8;
  const fast = o.fast ?? 150;
  const grip = new THREE.Object3D();
  o.parent.add(grip);
  ctx.track(() => grip.removeFromParent());
  let angle = 45;
  let rate = 0;
  let maxRate = 0;
  let prev: { a: number; t: number } | null = null;
  let falling: (() => void) | null = null;
  const edgeAt = (deg: number) => {
    const a = THREE.MathUtils.degToRad(deg);
    return o.center().add(new THREE.Vector3(-half + 2 * half * Math.cos(a), 2 * half * Math.sin(a) + mm(0.3), 0));
  };
  const pose = (deg: number) => {
    angle = deg;
    const p = coverPose(o.center(), deg, half);
    o.cover.position.copy(p.pos);
    o.cover.rotation.copy(p.rot);
  };
  const release = (v: number) => {
    if (!o.hinged() || falling) return;
    if (v >= 44) return o.info?.(labText('t_a9886e8d85d5'));
    const tilt = v <= safe && maxRate < fast;
    const from = v;
    falling = hub.tween(tilt ? 0.25 : 0.12, (k) => pose(from * (1 - k)), () => {
      falling = null;
      o.onLowered(tilt);
    });
  };
  const handle = createHandle(ctx, {
    object: grip,
    handle: o.cover,
    from: () => edgeAt(0),
    to: () => edgeAt(45),
    min: 0,
    max: 45,
    place: false,
    keepOffset: true,
    value: {
      get: () => angle,
      set(v) {
        const t = performance.now() / 1000;
        if (prev && t - prev.t > 0.03) {
          rate = 0.6 * rate + 0.4 * Math.max(0, (prev.a - v) / (t - prev.t));
          maxRate = Math.max(maxRate, rate);
          prev = { a: v, t };
        } else if (!prev) prev = { a: v, t };
        pose(v);
      },
    },
    hint: o.hint ?? labText('t_be584eed7f89'),
    enabled: () => o.hinged() && !falling,
    onStart: () => void ((prev = null), (rate = maxRate = 0)),
    onChange: (v, final) => final && release(v),
  });
  return {
    handle,
    get angle() {
      return angle;
    },
    auto(flat, done) {
      prev = null;
      rate = maxRate = 0;
      handle.animateTo(flat ? 30 : 0, flat ? 0.2 : 2.2, () => {
        release(angle);
        hub.tween(0.4, () => {}, done);
      });
    },
    reset() {
      falling?.();
      falling = null;
      angle = 45;
    },
  };
}
