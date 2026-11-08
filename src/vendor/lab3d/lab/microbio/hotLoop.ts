import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import { createInoculatingLoop } from '../microscopy/smearTools';
import type { Tracker } from '../types';
import { mm } from '../units';

/**
 * Que cấy vòng có nhiệt độ: hơ trong lửa thì dây nóng đỏ (phát sáng theo nhiệt độ), ra khỏi lửa nguội dần.
 * Dây Ø0,7 mm nóng tới ~900 °C sau ~2 s trong lửa (τ 0,8 s), nguội về phòng với τ ≈ 2 s (dưới 50 °C sau ~7 s).
 * Gốc ở tâm vòng, cán theo +x (như `createInoculatingLoop`).
 */
export interface HotLoop {
  group: THREE.Group;
  /** Nhiệt độ dây (°C). */
  readonly temperature: number;
  /** Đang ở trong lửa (nóng lên) hay ngoài (nguội). */
  setInFlame(on: boolean): void;
  /** Màng dịch trong vòng (0 = không có, 1 = đầy) và màu của nó. */
  setLoad(k: number, color?: THREE.ColorRepresentation): void;
  /** Đặt ngay nhiệt độ (kiểm thử). */
  setTemperature(t: number): void;
  update(dt: number): void;
}

const ROOM = 25;
const FLAME = 900;

/** Màu phát sáng của kim loại nóng (ước lượng thân đen: đỏ sẫm 550 °C → cam 900 °C). */
function glow(t: number, out: THREE.Color): number {
  const k = THREE.MathUtils.clamp((t - 480) / 450, 0, 1);
  out.setRGB(1, 0.18 + 0.4 * k, 0.04 + 0.08 * k);
  return k * k * 2.2;
}

export function createHotLoop(ctx: Tracker): HotLoop {
  const group = createInoculatingLoop(ctx);
  const steel = labMaterials(ctx).steel();
  const wire = ctx.track(new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.35, emissive: 0x000000 }));
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material === steel) m.material = wire;
  });
  const filmMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0xe9dcae, roughness: 0.2, metalness: 0 }));
  const film = new THREE.Mesh(ctx.track(new THREE.CircleGeometry(mm(1.75), 20)), filmMat);
  film.rotation.x = -Math.PI / 2;
  film.visible = false;
  group.add(film);
  let T = ROOM;
  let inFlame = false;
  const c = new THREE.Color();
  const apply = () => {
    const e = glow(T, c);
    wire.emissive.copy(c);
    wire.emissiveIntensity = e;
    wire.color.setRGB(0.72 - 0.3 * Math.min(1, (T - ROOM) / 400), 0.74 - 0.35 * Math.min(1, (T - ROOM) / 400), 0.76 - 0.4 * Math.min(1, (T - ROOM) / 400));
  };
  return {
    group,
    get temperature() {
      return T;
    },
    setInFlame(on) {
      inFlame = on;
    },
    setLoad(k, color) {
      film.visible = k > 0.02;
      film.scale.setScalar(0.4 + 0.6 * Math.min(1, k));
      if (color !== undefined) filmMat.color.set(color);
    },
    setTemperature(t) {
      T = t;
      apply();
    },
    update(dt) {
      const target = inFlame ? FLAME : ROOM;
      const tau = inFlame ? 0.8 : 2;
      T += (target - T) * (1 - Math.exp(-dt / tau));
      // Màng dịch bốc hơi ngay khi dây nóng.
      if (T > 100) film.visible = false;
      apply();
    },
  };
}
