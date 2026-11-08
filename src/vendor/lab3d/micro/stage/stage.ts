import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { backdropTexture, BACKDROPS, type BackdropColors } from './backdrop';
import { createDust } from './dust';

export interface MicroStageOptions {
  backdrop?: keyof typeof BACKDROPS | BackdropColors;
  /** Hạt bụi sáng lơ lửng (chiều sâu). */
  dust?: boolean;
  /** Khoảng camera mặc định tới gốc. */
  distance?: number;
  target?: THREE.Vector3;
  /** Cường độ ánh sáng tổng (1 = mặc định). */
  light?: number;
  envIntensity?: number;
  /** false = không chỉnh camera/controls (khi cảnh tự đặt). */
  frame?: boolean;
}

export interface MicroStage {
  root: THREE.Group;
  /** Đèn chính (đổ bóng), đèn phụ, đèn viền. */
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  background: THREE.Texture;
  setLight(k: number): void;
  /** Bật/tắt (cho chuyển vĩ mô ⇄ vi mô): nền, sương, đèn. */
  setActive(on: boolean): void;
  update(dt: number): void;
}

/** "Sân khấu vi mô": nền tối sang trọng có vầng sáng, ánh sáng studio mềm 3 điểm, bụi sáng mờ. */
export function createMicroStage(ctx: SimContext, o: MicroStageOptions = {}): MicroStage {
  const { scene, camera, controls } = ctx;
  const colors = typeof o.backdrop === 'object' ? o.backdrop : BACKDROPS[o.backdrop ?? 'night'];
  const background = ctx.track(backdropTexture(colors));
  const root = new THREE.Group();
  root.name = 'micro-stage';
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x1a2230, 0.45);
  const key = new THREE.DirectionalLight(0xfff4e6, 1.7);
  key.position.set(4, 6, 5);
  const fill = new THREE.DirectionalLight(0xbcd4ff, 0.55);
  fill.position.set(-6, 1.5, 3);
  const rim = new THREE.DirectionalLight(0x9fc8ff, 1.3);
  rim.position.set(-2, 3, -6);
  root.add(hemi, key, fill, rim);
  const dust = o.dust === false ? null : createDust(ctx, { radius: (o.distance ?? 6) * 1.6 });
  if (dust) root.add(dust.points);
  scene.add(ctx.track(root));
  const base = [hemi.intensity, key.intensity, fill.intensity, rim.intensity];
  const envI = o.envIntensity ?? 0.6;

  const stage: MicroStage = {
    root,
    key,
    fill,
    rim,
    background,
    setLight(k) {
      [hemi, key, fill, rim].forEach((l, i) => (l.intensity = base[i] * k));
    },
    setActive(on) {
      root.visible = on;
      if (on) {
        scene.background = background;
        scene.environmentIntensity = envI;
      }
    },
    update(dt) {
      dust?.update(dt);
    },
  };
  stage.setActive(true);
  stage.setLight(o.light ?? 1);
  if (o.frame !== false) {
    camera.fov = 40;
    camera.updateProjectionMatrix();
    const d = o.distance ?? 6;
    camera.position.set(d * 0.35, d * 0.3, d * 0.89);
    ctx.frameTo(o.target ?? new THREE.Vector3(0, 0, 0), d);
    controls.minDistance = d * 0.25;
    controls.maxDistance = d * 3;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
  }
  return stage;
}
