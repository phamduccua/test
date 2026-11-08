import * as THREE from 'three';
import { addPickProxy, createKnob, createScrub, pointerHub, type InteractCtx, type Knob, type Scrub } from '../../interact/index';
import type { FocusKnob, FocusModel } from './focusModel';
import { createScopeDock } from './scopeDock';
import type { ScopeParts } from './scopeParts';
import { labText } from '../../text';

export interface ScopeControlsOptions {
  focus: FocusModel;
  parts: ScopeParts;
  /** Nấc mâm vật kính theo thứ tự quay (mâm dầu `fitOilObjective`: [10, 40, 100]; mâm kit: [4, 10, 40]). */
  stops: readonly number[];
  /** Vật kính đang dùng. */
  objective(): number;
  /** Đổi sang vật kính `o` (sim tự đổi mâm, lệch nét, khoảng cách camera) → true, hoặc lí do không cho (toast, mâm bật về). */
  switchTo(o: number): true | string;
  /** Góc mâm (rotation.y) của nấc i – mặc định 120°/nấc như kit (10× ở nấc thứ hai của mâm 4×, nấc đầu của mâm dầu). */
  turretAngle?(i: number): number;
  /** Tiêu bản đang nằm trên bàn kính (mới vặn được). */
  live(): boolean;
  /** Đang nhìn qua thị kính (vi mô): hiện vòng ốc HTML; vĩ mô: vặn núm 3D. */
  micro(): boolean;
  /** Lớp CSS riêng của sim cho hộp vòng ốc (kịch bản kiểm thử tìm theo lớp này). */
  cls: string;
  /** Góc của hộp vòng ốc (vi mô), mặc định 'bottom-left' – xem `createScopeDock`. */
  corner?: 'bottom-left' | 'bottom-right';
  /** Lí do khi vặn lúc chưa có tiêu bản trên kính. */
  idle?: string;
  sound?(e: FocusKnob | 'nose', dz: number): void;
  /** Vừa nhả ốc / mâm (sim kiểm bước lấy nét, đổi vật kính). */
  settled?(): void;
  /** Kéo thị trường (vi mô) = dịch tiêu bản: tấm bắt vô hình đặt trong `root`. */
  pan?: { root: THREE.Object3D; move(dx: number, dy: number): void; end(): void; hint?: string };
}

export interface ScopeControls {
  dials: Record<FocusKnob | 'nose', Scrub>;
  knobs: { coarse: Knob; nose: Knob };
  plate: THREE.Mesh | null;
  /** Demo: vặn ốc `k` thêm dz µm trong s giây (cùng đường set như tay). */
  turn(k: FocusKnob, dz: number, s: number, done?: () => void): void;
  /** Demo: xoay mâm tới vật kính `o`. */
  nose(o: number, done?: () => void): void;
}

const wrap = (d: number) => (d > 50 ? d - 100 : d < -50 ? d + 100 : d);

/**
 * Lấy nét + đổi vật kính bằng tay: vĩ mô vặn ỐC TO (núm 3D) và MÂM VẬT KÍNH (núm 3D quanh trục mâm); vi mô có ba vòng HTML
 * "Ốc to" (1 vòng = 2 mm), "Ốc nhỏ" (1 vòng = 0,1 mm), "Mâm vật kính" (nấc theo `stops`), kéo thị trường = dịch tiêu bản.
 * Chung cho TN-061-01, TN-061-02, TN-119-01, TN-119-02 (rút từ TN-062-01 / TN-071-01 / TN-109-01).
 */
export function createScopeControls(ctx: InteractCtx, o: ScopeControlsOptions): ScopeControls {
  const hub = pointerHub(ctx);
  const { focus, parts, stops } = o;
  const idx = () => Math.max(0, stops.indexOf(o.objective()));
  const dock = createScopeDock(ctx, { cls: `ix-dock--scope ${o.cls}`, corner: o.corner, visible: () => o.micro() && o.live() });

  const units = (k: FocusKnob) => ((((focus.pos[k] / focus.turn[k]) * 100) % 100) + 100) % 100;
  const move = (k: FocusKnob, du: number) => {
    const dz = (wrap(du) / 100) * focus.turn[k];
    focus.move(k, dz);
    o.sound?.(k, dz);
  };
  const text = (k: FocusKnob) => {
    if (focus.broken) return labText('t_b3bee229660a');
    if (k === 'coarse') return `${labText('t_6a73c27f77f3')}${Math.round(focus.z)} µm`;
    return focus.sharp() ? labText('t_e29708e42029') : `${labText('t_a05b92804be5')}${Math.round(focus.off())} µm`;
  };
  const dial = (k: FocusKnob, label: string) =>
    createScrub(ctx, {
      label, kind: 'dial', min: 0, max: 100, wrap: true, place: 'inline',
      value: { get: () => units(k), set: (v) => move(k, v - units(k)), commit: (v) => (move(k, v - units(k)), o.settled?.()) },
      format: () => text(k),
      enabled: o.live,
    });
  const coarse = dial('coarse', labText('t_3cb183a2762d'));
  const fine = dial('fine', labText('t_95fa9305f068'));
  const pick = (i: number): boolean => {
    const to = stops[i];
    if (to === undefined || to === o.objective()) return false;
    const r = o.switchTo(to);
    if (r !== true) {
      hub.toast.show(r, 'error');
      return false;
    }
    o.sound?.('nose', 0);
    return true;
  };
  const nose = createScrub(ctx, {
    label: labText('t_4b6afe1b4fd6'), kind: 'dial', min: 0, max: stops.length, step: 1, wrap: true, place: 'inline',
    value: { get: idx, set: (v) => void pick(v), commit: (v) => (pick(v), o.settled?.()) },
    format: (v) => (stops[v] !== undefined ? `${stops[v]}${labText('t_67fba2f357af')}` : ''),
    enabled: o.live,
  });
  dock.add(coarse, fine, nose);

  // Núm 3D (vĩ mô): ốc to bên trái + mâm vật kính.
  const idle = () => (o.live() ? null : (o.idle ?? labText('t_235dbd5056f5')));
  const side = Math.sign(parts.coarse.position.x || 1);
  addPickProxy((x) => ctx.track(x), parts.coarse, 0.42);
  const coarseKnob = createKnob(ctx, {
    object: parts.coarse, axis: 'x', min: 0, max: 100, wrap: true, angles: [0, side * Math.PI * 2],
    value: { get: () => units('coarse'), set: (v) => move('coarse', v - units('coarse')), commit: (v) => (move('coarse', v - units('coarse')), o.settled?.()) },
    hint: labText('t_dba34ad1b5ab'), enabled: () => !o.micro(), blocked: idle,
  });
  const angle = o.turretAngle ?? ((i: number) => (-2 * Math.PI * (i + (stops[0] === 4 ? 0 : 1))) / 3);
  parts.turret.rotation.y = angle(idx());
  const a0 = angle(0) - angle(idx());
  const noseKnob = createKnob(ctx, {
    object: parts.turret, axis: 'y', min: 0, max: stops.length - 1, step: 1, angles: [a0, a0 + angle(stops.length - 1) - angle(0)],
    value: { get: idx, set: (v) => void pick(v), commit: (v) => (pick(v), o.settled?.()) },
    hint: labText('t_5299eea21c77'), enabled: () => !o.micro(), blocked: idle,
    onChange: (_v, final) => final && noseKnob.set(idx()),
  });

  let plate: THREE.Mesh | null = null;
  if (o.pan) {
    const pan = o.pan;
    plate = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(80, 60).rotateX(-Math.PI / 2)), ctx.track(new THREE.MeshBasicMaterial({ visible: false })));
    plate.name = 'field-plate';
    plate.position.y = 0.2;
    pan.root.add(plate);
    const p = plate;
    ctx.track(() => p.removeFromParent());
    ctx.track(
      hub.add({
        object: plate, cursor: 'grab', hint: pan.hint ?? labText('t_c39a522e4e9d'), enabled: () => o.micro() && o.live(),
        onDown: () => ({ cursor: 'grabbing', move: (q) => pan.move(q.dx, q.dy), end: () => pan.end() }),
      }),
    );
  }
  ctx.track(
    hub.onFrame(() => {
      parts.spin(focus.pos.coarse / focus.turn.coarse, focus.pos.fine / focus.turn.fine);
      for (const [k, s] of [['coarse', coarse], ['fine', fine]] as const) {
        const v = s.element.querySelector('.val');
        const t = text(k);
        if (v && v.textContent !== t) v.textContent = t;
      }
    }),
  );
  return {
    dials: { coarse, fine, nose },
    knobs: { coarse: coarseKnob, nose: noseKnob },
    plate,
    turn(k, dz, s, done) {
      (k === 'coarse' ? coarse : fine).animateTo(units(k) + (dz / focus.turn[k]) * 100, s, done);
    },
    nose(to, done) {
      const i = stops.indexOf(to);
      if (i < 0) return done?.();
      nose.animateTo(i, 0.6, done);
    },
  };
}
