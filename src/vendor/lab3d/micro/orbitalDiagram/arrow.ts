import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import { diagramKit, FLAG_COLORS, spinColor } from './kit';
import type { Spin } from './subshell';

type Mode = 'rest' | 'drop' | 'reject' | 'leave';

export interface SpinArrow {
  group: THREE.Group;
  spin: Spin;
  /** true khi đã bật ra / rời đi xong – người giữ nên gỡ và dispose. */
  readonly done: boolean;
  readonly mode: Mode;
  /** Vị trí nghỉ (toạ độ của cha). */
  target: THREE.Vector3;
  /** Thả rơi từ `from` (mặc định ngay trên ô) xuống `target`, nảy nhẹ rồi nằm yên. */
  drop(from?: THREE.Vector3, delay?: number): void;
  /** Rơi tới miệng ô, chớp đỏ rồi bị đẩy bật ra ngoài. */
  reject(from?: THREE.Vector3): void;
  /** Bay lên và mờ dần (bỏ electron). */
  leave(): void;
  /** Đặt ngay vào vị trí nghỉ. */
  snap(): void;
  /** Chớp sáng (photon, highlight electron cuối). */
  glow(strength?: number, color?: THREE.ColorRepresentation): void;
  setOpacity(a: number): void;
  update(dt: number): void;
  dispose(): void;
}

/**
 * Mũi tên spin đùn khối (↑ lam / ↓ cam) phát sáng nhẹ, có hoạt cảnh rơi + nảy vào ô, bật ra khi vi phạm, rời đi.
 * `height` = chiều cao mũi tên (đv cảnh). Hệ toạ độ do cha quy định (thường là nhóm của sơ đồ ô).
 */
export function createSpinArrow(ctx: Tracker, spin: Spin, height = 0.4): SpinArrow {
  const kit = diagramKit(ctx);
  const color = new THREE.Color(spinColor(spin));
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.1, transparent: true });
  const mesh = new THREE.Mesh(kit.arrow(), mat);
  mesh.scale.setScalar(height);
  if (spin < 0) mesh.rotation.z = Math.PI;
  const halo = new THREE.Sprite(microMaterials(ctx).glow(color, 0.55));
  halo.scale.setScalar(height * 1.3);
  const group = new THREE.Group();
  group.add(halo, mesh);
  const pos = group.position;
  const vel = new THREE.Vector3();
  let mode: Mode = 'rest', done = false, wait = 0, t = 0, glowV = 0, opacity = 1;
  const glowColor = new THREE.Color();
  const g = height * 32;

  const paint = () => {
    const k = Math.min(1, glowV);
    mat.emissive.copy(color).lerp(glowColor, k);
    mat.emissiveIntensity = 0.55 + 1.6 * k;
    halo.scale.setScalar(height * (1.3 + 1.6 * k));
    mat.opacity = opacity;
    mat.depthWrite = opacity > 0.95;
    halo.visible = opacity > 0.05;
  };

  const arrow: SpinArrow = {
    group,
    spin,
    get done() {
      return done;
    },
    get mode() {
      return mode;
    },
    target: new THREE.Vector3(),
    drop(from, delay = 0) {
      pos.copy(from ?? arrow.target.clone().add(new THREE.Vector3(0, height * 5, 0)));
      vel.set(0, 0, 0);
      mode = 'drop';
      wait = delay;
      group.visible = delay <= 0;
    },
    reject(from) {
      arrow.drop(from);
      mode = 'reject';
      t = 0;
    },
    leave() {
      mode = 'leave';
      t = 0;
      vel.set(0, height * 6, 0);
    },
    snap() {
      pos.copy(arrow.target);
      mode = 'rest';
      group.visible = true;
    },
    glow(s = 1, c = 0xffffff) {
      glowColor.set(c);
      glowV = s;
      paint();
    },
    setOpacity(a) {
      opacity = a;
      paint();
    },
    update(dt) {
      if (glowV > 0) {
        glowV = Math.max(0, glowV - dt * 1.6);
        paint();
      }
      if (wait > 0) {
        wait -= dt;
        if (wait > 0) return;
        group.visible = true;
      }
      const tg = arrow.target;
      if (mode === 'rest') {
        pos.lerp(tg, Math.min(1, dt * 12));
      } else if (mode === 'drop' || mode === 'reject') {
        const floor = mode === 'reject' ? tg.y + height * 1.25 : tg.y;
        vel.y -= g * dt;
        pos.y += vel.y * dt;
        const k = Math.min(1, dt * 9);
        pos.x += (tg.x - pos.x) * k;
        pos.z += (tg.z - pos.z) * k;
        if (pos.y <= floor && vel.y < 0) {
          pos.y = floor;
          if (mode === 'reject') {
            // Bị đẩy bật ra: lò xo hất lên + văng sang bên, chớp đỏ.
            vel.set((Math.random() < 0.5 ? -1 : 1) * height * 4, height * 14, height * 3);
            arrow.glow(1.2, FLAG_COLORS.bad);
            mode = 'leave';
            t = -0.25;
          } else if (Math.abs(vel.y) < height * 3) {
            mode = 'rest';
            arrow.glow(0.9, 0xffffff);
          } else vel.y = -vel.y * 0.32;
        }
      } else if (mode === 'leave') {
        t += dt;
        vel.y -= g * 0.35 * dt;
        pos.addScaledVector(vel, dt);
        mesh.rotation.y += dt * 9;
        if (t > 0) arrow.setOpacity(Math.max(0, 1 - t / 0.5));
        if (t > 0.5) {
          done = true;
          group.visible = false;
        }
      }
    },
    dispose() {
      mat.dispose();
      group.removeFromParent();
    },
  };
  paint();
  return arrow;
}
