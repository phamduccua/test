import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import { spinColor } from './kit';
import type { Spin } from './subshell';

export interface SpinElectron {
  group: THREE.Group;
  spin: Spin;
  /** Lật spin (quay 180° quanh trục ngang trong ~0,45 s, đổi màu lam ⇄ cam). */
  setSpin(s: Spin, animate?: boolean): void;
  /** Vầng sáng (0…1+). */
  setGlow(v: number): void;
  /** `rps` = số vòng tự quay hiển thị mỗi giây. */
  update(dt: number, rps?: number): void;
  dispose(): void;
}

/**
 * Electron có spin (A-ELECTRON): cầu bóng tự quay + vòng xích đạo có vạch + mũi tên trục spin (↑ lam, ↓ cam) + vầng sáng.
 * Tâm ở gốc, bán kính `radius`.
 */
export function createSpinElectron(ctx: Tracker, o: { radius?: number; spin?: Spin } = {}): SpinElectron {
  const r = o.radius ?? 0.16;
  const kit = microMaterials(ctx);
  let spin: Spin = o.spin ?? 1;
  const col = new THREE.Color(spinColor(spin));
  const body = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, emissive: col, emissiveIntensity: 0.25 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: col, emissiveIntensity: 0.6, roughness: 0.3 });
  const group = new THREE.Group();
  const tilt = new THREE.Group(); // lật spin
  const rotor = new THREE.Group(); // tự quay quanh trục spin (y)
  group.add(tilt);
  tilt.add(rotor);
  const ball = new THREE.Mesh(kit.sphere('high'), body);
  ball.scale.setScalar(r);
  const ringGeo = ctx.track(new THREE.TorusGeometry(r * 1.45, r * 0.07, 10, 64));
  const ring = new THREE.Mesh(ringGeo, accent);
  ring.rotation.x = Math.PI / 2;
  const tickGeo = ctx.track(new THREE.SphereGeometry(r * 0.16, 12, 8));
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(tickGeo, accent);
    const a = (i / 4) * Math.PI * 2;
    t.position.set(Math.cos(a) * r * 1.45, 0, Math.sin(a) * r * 1.45);
    rotor.add(t);
  }
  rotor.add(ball, ring);
  const shaftGeo = ctx.track(new THREE.CylinderGeometry(r * 0.08, r * 0.08, r * 3.4, 12));
  const headGeo = ctx.track(new THREE.ConeGeometry(r * 0.26, r * 0.7, 16));
  const shaft = new THREE.Mesh(shaftGeo, accent);
  const head = new THREE.Mesh(headGeo, accent);
  head.position.y = r * 1.7 + r * 0.35;
  tilt.add(shaft, head);
  const halo = new THREE.Sprite(kit.glow(0xffffff, 0.7));
  halo.material = halo.material.clone();
  halo.material.color.copy(col);
  halo.scale.setScalar(r * 5);
  group.add(halo);
  let flipFrom = 0, flipTo = 0, flipT = 1, glow = 0.4;
  const from = new THREE.Color(), to = new THREE.Color();

  const e: SpinElectron = {
    group,
    get spin() {
      return spin;
    },
    set spin(s: Spin) {
      e.setSpin(s);
    },
    setSpin(s, animate = true) {
      if (s === spin && flipT >= 1) return;
      spin = s;
      flipFrom = tilt.rotation.z;
      flipTo = s > 0 ? 0 : Math.PI;
      from.copy(body.color);
      to.set(spinColor(s));
      flipT = animate ? 0 : 1;
      if (!animate) {
        tilt.rotation.z = flipTo;
        body.color.copy(to);
      }
    },
    setGlow(v) {
      glow = v;
    },
    update(dt, rps = 1) {
      rotor.rotation.y += dt * rps * Math.PI * 2;
      if (flipT < 1) {
        flipT = Math.min(1, flipT + dt / 0.45);
        const k = flipT < 0.5 ? 2 * flipT * flipT : 1 - (-2 * flipT + 2) ** 2 / 2;
        tilt.rotation.z = flipFrom + (flipTo - flipFrom) * k;
        body.color.copy(from).lerp(to, k);
      }
      body.emissive.copy(body.color);
      accent.emissive.copy(body.color);
      halo.material.color.copy(body.color);
      halo.material.opacity = Math.min(1, 0.35 + glow * 0.6);
      halo.scale.setScalar(r * (4.5 + glow * 3));
    },
    dispose() {
      body.dispose();
      accent.dispose();
      halo.material.dispose();
      group.removeFromParent();
    },
  };
  return e;
}
