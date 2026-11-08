import type * as THREE from 'three';

export interface VesselShaker {
  readonly shaking: boolean;
  /** Lắc trong `duration` giây (nhấc nhẹ lên, lắc qua lại quanh đáy). */
  shake(duration?: number, onDone?: () => void): void;
  /** Dừng ngay và trả về tư thế gốc. */
  stop(): void;
  update(dt: number): void;
}

/**
 * Cử chỉ "lắc đều" cho ống nghiệm/bình: nhấc lên `lift`, nghiêng qua lại `angle` rad với tần số `freq` Hz,
 * biên độ êm vào/ra. Ghi nhớ vị trí/góc gốc của `obj` lúc tạo.
 */
export function createVesselShaker(obj: THREE.Object3D, o: { lift?: number; angle?: number; freq?: number } = {}): VesselShaker {
  const base = { y: obj.position.y, x: obj.position.x, rz: obj.rotation.z };
  const lift = o.lift ?? 0.25;
  const angle = o.angle ?? 0.22;
  const freq = o.freq ?? 3.2;
  let t = 0;
  let dur = 0;
  let done: (() => void) | undefined;
  const apply = (k: number, phase: number) => {
    const env = Math.sin(Math.PI * k);
    const amp = Math.min(1, env * 2.2);
    obj.position.y = base.y + lift * Math.min(1, env * 3);
    obj.rotation.z = base.rz + angle * amp * Math.sin(phase);
    obj.position.x = base.x + 0.04 * amp * Math.sin(phase + 0.6);
  };
  return {
    get shaking() {
      return dur > 0;
    },
    shake(duration = 1.6, onDone) {
      t = 0;
      dur = duration;
      done = onDone;
    },
    stop() {
      dur = 0;
      apply(0, 0);
    },
    update(dt) {
      if (dur <= 0) return;
      t += dt;
      const k = Math.min(1, t / dur);
      apply(k, t * freq * Math.PI * 2);
      if (k >= 1) {
        dur = 0;
        apply(0, 0);
        const cb = done;
        done = undefined;
        cb?.();
      }
    },
  };
}
