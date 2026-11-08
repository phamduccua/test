import * as THREE from 'three';
import { addPickProxy, binding, createKnob, pointerHub, type InteractCtx, type PointerTarget } from '../../interact/index';
import type { Mortar } from './mortar';

export interface GrindGestureOptions {
  mortar: Mortar;
  /** Số vòng chày để nghiền nhuyễn (progress 0 → 1), mặc định 6. */
  turns?: number;
  /** Tư thế chày lúc nghỉ (cục bộ cối) – mặc định giữ tư thế lúc tạo. */
  rest?: { pos: THREE.Vector3; rot: THREE.Euler };
  hint?: PointerTarget['hint'];
  priority?: number;
  enabled?(): boolean;
  /** Đang bị chặn → lí do (con trỏ cấm + lí do khi rê, nhấn chỉ báo lí do). */
  blocked?(): string | null | undefined;
  /** Mỗi lần chày dịch: tiến độ 0…1 và tốc độ (vòng/giây, cho âm cối chày). */
  onProgress?(progress: number, turnsPerSec: number): void;
  /** Vừa nghiền đủ (progress chạm 1). */
  onDone?(): void;
}

export interface GrindGesture {
  readonly progress: number;
  readonly pivot: THREE.Object3D;
  readonly dragging: boolean;
  /** Tốc độ quay chày hiện tại (vòng/giây, tắt dần khi dừng tay). */
  readonly speed: number;
  /** Demo: quay chày đủ số vòng còn lại trong `seconds` giây (cùng đường cập nhật như tay). */
  auto(seconds: number, onDone?: () => void): void;
  /** Đặt tiến độ (hoàn tác / làm lại) – chày về chỗ nghỉ. */
  reset(progress?: number): void;
}

/**
 * KÉO VÒNG CHÀY nghiền mẫu trong cối sứ (createMortar của grinding/): nhấn chày, kéo vòng quanh lòng cối (như vặn núm quanh trục đứng
 * của cối – createKnob) → đầu chày chạy tròn sát đáy, thân ngả theo; quãng quay (cả hai chiều) cộng vào tiến độ nghiền, mẫu vụn dần
 * (`mortar.setGrind`). Nhả tay → chày tựa lại thành cối.
 */
export function createGrindGesture(ctx: InteractCtx, o: GrindGestureOptions): GrindGesture {
  const hub = pointerHub(ctx);
  const m = o.mortar;
  const turns = o.turns ?? 6;
  // Khớp quay đặt ở độ cao tay cầm chày: vòng kéo trên màn hình quanh trục cối ở đúng độ cao đó (vùng bắt vô hình cũng vậy).
  const HAND = 0.7;
  const lower = (p: THREE.Vector3) => p.clone().add(new THREE.Vector3(0, -HAND, 0));
  const r0 = o.rest ?? { pos: m.pestle.position.clone(), rot: m.pestle.rotation.clone() };
  const rest = { pos: lower(r0.pos), rot: r0.rot };
  // Chày là con của khớp quay giữa cối: núm xoay khớp → đầu chày chạy tròn; nhả tay thì chày tựa thành cối ngay chỗ đó.
  const pivot = new THREE.Group();
  pivot.name = 'grind-pivot';
  pivot.position.y = HAND;
  m.group.add(pivot);
  pivot.add(m.pestle);
  addPickProxy((x) => ctx.track(x), m.pestle, new THREE.Vector3(0.36, 1.2, 0.36), new THREE.Vector3(0, 0.55, 0));
  let progress = 0;
  let last = 0;
  let speed = 0;
  let moved = 0;
  const grindPose = m.pestlePose(0);
  const place = () => {
    m.pestle.position.copy(lower(grindPose.pos));
    m.pestle.rotation.copy(grindPose.rot);
  };
  const toRest = () => {
    m.pestle.position.copy(rest.pos);
    m.pestle.rotation.copy(rest.rot);
  };
  const advance = (v: number) => {
    let d = v - last;
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;
    last = v;
    place();
    if (progress >= 1) return;
    moved += Math.abs(d);
    progress = Math.min(1, progress + Math.abs(d) / turns);
    m.setGrind(progress);
    o.onProgress?.(progress, speed);
    if (progress >= 1) o.onDone?.();
  };
  const knob = createKnob(ctx, {
    object: pivot,
    handle: m.pestle,
    axis: 'y',
    min: 0,
    max: 1,
    wrap: true,
    angles: [0, Math.PI * 2],
    value: binding(() => last, advance),
    priority: o.priority ?? 2,
    hint: o.hint,
    enabled: o.enabled,
    blocked: o.blocked,
    onChange: (_v, final) => final && toRest(),
  });
  // Tốc độ quay (vòng/giây) đo theo quãng chày đi mỗi khung, tắt dần khi dừng tay – âm cối chày theo tốc độ này.
  ctx.track(
    hub.onFrame((dt) => {
      if (dt <= 0) return;
      speed += (moved / dt - speed) * Math.min(1, dt * 8);
      moved = 0;
    }),
  );
  toRest();
  return {
    /** Khớp quay (ở độ cao tay cầm) – tâm vòng kéo. */
    pivot,
    get progress() {
      return progress;
    },
    get dragging() {
      return knob.dragging;
    },
    get speed() {
      return speed;
    },
    auto(seconds, onDone) {
      const n = Math.max(1, Math.ceil((1 - progress) * turns));
      knob.animateTo(last + n, seconds, () => (toRest(), onDone?.()));
    },
    reset(p = 0) {
      progress = p;
      last = 0;
      m.setGrind(p);
      toRest();
    },
  };
}
