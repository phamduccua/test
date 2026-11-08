import * as THREE from 'three';
import { createHoverFx, pointerHub, type InteractCtx, type StartVerdict } from '../../interact/index';
import type { PourStream } from '../effects/pour';
import { labText } from '../../text';

export interface WashSquirtOptions {
  /** Bình rửa (bấm vào để bóp). */
  bottle: THREE.Object3D;
  /** Vùng bắt (mặc định `bottle`). */
  handle?: THREE.Object3D;
  /** Thân bình – bóp dẹt lại khi xịt. */
  body?: THREE.Object3D;
  /** Đầu vòi. */
  tip: THREE.Object3D;
  /** Tia nước (`createPourStream`) nằm trong `parent`. */
  jet: PourStream;
  parent: THREE.Object3D;
  /** Chỗ tia nước chạm (hệ `parent`) – đầu cao của lam. */
  target(): THREE.Vector3;
  enabled?(): boolean;
  blocked?(): string | null | undefined;
  hint?: string;
  /** Nhấn vào: false / lí do = không cho bóp. */
  onStart?(): StartVerdict;
  /** Giữ ít nhất chừng này (s) mới tính là một lần xịt (mặc định 0,3). */
  minHold?: number;
  /** Mỗi frame: cường độ tia 0…1 (tăng khi bóp, tắt dần khi nhả). */
  onFlow?(k: number, dt: number): void;
  /** Một lần xịt xong (nhả tay); `n` = tổng số lần, `held` = giây đã bóp. */
  onSquirt?(n: number, held: number): void;
}

export interface WashSquirt {
  readonly squirts: number;
  /** Đang có tia nước (đang bóp hoặc đang tắt dần). */
  readonly flowing: boolean;
  /** Demo: bóp `s` giây rồi nhả (cùng đường như tay). */
  press(s: number, done?: () => void): void;
  reset(n?: number): void;
}

/**
 * Bình rửa có vòi bằng tay: NHẤN GIỮ vào bình = bóp → tia nước từ vòi xuống đầu cao của lam (thân bình dẹt lại); nhả = thôi xịt,
 * mỗi lần bóp đủ lâu = một lần xịt rửa. Sim tô dòng nước chảy qua vết bôi xuống chậu theo `onFlow`.
 */
export function createWashSquirt(ctx: InteractCtx, o: WashSquirtOptions): WashSquirt {
  const hub = pointerHub(ctx);
  const minHold = o.minHold ?? 0.3;
  const body0 = o.body?.scale.clone() ?? new THREE.Vector3(1, 1, 1);
  const tipW = new THREE.Vector3();
  let squeezing = false;
  let held = 0;
  let k = 0;
  let squirts = 0;
  let flowed = false;
  let auto: { left: number; done?: () => void } | null = null;
  const start = () => {
    squeezing = true;
    held = 0;
  };
  const stop = () => {
    if (!squeezing) return;
    squeezing = false;
    if (held >= minHold) o.onSquirt?.(++squirts, held);
  };
  ctx.track(
    hub.add({
      object: o.handle ?? o.bottle,
      cursor: 'pointer',
      hint: o.hint ?? labText('t_59b31b0937b2'),
      enabled: () => !auto && (o.enabled?.() ?? true),
      blocked: o.blocked,
      onHover: createHoverFx(ctx, o.bottle, {}),
      onDown() {
        const v = o.onStart?.();
        if (v === false) return false;
        if (typeof v === 'string') return v;
        start();
        return { cursor: 'grabbing', end: () => stop() };
      },
    }),
  );
  ctx.track(hub.busy(() => !!auto || k > 0.01));
  ctx.track(
    hub.onFrame((dt) => {
      if (auto && (auto.left -= dt) <= 0) {
        const d = auto.done;
        auto = null;
        stop();
        d?.();
      }
      if (squeezing) held += dt;
      k = squeezing ? Math.min(1, k + dt / 0.2) : Math.max(0, k - dt / 0.25);
      o.body?.scale.set(body0.x, body0.y, body0.z * (1 - 0.14 * k));
      const from = o.parent.worldToLocal(o.tip.getWorldPosition(tipW));
      o.jet.set(from, o.target(), k);
      if (k > 0 || squeezing || flowed) o.onFlow?.(k, dt);
      flowed = k > 0;
    }),
  );
  return {
    get squirts() {
      return squirts;
    },
    get flowing() {
      return k > 0.01;
    },
    press(s, done) {
      start();
      auto = { left: s, done };
    },
    reset(n = 0) {
      squirts = n;
      squeezing = false;
      auto = null;
      k = 0;
      o.body?.scale.copy(body0);
      o.jet.set(o.target(), o.target(), 0);
    },
  };
}
