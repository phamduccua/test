import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';

export interface ElectronFlights {
  group: THREE.Group;
  readonly active: number;
  /** Phóng một electron từ `from` tới `to` theo cung (arc = độ vồng); `onArrive` khi tới. */
  launch(from: THREE.Vector3, to: THREE.Vector3, o?: { duration?: number; arc?: number; delay?: number; onArrive?: () => void }): void;
  update(dt: number): void;
  clear(): void;
}

/**
 * Electron chuyển dời (phản ứng oxi hoá – khử): hạt vàng phát sáng + vệt sáng mờ dần bay theo đường cong Bezier.
 * Toạ độ theo `group`.
 */
export function createElectronFlights(
  ctx: Tracker,
  o: { size?: number; color?: THREE.ColorRepresentation; pool?: number; trail?: number } = {},
): ElectronFlights {
  const kit = microMaterials(ctx);
  const size = o.size ?? 0.06;
  const color = o.color ?? 0xffe14a;
  const N = o.pool ?? 16;
  const TR = o.trail ?? 6;
  const group = new THREE.Group();
  group.name = 'electrons';
  const core = ctx.track(new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  const glow = kit.glow(color, 0.9);
  const slots = Array.from({ length: N }, () => {
    const g = new THREE.Group();
    g.visible = false;
    const ball = new THREE.Mesh(kit.sphere('low'), core);
    ball.scale.setScalar(size);
    const halo = new THREE.Sprite(glow);
    halo.scale.setScalar(size * 7);
    g.add(ball, halo);
    const trail = Array.from({ length: TR }, (_, k) => {
      const sp = new THREE.Sprite(glow);
      sp.scale.setScalar(size * 4 * (1 - k / TR));
      sp.visible = false;
      group.add(sp);
      return sp;
    });
    group.add(g);
    return {
      g, trail, t: 0, dur: 1, delay: 0, on: false,
      a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(),
      hist: [] as THREE.Vector3[], done: undefined as (() => void) | undefined,
    };
  });
  const bez = (s: (typeof slots)[number], t: number, out: THREE.Vector3) => {
    const u = 1 - t;
    return out.copy(s.a).multiplyScalar(u * u).addScaledVector(s.c, 2 * u * t).addScaledVector(s.b, t * t);
  };
  return {
    group,
    get active() {
      return slots.filter((s) => s.on).length;
    },
    launch(from, to, opt = {}) {
      const s = slots.find((x) => !x.on);
      if (!s) {
        opt.onArrive?.();
        return;
      }
      s.on = true;
      s.t = 0;
      s.dur = opt.duration ?? 1;
      s.delay = opt.delay ?? 0;
      s.a.copy(from);
      s.b.copy(to);
      s.c.lerpVectors(from, to, 0.5).add(new THREE.Vector3(0, opt.arc ?? from.distanceTo(to) * 0.4, 0));
      s.hist.length = 0;
      s.done = opt.onArrive;
    },
    update(dt) {
      for (const s of slots) {
        if (!s.on) continue;
        if (s.delay > 0) {
          s.delay -= dt;
          continue;
        }
        s.t = Math.min(1, s.t + dt / s.dur);
        const e = s.t < 0.5 ? 2 * s.t * s.t : 1 - (-2 * s.t + 2) ** 2 / 2;
        s.g.visible = true;
        bez(s, e, s.g.position);
        s.hist.unshift(s.g.position.clone());
        if (s.hist.length > TR * 2) s.hist.length = TR * 2;
        s.trail.forEach((sp, k) => {
          const h = s.hist[(k + 1) * 2 - 1];
          sp.visible = !!h;
          if (h) sp.position.copy(h);
        });
        if (s.t >= 1) {
          s.on = false;
          s.g.visible = false;
          s.trail.forEach((sp) => (sp.visible = false));
          s.done?.();
        }
      }
    },
    clear() {
      for (const s of slots) {
        s.on = false;
        s.g.visible = false;
        s.trail.forEach((sp) => (sp.visible = false));
      }
    },
  };
}
