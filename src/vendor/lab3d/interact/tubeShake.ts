import * as THREE from 'three';
import { clearanceOf, findClearance } from '../lab/geometry/clearancePairs';
import { UNIT_MM } from '../lab/units';
import { damp } from './math';
import { pointerHub } from './pointer';
import { addPickProxy } from './raycast';
import { createRubGesture, type RubGesture } from './rub';
import type { InteractCtx } from './types';

export interface ShakeTube {
  /** Ống (nhóm được nhấc + nghiêng; gốc ở đáy ống, trục +y). */
  object: THREE.Object3D;
  /** Chỗ đứng trong giá (hệ cha của `object`). */
  home: THREE.Vector3;
}

export interface TubeShakeOptions {
  /** Cho cầm ống i lắc? true hoặc lí do (toast, ống không nhấc). */
  accepts(i: number): true | string;
  /** Lắc đủ số lượt (`strokes`) lần đầu. */
  done?(i: number): void;
  /** Mỗi frame ống i đang được lắc (đang kéo qua lại) – mô hình theo thời gian lắc. */
  onShake?(i: number, dt: number): void;
  enabled?(): boolean;
  hint?: (i: number, progress: number) => string;
  /** Số lần đổi chiều cho đủ (mặc định 6), quãng px ứng với lệch ±1 (60). */
  strokes?: number;
  range?: number;
  /** Nhấc khỏi giá (mặc định 0,88 – đáy qua thanh đỡ 78 mm), lệch ngang (0,1), nghiêng tối đa (0,28 rad) khi lắc. */
  lift?: number;
  sway?: number;
  tilt?: number;
  /** Vùng bắt quanh ống: cỡ + tâm (hệ ống). */
  proxy?: { size: THREE.Vector3; offset: THREE.Vector3 };
  priority?: number;
}

export interface TubeShakers {
  rubs: RubGesture[];
  /** Ống i đang trên tay (nhấc khỏi giá / đang lắc). */
  held(i: number): boolean;
  /** Đặt ngay mọi ống về giá, xoá tiến độ lắc (làm lại / hoàn tác). */
  seat(): void;
}

/**
 * Cầm ống nghiệm lắc bằng tay (dùng chung các sim nhận biết phân tử – Bài 6): nhấn giữ trên ống → ống nhấc thẳng khỏi giá; kéo qua lại
 * → ống lắc theo con trỏ (lệch + nghiêng quanh đáy; biên độ tự thu nhỏ để thân không đụng ống bên cạnh – proxy va chạm), đủ `strokes`
 * lượt = trộn đều; nhả → ống về giá. Demo: `rubs[i].auto` (cùng đường
 * onMove/onStroke/onDone). Ống không được lắc → `accepts` trả lí do.
 */
export function createTubeShakers(ctx: InteractCtx, tubes: ShakeTube[], o: TubeShakeOptions): TubeShakers {
  const LIFT = o.lift ?? 0.88;
  const SWAY = o.sway ?? 0.1;
  const TILT = o.tilt ?? 0.28;
  const lift = tubes.map(() => 0);
  const sway = tubes.map(() => 0);
  const held = tubes.map(() => false);
  const moving = tubes.map(() => 0);
  const box = o.proxy ?? { size: new THREE.Vector3(0.26, 1.5, 0.26), offset: new THREE.Vector3(0, 0.85, 0) };
  // Kích thước thân ống (proxy va chạm của createVessel): bán kính ngoài + chiều cao, thế giới; không có proxy → không giới hạn lắc.
  const dims = tubes.map((t) => {
    const g = findClearance(t.object);
    const px = g && clearanceOf(g);
    const k = g ? g.getWorldScale(new THREE.Vector3()).y : 1;
    return px ? { r: px.maxR * k, h: (px.top - px.y0) * k, y0: px.y0 * k } : null;
  });
  const wa = new THREE.Vector3();
  const wb = new THREE.Vector3();
  /** Biên độ lắc tối đa (0…1) của ống i để thân không đụng các ống khác đang đứng gần (khe 1 mm). */
  const room = (i: number, out: number) => {
    const a = dims[i];
    if (!a || !tubes[i].object.parent) return 1;
    let k = 1;
    tubes[i].object.parent.localToWorld(wa.copy(tubes[i].home));
    const baseY = wa.y + LIFT * lift[i] + a.y0;
    tubes.forEach((t, j) => {
      const b = dims[j];
      if (j === i || !b || held[j]) return;
      t.object.getWorldPosition(wb);
      const over = wb.y + b.y0 + b.h - baseY; // phần thân ống j cao hơn đáy ống i đang nhấc
      if (over <= 0) return;
      const free = Math.hypot(wb.x - wa.x, wb.z - wa.z) - a.r - b.r - 1 / UNIT_MM;
      k = Math.min(k, Math.max(0, free) / Math.max(1e-6, (SWAY + over * Math.tan(TILT)) * out));
    });
    return Math.min(1, k);
  };
  const rubs: RubGesture[] = tubes.map((t, i) => {
    const proxy = addPickProxy((x) => ctx.track(x), t.object, box.size, box.offset);
    return createRubGesture(ctx, {
      object: t.object,
      handle: proxy,
      strokes: o.strokes ?? 6,
      range: o.range ?? 60,
      priority: o.priority,
      hint: o.hint ? (): string => o.hint!(i, rubs[i].progress) : undefined,
      enabled: o.enabled,
      onStart: () => {
        const v = o.accepts(i);
        if (v !== true) return v;
        held[i] = true;
      },
      onMove: (off) => {
        if (Math.abs(off - sway[i]) > 0.01) moving[i] = 0.25;
        sway[i] = off;
      },
      onDone: () => o.done?.(i),
      onEnd: () => (held[i] = false),
    });
  });
  ctx.track(
    pointerHub(ctx).onFrame((dt) => {
      tubes.forEach((t, i) => {
        const on = held[i] || rubs[i].active;
        if (on && (moving[i] -= dt) > 0) o.onShake?.(i, dt);
        const want = on ? 1 : 0;
        if (lift[i] === want && !on) return;
        lift[i] = Math.abs(lift[i] - want) < 1e-3 ? want : damp(lift[i], want, 7, dt);
        if (!on) sway[i] = damp(sway[i], 0, 8, dt);
        // Nhấc thẳng lên trước, ra khỏi thanh đỡ rồi mới lắc ngang.
        const out = THREE.MathUtils.smoothstep(lift[i], 0.55, 1);
        const s = out > 0 ? THREE.MathUtils.clamp(sway[i], -1, 1) * room(i, out) : sway[i];
        t.object.position.set(t.home.x + s * SWAY * out, t.home.y + LIFT * lift[i], t.home.z);
        t.object.rotation.z = -s * TILT * out;
      });
    }),
  );
  return {
    rubs,
    held: (i) => held[i] || rubs[i].active || lift[i] > 0.02,
    seat() {
      tubes.forEach((t, i) => {
        rubs[i].cancel();
        rubs[i].reset(0);
        held[i] = false;
        lift[i] = 0;
        sway[i] = 0;
        t.object.position.copy(t.home);
        t.object.rotation.set(0, 0, 0);
      });
    },
  };
}
