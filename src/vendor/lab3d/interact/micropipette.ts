import type * as THREE from 'three';
import { createDropperGesture } from './dropper';
import type { DropperGesture, DropperGestureOptions, DropperTarget } from './dropperTypes';
import { damp } from './math';
import { pointerHub } from './pointer';
import type { InteractCtx } from './types';

/** Phần micropipette mà cử chỉ điều khiển (createMicropipette của kit lab: gốc ở mũi tip, trục +y). */
export interface PipetteBody {
  group: THREE.Object3D;
  /** Ấn piston 0 (nhả) … 1 (nấc 1) … 1,4 (nấc 2 – thổi hết). */
  press(k: number): void;
  setLoad(color: THREE.ColorRepresentation | null, fill?: number): void;
}

export interface MicropipetteGestureOptions extends Omit<DropperGestureOptions, 'tool' | 'bulb' | 'onLoad'> {
  pipette: PipetteBody;
  /** Phần tip có dịch khi hút đầy (0…1), mặc định 0,45. */
  fill?: number;
  /** Màu dịch khi nguồn không khai báo `color`. */
  color?: THREE.ColorRepresentation;
  /** Mỗi lần lượng trong tip đổi (như createDropperGesture; cả trong demo `auto`): src = nguồn khi hút, null khi bơm / bỏ dịch. */
  onLoad?(n: number, src: string | null): void;
  /** Bắt đầu hút ở nguồn `src` (tip rỗng → có dịch) – tay lẫn demo; âm piston. */
  onDraw?(src: string): void;
  /** Một lần bơm chạm đích `target` (sau `onDrop` của đích) – tay lẫn demo. */
  onDispense?(target: string): void;
}

export interface MicropipetteGesture extends DropperGesture {
  /** Nguồn của dịch đang trong tip (null = rỗng). */
  readonly source: string | null;
}

/**
 * Micropipette làm bằng tay trên createDropperGesture (cách làm của TN-038-01 điện di, dùng ở TN-113-01): kéo pipet tới ống/lọ, GIỮ chuột = nhúng
 * tip + nhả piston hút; mang tới đích, nhả / giữ yên = ấn piston bơm. Piston và cột dịch trong tip chạy theo: ấn nấc 1 khi cầm tip rỗng,
 * nhả dần khi hút, ấn nấc 2 khi bơm; demo `auto` (createDripAction) cũng hút – bơm đúng như tay. Mặc định sức chứa 1 = một lần hút.
 * `sources` / `targets` là mảng của sim (đổi theo bước được); `onDrop` của đích được bọc tại chỗ để báo `onDispense`.
 */
export function createMicropipetteGesture(ctx: InteractCtx, o: MicropipetteGestureOptions): MicropipetteGesture {
  const pip = o.pipette;
  const cap = o.capacity ?? 1;
  const colorOf = (id: string) => o.sources.find((s) => s.id === id)?.color ?? o.color ?? '#e9eef2';
  let load = 0;
  let src: string | null = null;
  let color: THREE.ColorRepresentation = o.color ?? '#e9eef2';
  let pulse = 0;
  let press = 0;
  let quiet = false;
  let demo: { from: string | null; drops: number; left: number; dipY: number } | null = null;
  const loaded = (id: string, n: number) => {
    if (src === null) o.onDraw?.(id);
    src = id;
    color = colorOf(id);
    load = n;
  };
  // Bọc `onDrop` NGAY TRÊN đích (một lần mỗi đích) – sim đổi danh sách `targets` (splice) theo bước vẫn được, đích mới bọc ở frame sau.
  const wrapped = new WeakSet<DropperTarget>();
  const wrap = () => {
    for (const t of o.targets) {
      if (wrapped.has(t)) continue;
      wrapped.add(t);
      const own = t.onDrop;
      t.onDrop = (i, hit) => {
        if (demo) {
          demo.left -= 1;
          load = (cap * Math.max(0, demo.left)) / demo.drops;
          if (demo.left <= 0) {
            src = null;
            pulse = 1;
            o.onLoad?.(0, null);
          }
        }
        own?.(i, hit);
        o.onDispense?.(t.id);
      };
    }
  };
  wrap();
  const g = createDropperGesture(ctx, {
    ...o,
    tool: pip.group,
    capacity: cap,
    onLoad(n, id) {
      if (id !== null && n > 0) loaded(id, n);
      else if (id === null) {
        if (n < load && !quiet) pulse = 1;
        if (n <= 1e-3) src = null;
        load = n;
      }
      o.onLoad?.(n, id);
    },
  });
  ctx.track(
    pointerHub(ctx).onFrame((dt) => {
      wrap();
      if (demo && !g.busy) demo = null;
      // Demo: tip nhúng xuống dưới miệng nguồn = đã hút (createDripAction không báo onLoad).
      if (demo?.from && !src && demo.left === demo.drops && pip.group.position.y < demo.dipY) {
        loaded(demo.from, cap);
        o.onLoad?.(cap, demo.from);
      }
      pulse = Math.max(0, pulse - dt / 0.7);
      const base = src ? Math.max(0, 1 - load / cap) : g.dragging || demo ? 1 : 0;
      press = damp(press, pulse > 0.4 ? 1.4 : base, 14, dt);
      pip.press(press);
      pip.setLoad(src ? color : null, (o.fill ?? 0.45) * (0.3 + 0.7 * Math.min(1, load / cap)));
    }),
  );
  const api: MicropipetteGesture = {
    get loaded() {
      return g.loaded;
    },
    get busy() {
      return g.busy;
    },
    get dragging() {
      return g.dragging;
    },
    get source() {
      return src;
    },
    given: (id) => g.given(id),
    auto(from, to, n, onDone, opt) {
      wrap();
      const s = o.sources.find((x) => x.id === from);
      demo = { from, drops: Math.max(1, n), left: Math.max(1, n), dipY: s ? s.mouth.y - 0.02 : -Infinity };
      g.auto(from, to, n, () => {
        demo = null;
        onDone?.();
      }, opt);
    },
    cancel() {
      demo = null;
      g.cancel();
    },
    unload() {
      quiet = true;
      g.unload();
      quiet = false;
    },
    reset() {
      demo = null;
      g.reset();
      src = null;
      load = pulse = press = 0;
      pip.press(0);
      pip.setLoad(null);
    },
  };
  return api;
}
