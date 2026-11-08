import * as THREE from 'three';
import { createPourStream } from '../lab/effects/pour';
import { linkPour } from '../lab/geometry/overlapProbe';
import { mm } from '../lab/units';
import { dropBelow, fitPour, type PourFit } from './pourFit';
import { pourQueue } from './pourQueue';
import type { CarryPour, CarryPourOptions, CarryPourTarget } from './carryPourTypes';
import { createGrabbable } from './grab';
import { pointerHub } from './pointer';
import { createLipPivot, createTiltPour } from './pour';
import { createPoseTween } from './poseTween';
import type { InteractCtx, Pose } from './types';
import { labText } from '../text';

export type { CarryPour, CarryPourOptions, CarryPourTarget } from './carryPourTypes';
export { pourPortion } from './pourPortion';

/**
 * Ống đong / cốc / thìa CẦM – MANG – NGHIÊNG RÓT bằng tay (createGrabbable + createTiltPour + createLipPivot): kéo dụng cụ thả lên miệng dụng cụ
 * nhận → tự vào tư thế rót (mép rót ngay trên miệng, thân ngả sẵn), kéo lên/ngang để nghiêng (lưu lượng theo góc + mức còn lại),
 * rót hết → dựng lại, nhấc cao, về chỗ đứng. Dụng cụ nhận sai → lí do. Khớp xoay ở mép rót nên miệng không trượt khỏi đích khi nghiêng.
 * Tư thế rót tự tính (pourFit): môi rót ngay trên mép miệng nhận, thân không lọt vào vật nhận / vật lân cận ở mọi góc nghiêng; dòng rơi thẳng vào lòng.
 */
export function createCarryPour(ctx: InteractCtx, o: CarryPourOptions): CarryPour {
  const axis = o.axis ?? 'x';
  const v = o.vessel;
  const r = v.profile ? v.profile.inner[v.profile.inner.length - 1].r : 0; // bán kính trong ở miệng
  const my = v.mouthY ?? 0;
  const lipLocal = o.lip?.clone() ?? (axis === 'x' ? new THREE.Vector3(0, my, r) : new THREE.Vector3(-r, my, 0));
  const { pivot, tilt: tiltGroup } = createLipPivot(v.group, lipLocal);
  pivot.name = `${o.item}-pivot`;
  o.root.add(pivot);
  const body = new THREE.Object3D();
  body.position.copy(o.bodyAt ?? new THREE.Vector3(0, my * 0.5, 0));
  v.group.add(body);
  const sr = o.streamRadius === false ? mm(1) : (o.streamRadius ?? mm(2.2));
  const stream = createPourStream(ctx, { radius: sr, color: o.color });
  if (o.streamRadius !== false) o.root.add(stream.mesh);
  const yaw = o.yaw ?? 0;
  const upright = new THREE.Euler(0, yaw, 0);
  const pre = o.preTilt ?? 0.85;
  const tiltFor = (y: number) => (axis === 'x' ? new THREE.Euler(pre, y, 0, 'YXZ') : new THREE.Euler(0, y, pre, 'YXZ'));
  const tilted = (t: CarryPourTarget | null) => tiltFor(t?.yaw ?? yaw);
  const lipUp = lipLocal.clone().applyEuler(upright);
  const homePose = (): Pose => ({ pos: o.home.clone().add(lipUp), rot: upright });
  const local = (w: THREE.Vector3) => o.root.worldToLocal(w.clone());
  const mouthW = (t: CarryPourTarget) => t.mouth.getWorldPosition(new THREE.Vector3());
  const lift = o.lift ?? 0.22;
  const fits = new Map<string, PourFit>();
  const fitOpts = o.fit === false ? null : { scene: ctx.scene, root: o.root, tilt: tiltGroup, vessel: v.group, axis, maxTilt: o.maxTilt ?? 1.3, gap: o.fit?.gap, inset: o.fit?.inset ?? sr + mm(3), turn: o.fit?.turn };
  /** Tư thế rót trên `t`: tự tính không xuyên (có proxy) hoặc kiểu cũ – mép rót trên tâm miệng `lift`. */
  const poseAt = (t: CarryPourTarget): Pose => {
    const f = fitOpts && fitPour(fitOpts, mouthW(t), (d) => tiltFor((t.yaw ?? yaw) + d), o.lift ?? 0);
    if (f) fits.set(t.id, f);
    else fits.delete(t.id);
    return { pos: f?.pos ?? local(mouthW(t).add(new THREE.Vector3(0, lift, 0))), rot: f?.rot ?? tilted(t) };
  };
  const zid = (id: string) => `${o.item}@${id}`;
  let at: CarryPourTarget | null = null;
  let flowing = false;
  let leaving = false;
  let pending: (() => void) | undefined;
  const leaveTween = createPoseTween(pivot);
  ctx.track(linkPour(v.group, () => (at ? at.mouth : null)));

  for (const t of o.targets) {
    ctx.track(
      o.zones.add({
        id: zid(t.id), anchor: t.mouth, radius: 0.36, below: 0.25, ring: { radius: (t.radius ?? 0.15) + 0.05 },
        accepts: (i) => (i !== o.item ? false : (t.accepts?.() ?? true)),
        snap: () => {
          const p = poseAt(t);
          return [{ pos: p.pos.clone().add(new THREE.Vector3(0, o.approach ?? 1.5, 0)), rot: p.rot }, p];
        },
      }),
    );
  }
  const grab = createGrabbable(ctx, {
    object: pivot, item: o.item, zones: o.zones, heldRot: upright, lift: o.carryLift ?? 1.5, priority: o.priority ?? 3,
    hint: o.hint ?? labText('t_60a754722791'),
    enabled: () => !at && !leaving && (o.enabled?.() ?? true),
    onPick: o.onPick,
    blocked: o.blocked,
    onPlace(z) {
      at = o.targets.find((t) => z && zid(t.id) === z.id) ?? null;
      flowing = false;
      if (!at) o.onPlace?.(z?.id ?? null);
    },
  });
  const fill = () => (o.fill ? o.fill() : o.liquid.volumeML / o.capacity);
  const tilt = createTiltPour(ctx, {
    vessel: tiltGroup, lip: new THREE.Vector3(), axis, dir: 1, maxTilt: o.maxTilt ?? 1.3, startTilt: 0.3, rate: o.rate ?? 15, fill,
    stream: o.streamRadius === false ? undefined : stream,
    priority: (o.priority ?? 3) + 1, // đang ở tư thế rót (môi rót sát miệng nhận): nhấn lên dụng cụ là nghiêng, không bắt nhầm vật nhận bên dưới
    hint: labText('t_0b1aa6f8b926'),
    enabled: () => !!at && !leaving && o.liquid.volumeML > 0.01,
    floorY: 0,
    receivers: o.targets.map((t) => ({
      id: t.id,
      mouth: () => mouthW(t),
      get radius() {
        return Math.max(t.radius ?? 0.15, fits.get(t.id)?.mouthR ?? 0);
      },
      surface: t.surface,
      drop(lip: THREE.Vector3) {
        const f = fits.get(t.id);
        return f ? dropBelow(f, lip, t.surface ? t.surface().y : null, sr) : null;
      },
      onPour(amount) {
        if (t !== at) return;
        const ml = Math.min(amount, o.liquid.volumeML);
        o.liquid.setVolume(o.liquid.volumeML - ml);
        if (!flowing) {
          flowing = true;
          o.onStart?.(t.id);
        }
        t.onPour(ml);
      },
    })),
  });
  /** Rót hết: dựng lại → nhấc thẳng lên cao (không quệt bình) → dựng đứng trên chỗ đứng → hạ xuống. */
  const leave = () => {
    const t = at!;
    leaving = true;
    o.onEmpty?.(t.id);
    const up = pivot.position.clone().add(new THREE.Vector3(0, o.leaveUp ?? 2.1, 0));
    const h = homePose();
    const above = h.pos.clone().setY(Math.max(up.y, h.pos.y + 0.6));
    leaveTween.play([{ pos: up, rot: fits.get(t.id)?.rot ?? tilted(t) }, { pos: above, rot: upright }, h], [0.6, 0.8, 0.55], () => {
      grab.reset(h);
      at = null;
      leaving = false;
      o.onHome?.(t.id);
      const cb = pending;
      pending = undefined;
      cb?.();
    });
  };
  const hub = pointerHub(ctx);
  // Rót hết ở đích, đang dựng lại để về chỗ: cũng tính là bận (`__ix.idle()` chờ dụng cụ về hẳn chỗ đứng).
  ctx.track(hub.busy(() => leaving || (!!at && !tilt.dragging && o.liquid.volumeML <= 0.01)));
  const queue = pourQueue(ctx.scene, () => leaving);
  let waiting: (() => void) | null = null;
  ctx.track(queue.dispose);
  ctx.track(
    hub.onFrame((dt) => {
      if (waiting && !queue.blocked()) {
        const go = waiting;
        waiting = null;
        go();
      }
      leaveTween.update(dt);
      if (at && !leaving && o.liquid.volumeML <= 0.01 && !tilt.dragging) {
        tilt.cancel();
        if (tilt.angle < 0.04) leave();
      }
    }),
  );
  grab.setHome(homePose()); // chỗ đứng = chỗ nghỉ của grab (thả ngoài vùng thì về đây, không về gốc toạ độ)
  grab.reset(homePose());
  return {
    pivot, body, grab, tilt, stream,
    get at() { return at?.id ?? null; }, // prettier-ignore
    get busy() {
      return !!at || leaving || grab.state !== 'rest';
    },
    zoneId: zid,
    pourInto(id, onDone) {
      pending = onDone;
      waiting = () =>
        grab.carryTo(zid(id), () => {
          if (at?.id === id) tilt.auto(o.pourTilt ?? (o.maxTilt ?? 1.3) * 0.92, 60);
          else {
            pending = undefined;
            onDone?.();
          }
        });
    },
    reset() {
      waiting = null;
      leaveTween.cancel();
      tilt.cancel();
      at = null;
      leaving = false;
      pending = undefined;
      flowing = false;
      grab.setHome(homePose());
      grab.reset(homePose());
      tiltGroup.rotation.set(0, 0, 0);
    },
  };
}
