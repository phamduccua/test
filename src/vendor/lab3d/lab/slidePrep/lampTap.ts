import * as THREE from 'three';
import { addPickProxy, createHoverFx, pointerHub, type InteractCtx } from '../../interact/index';
import type { AlcoholLamp } from '../equipment/alcoholLamp';
import { labText } from '../../text';

export interface LampTapOptions {
  /** Chỉ bắt chuột khi trả true (bước châm / tắt đèn) – lúc khác vùng bắt của đèn không che lam, que cấy trên lửa. */
  enabled(): boolean;
  /** Đèn vừa châm (true) / đậy nắp tắt (false) – bằng tay hoặc demo. */
  onToggle(lit: boolean): void;
}

export interface LampTap {
  readonly lit: boolean;
  /** Bấm đèn (tay + demo cùng đường). */
  toggle(): void;
  /** Đặt ngay (làm lại / hoàn tác). */
  set(lit: boolean): void;
}

/** Đèn cồn bấm được: bấm = mở nắp châm lửa / đậy nắp tắt (SGK: không thổi tắt, không châm từ đèn khác). */
export function createLampTap(ctx: InteractCtx, lamp: AlcoholLamp, o: LampTapOptions): LampTap {
  const hub = pointerHub(ctx);
  const hit = addPickProxy((x) => ctx.track(x), lamp.group, new THREE.Vector3(0.82, 0.9, 0.82), new THREE.Vector3(0, 0.45, 0));
  const toggle = () => {
    lamp.setLit(!lamp.lit);
    o.onToggle(lamp.lit);
  };
  ctx.track(
    hub.add({
      object: hit, cursor: 'pointer',
      hint: () => (lamp.lit ? labText('t_06c143b537c0') : labText('t_f53f0aea7aa8')),
      onHover: createHoverFx(ctx, lamp.group, {}),
      enabled: o.enabled,
      onTap: toggle,
    }),
  );
  return {
    get lit() {
      return lamp.lit;
    },
    toggle,
    set: (on) => lamp.setLit(on),
  };
}
