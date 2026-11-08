import * as THREE from 'three';
import type { PourStream } from '../lab/effects/pour';
import { linkPour } from '../lab/geometry/overlapProbe';
import { createHoverFx } from './hover';
import { clamp, dampFactor, flowFromTilt } from './math';
import { pointerHub } from './pointer';
import { createPourRaise } from './pourRaise';
import type { InteractCtx, PointerTarget } from './types';
import { labText } from '../text';

export interface PourReceiver {
  id: string;
  /** Tâm miệng dụng cụ nhận (thế giới). */
  mouth(): THREE.Vector3;
  /** Bán kính miệng (thế giới, xz) – mép rót phải nằm trong. */
  radius: number;
  /** Điểm dòng chảy chạm (mặt chất lỏng, thế giới) – mặc định miệng. */
  surface?(): THREE.Vector3;
  /** Điểm dòng chảy chạm khi mép rót ở `lip` (thế giới) – ghi đè `surface` (vd. rơi thẳng dưới môi rót vào lòng); null = như cũ. */
  drop?(lip: THREE.Vector3): THREE.Vector3 | null;
  /** Nhận lượng `amount` (đơn vị của `rate`) mỗi frame đang chảy vào. */
  onPour?(amount: number): void;
}

export interface TiltPourOptions {
  /** Dụng cụ rót – xoay quanh trục cục bộ `axis` qua gốc (đặt gốc ở mép rót/đáy cho tự nhiên). */
  vessel: THREE.Object3D;
  handle?: THREE.Object3D;
  /** Điểm mép rót (toạ độ cục bộ của vessel). */
  lip: THREE.Vector3;
  /** Trục nghiêng cục bộ: 'x' | 'z' hoặc vectơ (trục chéo, vd. miệng chúc về trước-phải). */
  axis?: 'x' | 'z' | THREE.Vector3;
  /** Chiều nghiêng: +1 = rotation dương. */
  dir?: 1 | -1;
  /** Góc tối đa / góc bắt đầu chảy khi đầy (rad; mặc định 1,9 / 0,7). */
  maxTilt?: number;
  startTilt?: number;
  /** Lưu lượng khi mở hết (đơn vị/giây, vd. mL/s). */
  rate: number;
  /** Mức còn lại 0…1 (bình vơi → phải nghiêng nhiều hơn mới chảy); trả 0 = hết. */
  fill?(): number;
  /** Dòng chảy (createPourStream của @lab) – được đặt mỗi frame theo mép rót → dụng cụ nhận / mặt bàn. */
  stream?: PourStream;
  receivers: PourReceiver[];
  /** Độ cao mặt bàn (thế giới) – rót trượt ra ngoài thì dòng rơi xuống đây. */
  floorY?: number;
  /** Nhả chuột → dựng lại (mặc định true). */
  springBack?: boolean;
  priority?: number;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  /** Mỗi frame: độ mở 0…1 và dụng cụ đang nhận (null = đổ ra ngoài). */
  onFlow?(flow: number, receiver: PourReceiver | null): void;
  onSpill?(amount: number): void;
  /** Tự nâng `vessel` theo y khi nghiêng trên miệng nhận mà thân lọt vào vật nhận (cần proxy va chạm – createVessel; mặc định true). */
  raise?: boolean;
}

export interface TiltPour {
  readonly angle: number;
  readonly flow: number;
  readonly receiver: PourReceiver | null;
  readonly dragging: boolean;
  /** Demo: nghiêng tới `angle`, giữ `hold` giây rồi dựng lại. */
  auto(angle: number, hold: number, onDone?: () => void): void;
  cancel(): void;
}

/**
 * Cử chỉ NGHIÊNG ĐỂ RÓT: kéo chuột (ngang/lên) xoay góc nghiêng, lưu lượng ∝ góc (flowFromTilt); mép rót đứng trên miệng dụng cụ
 * nhận thì chảy vào (onPour), không thì đổ ra bàn (onSpill). Dòng chảy dùng createPourStream sẵn có.
 */
export function createTiltPour(ctx: InteractCtx, o: TiltPourOptions): TiltPour {
  const hub = pointerHub(ctx);
  const axis = o.axis ?? 'z';
  const dir = o.dir ?? 1;
  const max = o.maxTilt ?? 1.9;
  const vec = typeof axis === 'string' ? null : axis.clone().normalize();
  const base = typeof axis === 'string' ? o.vessel.rotation[axis] : 0;
  const baseQ = o.vessel.quaternion.clone();
  const q = new THREE.Quaternion();
  const turn = (a: number) => {
    if (typeof axis === 'string') o.vessel.rotation[axis] = base + dir * a;
    else o.vessel.quaternion.copy(baseQ).multiply(q.setFromAxisAngle(vec!, dir * a));
  };
  let angle = 0;
  let want = 0;
  let flow = 0;
  let dragging = false;
  let recv: PourReceiver | null = null;
  let auto: { a: number; hold: number; phase: 0 | 1 | 2; done?: () => void } | null = null;
  const lipW = new THREE.Vector3();
  const end = new THREE.Vector3();
  const toStream = (w: THREE.Vector3) => (o.stream?.mesh.parent ? o.stream.mesh.parent.worldToLocal(w.clone()) : w.clone());
  const findReceiver = () =>
    o.receivers.find((r) => {
      const m = r.mouth();
      return Math.hypot(m.x - lipW.x, m.z - lipW.z) <= r.radius && m.y < lipW.y + 0.02;
    }) ?? null;
  const target: PointerTarget = {
    object: o.handle ?? o.vessel,
    priority: o.priority,
    cursor: 'grab',
    hint: o.hint ?? labText('t_259b0fd9e24b'),
    enabled: () => !auto && (o.enabled?.() ?? true),
    onHover: createHoverFx(ctx, o.vessel),
    onDown() {
      dragging = true;
      const a0 = want;
      return {
        cursor: 'grabbing',
        move: (p) => void (want = clamp(a0 + (Math.abs(p.totalX) - p.totalY) * 0.008, 0, max)),
        end: () => {
          dragging = false;
          if (o.springBack !== false) want = 0;
        },
      };
    },
  };
  const remove = hub.add(target);
  // Cặp rót cho __ix.overlaps(): dụng cụ đang nghiêng có mép rót trên miệng nhận nào (kể cả chưa chảy).
  const raiser = o.raise === false ? null : createPourRaise(ctx.scene, o.vessel);
  /** Miệng nhận gần môi rót nhất (≤ 10 cm ngang) – cho tự nâng cả khi môi rót chưa vào miệng (đang hạ xuống tư thế rót). */
  const nearestMouth = () => {
    let best: THREE.Vector3 | null = null;
    for (const r of o.receivers) {
      const m = r.mouth();
      if (Math.hypot(m.x - lipW.x, m.z - lipW.z) < (best ? Math.hypot(best.x - lipW.x, best.z - lipW.z) : 1)) best = m;
    }
    return best;
  };
  const unlink = linkPour(o.vessel, () => (angle > 0.02 ? (findReceiver()?.mouth() ?? null) : null));
  const off = hub.onFrame((dt) => {
    if (auto) {
      if (auto.phase === 0 && Math.abs(angle - auto.a) < 0.02) auto.phase = 1;
      else if (auto.phase === 1 && (auto.hold -= dt) <= 0) auto.phase = 2;
      want = auto.phase === 2 ? 0 : auto.a;
      if (auto.phase === 2 && angle < 0.02) {
        const cb = auto.done;
        auto = null;
        cb?.();
      }
    }
    angle += (want - angle) * dampFactor(dragging ? 14 : 6, dt);
    turn(angle);
    o.vessel.updateMatrixWorld();
    raiser?.update(findReceiver()?.mouth() ?? nearestMouth(), angle, dt);
    o.vessel.localToWorld(lipW.copy(o.lip));
    flow = flowFromTilt(angle, o.startTilt ?? 0.7, max * 0.85, o.fill?.() ?? 1);
    recv = flow > 0 ? findReceiver() : null;
    if (recv) end.copy(recv.drop?.(lipW) ?? recv.surface?.() ?? recv.mouth());
    else end.set(lipW.x + 0.02 * dir, o.floorY ?? 0, lipW.z);
    o.stream?.set(toStream(lipW), toStream(end), flow);
    const amount = flow * o.rate * dt;
    if (amount > 0) {
      if (recv) recv.onPour?.(amount);
      else o.onSpill?.(amount);
    }
    o.onFlow?.(flow, recv);
  });
  const unbusy = hub.busy(() => !!auto);
  ctx.track(() => (remove(), off(), unbusy(), unlink()));
  return {
    get angle() {
      return angle;
    },
    get flow() {
      return flow;
    },
    get receiver() {
      return recv;
    },
    get dragging() {
      return dragging;
    },
    auto(a, hold, onDone) {
      auto = { a: clamp(a, 0, max), hold, phase: 0, done: onDone };
    },
    cancel() {
      auto = null;
      want = 0;
    },
  };
}

/**
 * Khớp xoay ở MÉP RÓT cho dụng cụ cầm tay (ống đong, cốc, thìa): `pivot` (vật được cầm/mang) → `tilt` (nghiêng – đưa cho
 * createTiltPour làm `vessel`, `lip` = gốc) → `vessel` (dời −lip). Nghiêng quanh mép nên miệng không trượt khỏi đích.
 * `origin`: 'lip' = gốc `pivot` ở mép rót; 'base' = gốc `pivot` trùng gốc dụng cụ (giữ vị trí cũ trên bàn).
 */
export function createLipPivot(vessel: THREE.Object3D, lip: THREE.Vector3, origin: 'lip' | 'base' = 'lip') {
  const pivot = new THREE.Group();
  const tilt = new THREE.Group();
  pivot.add(tilt);
  tilt.add(vessel);
  vessel.position.copy(lip).negate();
  if (origin === 'base') tilt.position.copy(lip);
  return { pivot, tilt };
}
