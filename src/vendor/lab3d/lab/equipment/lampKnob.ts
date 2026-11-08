import * as THREE from 'three';
import { addPickProxy, createKnob, type Binding, type Knob } from '../../interact/index';
import type { SimContext } from '../../sim/types';
import { mm } from '../units';
import type { AlcoholLamp } from './alcoholLamp';
import { labText } from '../../text';

export interface LampKnobOptions {
  /** Mức núm 0…1 (thường `bindParam(p, 'flame', ctx.gui)` – hai chiều với lil-gui). */
  value: Binding<number>;
  /** Từ mức này trở lên thì đèn cháy (mặc định 0,12). */
  litAt?: number;
  hint?: () => string;
  enabled?(): boolean;
  blocked?(): string | null;
  onChange?(v: number, final: boolean): void;
}

export interface LampKnob {
  knob: Knob;
  /** Đặt đèn theo mức (gọi cả khi đổi từ lil-gui): cháy / tắt (nắp chụp), cỡ ngọn lửa. */
  apply(v: number): void;
  readonly litAt: number;
}

/**
 * Núm chỉnh bấc ở cổ đèn cồn (bánh xe có khía, mặt hướng về người xem – TN-097-02, TN-109-01): vặn để nâng bấc → bật lửa, vặn thêm →
 * lửa to, vặn về 0 → tắt (đậy nắp). Dùng chung cho mọi sim có đèn cồn `createAlcoholLamp`.
 */
export function createLampKnob(ctx: SimContext, lamp: AlcoholLamp, o: LampKnobOptions): LampKnob {
  const litAt = o.litAt ?? 0.12;
  const mat = ctx.track(new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.85, roughness: 0.35 }));
  const pivot = new THREE.Group();
  pivot.position.set(0, mm(84), mm(19));
  pivot.rotation.x = Math.PI / 2;
  const wheel = new THREE.Group();
  const disc = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(11), mm(11), mm(6), 28)), mat);
  disc.castShadow = true;
  wheel.add(disc);
  const ridge = ctx.track(new THREE.BoxGeometry(mm(2.2), mm(6.6), mm(2)));
  for (let k = 0; k < 12; k++) {
    const r = new THREE.Mesh(ridge, mat);
    const a = (k / 12) * Math.PI * 2;
    r.position.set(Math.cos(a) * mm(11), 0, Math.sin(a) * mm(11));
    r.rotation.y = -a;
    wheel.add(r);
  }
  const mark = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(2), mm(1), mm(9))), ctx.track(new THREE.MeshStandardMaterial({ color: 0xe8543a })));
  mark.position.set(0, mm(3.2), mm(4.5));
  wheel.add(mark);
  pivot.add(wheel);
  lamp.group.add(pivot);
  const apply = (v: number) => {
    const lit = v >= litAt;
    if (lit !== lamp.lit) lamp.setLit(lit);
    lamp.flame.group.scale.setScalar(0.45 + 0.8 * Math.min(1, v));
  };
  const handle = addPickProxy((x) => ctx.track(x), wheel, new THREE.Vector3(0.3, 0.12, 0.3));
  const knob = createKnob(ctx, {
    object: wheel, handle, axis: 'y', min: 0, max: 1, angles: [0, -Math.PI * 1.5], step: 0.01, value: o.value,
    hint: o.hint ?? (() => (o.value.get() >= litAt ? labText('t_7676b93896ea') : labText('t_6d8eea01014e'))),
    enabled: o.enabled,
    blocked: o.blocked,
    onChange: (v, final) => {
      apply(v);
      o.onChange?.(v, final);
    },
  });
  apply(o.value.get());
  return { knob, apply, litAt };
}
