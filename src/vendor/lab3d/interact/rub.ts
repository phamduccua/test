import type * as THREE from 'three';
import { createHoverFx, type HoverFxOptions } from './hover';
import { clamp } from './math';
import { pointerHub } from './pointer';
import type { InteractCtx, PointerTarget, StartVerdict } from './types';
import { labText } from '../text';

export interface RubOptions {
  /** Vật để bắt (ống nghiệm, phoi kim loại…) – raycast cả con cháu; vật nhỏ thì truyền `handle` = addPickProxy. */
  object: THREE.Object3D;
  handle?: THREE.Object3D;
  /** Trục kéo trên màn hình (mặc định 'x' – qua lại ngang). */
  axis?: 'x' | 'y';
  /** Số lần đổi chiều cần cho đủ (mặc định 6). */
  strokes?: number;
  /** Quãng tối thiểu (px) một lượt trước khi tính đổi chiều (mặc định 16). */
  minStroke?: number;
  /** Biên độ (px) ứng với độ lệch ±1 (mặc định 70). */
  range?: number;
  priority?: number;
  layer?: string;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, nhấn chỉ báo lí do, camera không xoay); null = không. */
  blocked?(): string | null | undefined;
  hover?: HoverFxOptions | false;
  /** Nhấn vào: false / `'block'` / lí do = không cho (lí do → toast; vẫn giữ phiên để camera không xoay). */
  onStart?(): StartVerdict;
  /** Mỗi lần di chuyển: độ lệch −1…1 so với chỗ nhấn (để lắc/chà vật theo) và tiến độ 0…1. */
  onMove?(offset: number, progress: number): void;
  /** Mỗi lần đổi chiều (đủ quãng). */
  onStroke?(count: number, progress: number): void;
  /** Đủ số lượt (một lần cho tới khi reset). */
  onDone?(): void;
  /** Nhả (độ lệch về 0). */
  onEnd?(progress: number, cancelled: boolean): void;
}

export interface RubGesture {
  readonly progress: number;
  readonly active: boolean;
  /** Demo: lắc/chà qua lại `seconds` giây bằng CÙNG đường onMove/onStroke/onDone như tay. */
  auto(seconds?: number, onDone?: () => void): void;
  /** Đặt lại tiến độ (mặc định 0). */
  reset(progress?: number): void;
  cancel(): void;
}

/**
 * Cử chỉ KÉO QUA LẠI trên vật: lắc ống nghiệm, chà phoi kim loại trên giấy nhám, khuấy… Đếm số lần đổi chiều (đủ quãng `minStroke`)
 * thành tiến độ; `onMove(offset)` để sim lắc/chà vật theo con trỏ. Nhả giữa chừng thì giữ tiến độ (làm tiếp được).
 */
export function createRubGesture(ctx: InteractCtx, o: RubOptions): RubGesture {
  const hub = pointerHub(ctx);
  const need = Math.max(1, o.strokes ?? 6);
  const minStroke = o.minStroke ?? 16;
  const range = o.range ?? 70;
  let count = 0;
  let active = false;
  let done = false;
  let off: (() => void) | null = null;
  // Một lượt: chiều hiện tại + quãng đã đi theo chiều đó; tâm dao động trôi theo con trỏ khi vượt biên độ.
  let dir = 0;
  let run = 0;
  let pos = 0;
  let center = 0;
  const progress = () => Math.min(1, count / need);
  const step = (d: number) => {
    pos += d;
    if (pos - center > range) center = pos - range;
    if (center - pos > range) center = pos + range;
    const s = Math.sign(d);
    if (s !== 0 && s !== dir) {
      if (dir !== 0 && run >= minStroke) {
        count++;
        o.onStroke?.(count, progress());
        if (!done && count >= need) {
          done = true;
          o.onDone?.();
        }
      }
      dir = s;
      run = 0;
    }
    run += Math.abs(d);
    o.onMove?.(clamp((pos - center) / range, -1, 1), progress());
  };
  const begin = () => {
    active = true;
    dir = 0;
    run = 0;
    pos = 0;
    center = 0;
  };
  const finish = (cancelled: boolean) => {
    active = false;
    o.onMove?.(0, progress());
    o.onEnd?.(progress(), cancelled);
  };
  const hover = o.hover === false ? undefined : createHoverFx(ctx, o.object, o.hover ?? {});
  const axis = o.axis ?? 'x';
  ctx.track(
    hub.add({
      object: o.handle ?? o.object,
      priority: o.priority,
      layer: o.layer,
      cursor: axis === 'x' ? 'ew-resize' : 'ns-resize',
      hint: o.hint ?? labText('t_433270b95846'),
      enabled: () => !off && (o.enabled?.() ?? true),
      blocked: o.blocked,
      onHover: hover,
      onDown() {
        const v = o.onStart?.();
        if (v === false || typeof v === 'string') return v === false ? 'block' : v; // giữ phiên – camera không xoay
        begin();
        return {
          cursor: axis === 'x' ? 'ew-resize' : 'ns-resize',
          move: (p) => step(axis === 'x' ? p.dx : p.dy),
          end: (_p, cancelled) => finish(cancelled),
        };
      },
    }),
  );
  const api: RubGesture = {
    get progress() {
      return progress();
    },
    get active() {
      return active;
    },
    auto(seconds = 2, onDone) {
      api.cancel();
      begin();
      let t = 0;
      let last = 0;
      const hz = Math.max(2, need / Math.max(0.5, seconds) / 2 + 0.6);
      off = hub.onFrame((dt) => {
        // Chia nhỏ khung dài (máy chậm, ít khung hình/giây) thành bước ≤ 1/60 s: không bỏ sót lần đổi chiều nào.
        const n = Math.max(1, Math.ceil(dt * 60));
        for (let i = 0; i < n && !done; i++) {
          t += dt / n;
          const x = Math.sin(t * hz * Math.PI * 2) * range * 0.85;
          step(x - last);
          last = x;
        }
        if (t < seconds && !done) return;
        off?.();
        off = null;
        finish(false);
        onDone?.();
      });
    },
    reset(p = 0) {
      count = Math.round(clamp(p, 0, 1) * need);
      done = count >= need;
    },
    cancel() {
      if (!off) return;
      off();
      off = null;
      finish(true);
    },
  };
  ctx.track(() => off?.());
  ctx.track(hub.busy(() => !!off));
  return api;
}
