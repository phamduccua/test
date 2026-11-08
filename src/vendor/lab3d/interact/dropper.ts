import * as THREE from 'three';
import { createDripAction, type DripAction, type DripTask } from '../lab/actions/dripInto';
import { horizontalConstraint } from './constraints';
import { createDraggable } from './drag';
import type { DropperGesture, DropperGestureOptions, DropperSource, DropperSpot, DropperTarget } from './dropperTypes';
import { dampFactor } from './math';
import { pointerHub } from './pointer';
import type { InteractCtx } from './types';
import { labText } from '../text';

export type { DropperGesture, DropperGestureOptions, DropperSource, DropperSpot, DropperTarget } from './dropperTypes';

const val = (v: number | (() => number) | undefined) => (typeof v === 'function' ? v() : v);
/** Quãng kéo (thế giới) để khoảng lệch lúc nắm tan hết. */
const LEAD = 0.45;

/**
 * Ống hút nhỏ giọt bằng tay: kéo ống hút (ĐẦU NHỌN đi dưới con trỏ trên mặt ngang `carryY`); dừng trên lọ nguồn và GIỮ chuột → nhúng
 * + bóp → hút dần; mang tới miệng ống nhận, giữ yên → nhỏ từng giọt (hoặc nhả/bấm → một giọt). Lọ/ống "ở dưới" khi đầu nhọn nằm
 * thẳng trên miệng HOẶC che miệng theo tia nhìn (như vùng 'column' của dropZones); khi đó đầu nhọn hút vào giữa miệng.
 * Giọt rơi + demo dùng lại createDripAction (chuẩn của kit lab).
 */
export function createDropperGesture(ctx: InteractCtx, o: DropperGestureOptions): DropperGesture {
  const hub = pointerHub(ctx);
  const cap = o.capacity ?? 20;
  const ghost = new THREE.Object3D(); // đầu nhọn "ảo" cho giọt rơi tay (createDripAction cần một tool)
  const drops = createDripAction(ctx, { tool: ghost, parent: o.parent, rest: o.rest.clone(), lift: 0, speed: 1e4 });
  const demo: DripAction = createDripAction(ctx, { tool: o.tool, parent: o.parent, rest: o.rest.clone(), bulb: o.bulb, hang: true });
  const bulbBase = o.bulb?.scale.clone() ?? new THREE.Vector3(1, 1, 1);
  const given = new Map<string, number>(); // giọt đã nhỏ (kể cả đang rơi) mỗi đích
  let loaded = 0;
  let dripped = 0;
  let still = 0;
  let clock = 0;
  let held = false;
  let parked: DropperTarget | null = null;
  let tipY = o.carryY;
  const want = new THREE.Vector3().copy(o.rest);
  const c0 = new THREE.Vector3(), off0 = new THREE.Vector3();
  const cam = new THREE.Vector3(), w = new THREE.Vector3(), m = new THREE.Vector3();
  /** Khoảng cách (hệ parent) từ đầu nhọn tới miệng: nhỏ hơn của "thẳng trên miệng" (xz) và "che miệng theo tia nhìn". */
  const gap = (s: DropperSpot) => {
    const xz = Math.hypot(s.mouth.x - want.x, s.mouth.z - want.z);
    o.parent.worldToLocal(ctx.camera.getWorldPosition(cam));
    w.copy(want).setY(o.carryY);
    const k = Math.abs(w.y - cam.y) > 1e-3 ? (s.mouth.y - cam.y) / (w.y - cam.y) : 1;
    m.set(cam.x + (w.x - cam.x) * k, s.mouth.y, cam.z + (w.z - cam.z) * k);
    return Math.min(xz, Math.hypot(m.x - s.mouth.x, m.z - s.mouth.z));
  };
  const near = <T extends DropperSpot>(list: T[]): T | null => {
    let best: T | null = null;
    let bd = Infinity;
    for (const s of list) {
      const d = gap(s);
      if (d <= s.radius && d < bd) [best, bd] = [s, d];
    }
    return best;
  };
  /** Nguồn / đích dưới đầu nhọn. 'nearest': bỏ nguồn `accepts() === false`, chọn chỗ gần nhất (hoà → nguồn); mặc định nguồn trước. */
  const pick = (): [DropperSource | null, DropperTarget | null] => {
    const s = near(o.pick === 'nearest' ? o.sources.filter((x) => x.accepts?.() !== false) : o.sources);
    const t = s && o.pick !== 'nearest' ? null : near(o.targets);
    return s && (!t || gap(s) <= gap(t)) ? [s, null] : [null, t];
  };
  const squeeze = (s: number) => o.bulb?.scale.set(bulbBase.x * (1 + 0.12 * s), bulbBase.y * (1 - 0.22 * s), bulbBase.z * (1 + 0.12 * s));
  const ok = (s: DropperSpot) => {
    const v = s.accepts?.() ?? true;
    if (typeof v === 'string') hub.toast.show(v);
    return v === true;
  };
  const full = (t: DropperTarget) => {
    const max = val(t.maxDrops);
    return max !== undefined && (given.get(t.id) ?? 0) >= max;
  };
  const drip = (t: DropperTarget) => {
    if (loaded < 1) return hub.toast.show((typeof o.emptyReason === 'function' ? o.emptyReason() : o.emptyReason) || labText('t_1157e28048e8'), 'info');
    if (full(t)) return hub.toast.show(t.fullReason ?? labText('t_21f642c243cd'), 'info');
    if (!ok(t)) return;
    loaded -= 1;
    dripped++;
    given.set(t.id, (given.get(t.id) ?? 0) + 1);
    o.onLoad?.(loaded, null);
    const task: DripTask = { to: o.tool.position.clone(), drops: 1, interval: 0.05, surfaceY: t.surfaceY, onDrop: (_i, hit) => t.onDrop?.(dripped, hit) };
    drops.run(task);
  };
  const free = () => !demo.busy && (o.enabled?.() ?? true);
  const drag = createDraggable(ctx, {
    object: o.tool,
    handle: o.handle,
    priority: o.priority,
    keepOffset: false,
    hint: o.hint ?? ((): string => (loaded >= 1 ? `${labText('t_b43618866d68')}${Math.floor(loaded)}${labText('t_573e68b9d0d8')}` : labText('t_0f3294356cc4'))),
    enabled: free,
    blocked: o.blocked,
    constraint: () => horizontalConstraint(o.parent.localToWorld(new THREE.Vector3(0, o.carryY, 0)).y),
    // Lúc nhấn ống hút KHÔNG nhảy (nhấn giữ tại chỗ = hút ngay trong lọ); kéo đi thì khoảng lệch tan dần trong ~LEAD đơn vị → đầu nhọn
    // về ngay dưới con trỏ (keepOffset: true = giữ lệch suốt).
    apply: (wp) => {
      const k = o.keepOffset ? 1 : Math.max(0, 1 - Math.hypot(wp.x - c0.x, wp.z - c0.z) / (o.lead ?? LEAD));
      want.copy(o.parent.worldToLocal(wp.clone().addScaledVector(off0, k)));
    },
    onStart: (_w, p) => {
      const v = o.onStart?.();
      if (v === false || typeof v === 'string') return v;
      const y = o.parent.localToWorld(new THREE.Vector3(0, o.carryY, 0)).y;
      if (!p.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), c0)) o.tool.getWorldPosition(c0);
      off0.copy(o.tool.getWorldPosition(new THREE.Vector3())).sub(c0).setY(0);
      held = true;
      still = 0;
      dripped = 0;
    },
    onMove: (_w, p) => {
      if (Math.abs(p.dx) + Math.abs(p.dy) > 1.5) still = 0; // còn di chuyển → chưa hút/nhỏ
    },
    onEnd: () => {
      held = false;
      squeeze(0);
      const t = near(o.targets);
      if (t && dripped === 0) drip(t);
      parked = o.park === false ? null : t;
      if (!parked && !(o.park !== false && near(o.sources))) want.copy(o.rest);
    },
    onTap: () => {
      if (parked) drip(parked);
    },
  });
  const spot = new THREE.Vector3();
  ctx.track(
    hub.onFrame((dt) => {
      drops.update(dt);
      if (demo.busy) return demo.update(dt);
      const [src, tgt] = pick();
      still += dt;
      const resting = !held && Math.hypot(want.x - o.rest.x, want.z - o.rest.z) < 1e-3;
      tipY = src ? src.mouth.y - (held ? (src.dip ?? 0.4) : 0) : tgt ? tgt.mouth.y + (o.above ?? 0.15) : resting ? o.rest.y : o.carryY;
      if (held && src && still > 0.25 && loaded < cap && ok(src)) {
        loaded = Math.min(cap, loaded + dt * (o.drawRate ?? 14));
        squeeze(Math.max(0, 1 - loaded / cap));
        o.onLoad?.(loaded, src.id);
      }
      if (held && tgt && still > 0.3 && (clock -= dt) <= 0) {
        clock = o.interval ?? 0.35;
        if (!full(tgt)) {
          drip(tgt);
          squeeze(0.8);
        }
      }
      // Trên lọ/ống: đầu nhọn hút vào giữa miệng (giọt rơi đúng vào ống); còn lại theo con trỏ.
      const s = src ?? tgt;
      spot.copy(s ? s.mouth : want);
      const p = o.tool.position;
      const k = dampFactor(16, dt);
      p.set(p.x + (spot.x - p.x) * k, p.y + (tipY - p.y) * dampFactor(10, dt), p.z + (spot.z - p.z) * k);
    }),
  );
  ctx.track(hub.busy(() => demo.busy || drops.busy));
  const api: DropperGesture = {
    get loaded() {
      return loaded;
    },
    get busy() {
      return demo.busy || drops.busy;
    },
    get dragging() {
      return drag.dragging;
    },
    given: (id) => given.get(id) ?? 0,
    auto(from, to, n, onDone, opt) {
      const s = o.sources.find((x) => x.id === from);
      const t = o.targets.find((x) => x.id === to);
      if (!t) return;
      parked = null;
      given.set(t.id, (given.get(t.id) ?? 0) + n);
      demo.run({ from: s?.mouth, to: t.mouth.clone().setY(t.mouth.y + (o.above ?? 0.15)), drops: n, surfaceY: t.surfaceY, color: s?.color, onDrop: t.onDrop,
        dip: opt?.dip ? s?.dip : undefined, interval: opt?.interval,
        onDone: () => (want.copy(o.rest), onDone?.()) });
    },
    cancel() {
      demo.cancel();
      drops.cancel();
      parked = null;
      want.copy(o.rest);
    },
    unload() {
      loaded = 0;
      o.onLoad?.(0, null);
    },
    reset() {
      api.cancel();
      loaded = 0;
      given.clear();
      o.tool.position.copy(o.rest);
      squeeze(0);
    },
  };
  return api;
}
