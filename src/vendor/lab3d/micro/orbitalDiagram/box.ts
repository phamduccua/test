import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { diagramKit } from './kit';

const WHITE = new THREE.Color(0xffffff);

export interface OrbitalBox {
  group: THREE.Group;
  /** Lòng ô (mặt trong) – dùng làm vật để bấm chọn. */
  hit: THREE.Mesh;
  size: { w: number; h: number; d: number };
  setColor(c: THREE.ColorRepresentation): void;
  /** Viền sáng khi rê chuột / chọn (0…1). */
  setHighlight(v: number): void;
  /** Chớp màu (đỏ = vi phạm, xanh = đúng) rồi tắt dần. */
  flash(color: THREE.ColorRepresentation, strength?: number): void;
  /** Rung ngang (vi phạm). */
  shake(amount?: number): void;
  /** Độ hiện (0…1) – mờ phân lớp thừa. */
  setFade(a: number): void;
  /** Độ sáng lòng ô (vd. theo số electron). */
  setFill(v: number): void;
  update(dt: number): void;
  dispose(): void;
}

/**
 * Ô orbital 3D (A-O-ORBITAL): khung 12 cạnh phát sáng nhẹ + lòng hộp trong mờ (thấy đáy/vách sau),
 * mặt trước để trống cho mũi tên spin. Tâm ở gốc; mặt trước hướng +z.
 */
export function createOrbitalBox(
  ctx: Tracker,
  o: { w?: number; h?: number; d?: number; color?: THREE.ColorRepresentation; thickness?: number } = {},
): OrbitalBox {
  const w = o.w ?? 0.5, h = o.h ?? 0.5, d = o.d ?? 0.32;
  const kit = diagramKit(ctx);
  const base = new THREE.Color(o.color ?? 0xffffff);
  const frameColor = new THREE.Color();
  const frameMat = new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.35, transparent: true });
  const innerMat = new THREE.MeshStandardMaterial({
    roughness: 0.6,
    metalness: 0,
    transparent: true,
    opacity: 0.16,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const group = new THREE.Group();
  const frame = new THREE.Mesh(kit.frame(w, h, d, o.thickness ?? Math.min(w, h) * 0.06), frameMat);
  const hit = new THREE.Mesh(kit.unitBox(), innerMat);
  hit.scale.set(w * 0.98, h * 0.98, d * 0.98);
  hit.renderOrder = -1;
  group.add(hit, frame);

  let highlight = 0, pulse = 0, shakeT = 0, shakeA = 0, fade = 1, fill = 0;
  const pulseColor = new THREE.Color();
  const tmp = new THREE.Color();
  const apply = () => {
    frameColor.copy(base).lerp(WHITE, 0.62);
    frameMat.color.copy(frameColor).lerp(pulseColor, Math.min(1, pulse));
    tmp.copy(base).multiplyScalar(0.25 + 0.5 * highlight + 0.25 * fill).lerp(pulseColor, Math.min(1, pulse));
    frameMat.emissive.copy(tmp);
    frameMat.emissiveIntensity = 1 + pulse * 1.5;
    frameMat.opacity = fade;
    frameMat.depthWrite = fade > 0.95;
    innerMat.color.copy(base).lerp(pulseColor, Math.min(1, pulse));
    innerMat.emissive.copy(base).multiplyScalar(0.18 + 0.35 * fill + 0.3 * highlight).lerp(pulseColor, Math.min(1, pulse) * 0.6);
    innerMat.opacity = (0.14 + 0.1 * highlight + 0.1 * fill + 0.2 * Math.min(1, pulse)) * fade;
  };
  apply();

  const box: OrbitalBox = {
    group,
    hit,
    size: { w, h, d },
    setColor(c) {
      base.set(c);
      apply();
    },
    setHighlight(v) {
      highlight = v;
      apply();
    },
    flash(color, strength = 1) {
      pulseColor.set(color);
      pulse = strength;
      apply();
    },
    shake(a = w * 0.12) {
      shakeT = 0.55;
      shakeA = a;
    },
    setFade(a) {
      fade = a;
      apply();
    },
    setFill(v) {
      fill = v;
      apply();
    },
    update(dt) {
      if (pulse > 0) {
        pulse = Math.max(0, pulse - dt * 1.4);
        apply();
      }
      if (shakeT > 0) {
        shakeT = Math.max(0, shakeT - dt);
        const k = shakeT / 0.55;
        group.position.x = Math.sin(shakeT * 60) * shakeA * k;
        if (shakeT === 0) group.position.x = 0;
      }
    },
    dispose() {
      frameMat.dispose();
      innerMat.dispose();
      group.removeFromParent();
    },
  };
  return box;
}
