import type * as THREE from 'three';
import type { SimLoopDef, SimSound } from '../../audio/index';
import type { FocusKnob } from './focusModel';

/** Vật hoặc điểm (thế giới) phát âm. */
type At = THREE.Object3D | THREE.Vector3;

/** Âm sự kiện chung của bàn làm tiêu bản (thư viện kit/lab3d/audio, CC0) – mỗi hàm đã có minGap / pitchJitter hợp lí. */
export interface SlidePrepSfx {
  /** Bóp quả bóp + giọt rơi lên lam. */
  drip(at: At): void;
  /** Bóp hút dung dịch vào ống hút. */
  load(at: At): void;
  put(at: At, kind: 'glass' | 'soft'): void;
  /** Lamen chạm lam (hạ từ từ) / rơi phẳng (có bọt khí). */
  lamen(at: At, flat: boolean): void;
  /** Lam lên bàn kính: chạm kính + kẹp + bật đèn. */
  mount(at: At, lamp?: At): void;
  /** Ốc to / ốc nhỏ vừa dời dz µm – tiếng nấc theo quãng vặn. */
  knob(k: FocusKnob, dz: number): void;
  nose(at?: At): void;
  /** Châm đèn cồn (bật lửa) / đậy nắp. */
  lamp(on: boolean, at: At): void;
  /** Bấm đồng hồ (bắt đầu đếm). */
  watch(): void;
  /** Mỗi frame khi đồng hồ chạy: tích từng giây (thời gian thực). */
  tick(dt: number, running: boolean): void;
  /** Bóp bình rửa (tia nước). */
  squirt(at: At): void;
  blot(at: At): void;
  /** Que cấy nóng chạm dịch / vào lửa. */
  sizzle(at: At): void;
  /** Một lượt quệt (que cấy / tăm bông) – nhịp loop `rub`. */
  rub(): void;
  /** Lam lướt qua ngọn lửa. */
  pass(at: At): void;
  crack(): void;
}

/**
 * Loop quá trình chuẩn cho createSimSound: ngọn lửa đèn cồn, dòng nước rửa xuống chậu, quệt (nhịp `rub`).
 * `lamp` = đèn cồn, `basin` = nơi nước chảy xuống (null = không có chậu).
 */
export function slidePrepLoops(lamp: THREE.Object3D | null, basin: THREE.Object3D | null): Record<string, SimLoopDef> {
  const out: Record<string, SimLoopDef> = { rub: { id: 'lab/swab-rub', smooth: 0.06, volume: 0.35 } };
  if (lamp) out.flame = { id: 'lab/flame', at: lamp, smooth: 0.4, volume: 0.6 };
  if (basin) out.flow = { id: 'lab/water-trickle', at: basin, smooth: 0.15, volume: 0.55 };
  return out;
}

export const SLIDE_PREP_PRELOAD = [
  'lab/drip', 'lab/squeeze', 'lab/glass-put', 'lab/coverslip', 'lab/focus-knob', 'lab/turret-click', 'lab/lighter', 'lab/lamp-cap',
  'lab/stopwatch', 'lab/clock-tick', 'lab/wash-squirt', 'lab/blot', 'lab/switch', 'lab/loop-sizzle',
];

/** Âm sự kiện bàn làm tiêu bản trên SimSound của sim (đã khai báo `slidePrepLoops`). */
export function createSlidePrepSfx(s: SimSound): SlidePrepSfx {
  const acc: Record<FocusKnob, number> = { coarse: 0, fine: 0 };
  const STEP: Record<FocusKnob, number> = { coarse: 60, fine: 3 };
  let sec = 0;
  return {
    drip(at) {
      s.sfx('lab/squeeze', { at, volume: 0.35, pitchJitter: 0.08, minGap: 0.2 });
      s.sfx('lab/drip', { at, volume: 0.5, delay: 0.12, pitchJitter: 0.1, minGap: 0.2 });
    },
    load: (at) => s.sfx('lab/squeeze', { at, volume: 0.45, rate: 0.9, minGap: 0.6 }),
    put(at, kind) {
      if (kind === 'glass') s.sfx('lab/glass-put', { at, volume: 0.45, pitchJitter: 0.06, minGap: 0.25 });
      else s.sfx('lab/blot', { at, volume: 0.35, rate: 1.2, pitchJitter: 0.1, minGap: 0.25 });
    },
    lamen(at, flat) {
      s.sfx('lab/coverslip', { at, volume: flat ? 0.75 : 0.5, rate: flat ? 0.85 : 1, pitchJitter: 0.05, minGap: 0.3 });
      if (flat) s.sfx('lab/pop-small', { at, volume: 0.22, delay: 0.08, rate: 1.4, minGap: 0.3 });
    },
    mount(at, lamp) {
      s.sfx('lab/glass-put', { at, volume: 0.45, pitchJitter: 0.05 });
      s.sfx('lab/click-small', { at, volume: 0.3, delay: 0.18, key: 'clip' });
      s.sfx('lab/switch', { at: lamp ?? at, volume: 0.4, delay: 0.35 });
    },
    knob(k, dz) {
      acc[k] += Math.abs(dz);
      if (acc[k] < STEP[k]) return;
      acc[k] = 0;
      s.sfx('lab/focus-knob', { volume: k === 'coarse' ? 0.5 : 0.32, rate: k === 'coarse' ? 0.8 : 1.25, pitchJitter: 0.06, minGap: 0.05, key: `knob-${k}` });
    },
    nose: (at) => s.sfx('lab/turret-click', { at, volume: 0.6, pitchJitter: 0.04, minGap: 0.2 }),
    lamp(on, at) {
      if (on) s.sfx('lab/lighter', { at, volume: 0.5 });
      else s.sfx('lab/lamp-cap', { at, volume: 0.6 });
    },
    watch() {
      s.sfx('lab/stopwatch', { volume: 0.6, minGap: 0.5 });
      sec = 0;
    },
    tick(dt, running) {
      if (!running) return void (sec = 0);
      if ((sec += dt) < 1) return;
      sec -= 1;
      s.sfx('lab/clock-tick', { volume: 0.2, pitchJitter: 0.02 });
    },
    squirt: (at) => s.sfx('lab/wash-squirt', { at, volume: 0.55, pitchJitter: 0.06, minGap: 0.3 }),
    blot: (at) => s.sfx('lab/blot', { at, volume: 0.5, pitchJitter: 0.08, minGap: 0.3 }),
    sizzle: (at) => s.sfx('lab/loop-sizzle', { at, volume: 0.55, pitchJitter: 0.08, minGap: 0.4 }),
    rub: () => s.pulse('rub', 0.8, 0.22),
    pass: (at) => s.sfx('lab/flare-whoosh', { at, volume: 0.12, rate: 1.5, pitchJitter: 0.1, minGap: 0.25 }),
    crack: () => s.sfx('lab/ice-crack', { volume: 0.7 }),
  };
}
