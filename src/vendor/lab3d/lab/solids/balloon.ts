import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface Balloon {
  /** Gốc = miệng bình (đặt tại vessel.mouth). */
  group: THREE.Group;
  /** Thể tích khí trong bóng (mL) – bóng phồng mượt tới giá trị này. */
  setVolume(ml: number, instant?: boolean): void;
  readonly volumeML: number;
  update(dt: number, elapsed: number): void;
}

/**
 * Bóng bay cao su chụp miệng bình thu khí: cổ bóng ôm miệng, quả bóng xẹp rủ sang bên → phồng tròn dần theo V,
 * cao su mỏng dần (sáng + trong hơn). `mouthRadius` = bán kính ngoài miệng bình.
 */
export function createBalloon(ctx: Tracker, o: { mouthRadius: number; color?: THREE.ColorRepresentation }): Balloon {
  const group = new THREE.Group();
  group.name = 'balloon';
  const base = new THREE.Color(o.color ?? 0xe8423f);
  const mat = ctx.track(
    new THREE.MeshPhysicalMaterial({
      color: base.clone(), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.15, sheenColor: 0xffffff,
      transparent: true, opacity: 0.97, side: THREE.DoubleSide,
    }),
  );
  const rn = o.mouthRadius + mm(0.6);
  const neckH = mm(16);
  const neck = new THREE.Mesh(
    ctx.track(new THREE.LatheGeometry([new THREE.Vector2(rn + mm(1.2), -mm(4)), new THREE.Vector2(rn, 0), new THREE.Vector2(rn * 0.55, neckH)], 40)),
    mat,
  );
  neck.castShadow = true;
  // Cuộn mép cổ bóng.
  const roll = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(rn + mm(1.2), mm(1.4), 10, 40)), mat);
  roll.rotation.x = Math.PI / 2;
  roll.position.y = -mm(4);
  // Thân bóng: giọt nước đơn vị (đáy ở y = 0, bán kính 1).
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * Math.PI;
    const r = Math.sin(t) * (1 - 0.18 * Math.cos(t));
    pts.push(new THREE.Vector2(Math.max(0.0001, r + (i === 0 ? 0.12 : 0)), 1 - Math.cos(t)));
  }
  pts[0].set(0.12, 0);
  const bulb = new THREE.Mesh(ctx.track(new THREE.LatheGeometry(pts, 48)), mat);
  bulb.castShadow = true;
  const pivot = new THREE.Group();
  pivot.position.y = neckH * 0.9;
  pivot.add(bulb);
  group.add(neck, roll, pivot);

  const white = new THREE.Color(0xffffff);
  const r0 = mm(9); // bán kính bóng xẹp (cao su chưa giãn)
  let target = 0;
  let vol = 0;
  const apply = (elapsed: number) => {
    const R = Math.cbrt((3 * vol * 1e-3) / (4 * Math.PI)); // mL → đv³ (1 mL = 0,001 dm³)
    const inflate = THREE.MathUtils.smoothstep(R, r0 * 0.6, r0 * 1.8);
    const rad = Math.max(r0 * 0.75, R);
    // Xẹp: dẹt, rủ sang bên; căng: tròn, dựng đứng, khẽ lắc.
    bulb.scale.set(rad * (1.15 - 0.15 * inflate), rad * (0.55 + 0.6 * inflate), rad * (0.8 + 0.2 * inflate));
    pivot.rotation.z = (1 - inflate) * 1.25 + 0.03 * Math.sin(elapsed * 1.3);
    pivot.rotation.x = 0.02 * Math.sin(elapsed * 0.9);
    mat.color.copy(base).lerp(white, 0.1 * inflate);
    mat.opacity = 0.97 - 0.12 * inflate;
  };
  const api: Balloon = {
    group,
    get volumeML() {
      return vol;
    },
    setVolume(ml, instant) {
      target = Math.max(0, ml);
      if (instant) {
        vol = target;
        apply(0);
      }
    },
    update(dt, elapsed) {
      vol += (target - vol) * Math.min(1, dt * 4);
      apply(elapsed);
    },
  };
  apply(0);
  return api;
}
