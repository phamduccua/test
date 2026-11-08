import * as THREE from 'three';
import { createCameraTween, createLabStage, type CameraTween, type LabStage, type LabStageOptions } from '../../lab';
import type { SimContext, SimView } from '../../sim/types';
import { createMicroStage, type MicroStage, type MicroStageOptions } from './stage';

export interface DualStageOptions {
  lab?: LabStageOptions;
  micro?: Omit<MicroStageOptions, 'frame'>;
  /** Khoảng cách camera ở mỗi chế độ. */
  macroDistance?: number;
  microDistance?: number;
  /** Hướng từ đích tới camera. */
  macroDir?: THREE.Vector3;
  microDir?: THREE.Vector3;
  /** Dời đích nhìn ở chế độ vĩ mô (vd. hạ xuống để thấy cả khay trên bàn). */
  macroOffset?: THREE.Vector3;
  /** Nền cảnh vĩ mô thay cho nền phòng sáng (vd. 0x05070b cho "phòng tối"); áp lại mỗi lần `set('macro')`. */
  macroBackground?: THREE.ColorRepresentation | THREE.Texture | null;
  /** Cường độ env map ở chế độ vĩ mô (mặc định theo createLabStage = 0,7). */
  macroEnvIntensity?: number;
  /** Khoảng gần nhất OrbitControls cho phép = hệ số × khoảng cách (mặc định 0,2) – hạ xuống để soi vật nhỏ. */
  minDistanceFactor?: number;
}

export interface DualStageSetOptions {
  instant?: boolean;
  distance?: number;
  /** Hướng từ đích tới camera cho riêng lần chuyển này (mặc định macroDir/microDir). */
  dir?: THREE.Vector3;
  /** Khoảng gần nhất cho riêng lần chuyển này (đơn vị cảnh); mặc định distance × minDistanceFactor. */
  minDistance?: number;
}

export interface DualStage {
  lab: LabStage;
  micro: MicroStage;
  tween: CameraTween;
  readonly view: SimView;
  /** Chuyển chế độ và bay camera tới `center` (gọi tween.update mỗi frame). */
  set(view: SimView, center: THREE.Vector3, o?: DualStageSetOptions): void;
  /** Đổi nền/độ sáng env của chế độ vĩ mô (vd. tắt đèn phòng) – giữ nguyên qua các lần `set('macro')`. */
  setMacroEnv(o: { background?: THREE.ColorRepresentation | THREE.Texture | null; envIntensity?: number }): void;
  update(dt: number): void;
}

/** Hai sân khấu dùng chung một scene: vĩ mô = bàn thí nghiệm sáng (mô hình nhựa); vi mô = nền tối, ánh sáng studio. */
export function createDualStage(ctx: SimContext, o: DualStageOptions = {}): DualStage {
  const lab = createLabStage(ctx, { benchWidth: 12, benchDepth: 6, top: 'white', shelf: false, ...o.lab });
  if (o.macroBackground !== undefined) {
    const b = o.macroBackground;
    ctx.scene.background = b === null || b instanceof THREE.Texture ? b : new THREE.Color(b);
  }
  if (o.macroEnvIntensity !== undefined) ctx.scene.environmentIntensity = o.macroEnvIntensity;
  let labBg = ctx.scene.background;
  let labEnv = ctx.scene.environmentIntensity;
  const micro = createMicroStage(ctx, { backdrop: 'night', dust: true, distance: o.microDistance ?? 4, ...o.micro, frame: false });
  const tween = createCameraTween(ctx);
  let view: SimView = 'macro';
  const d: DualStage = {
    lab,
    micro,
    tween,
    get view() {
      return view;
    },
    set(v, center, opt = {}) {
      view = v;
      const isMicro = v === 'micro';
      lab.root.visible = !isMicro;
      micro.setActive(isMicro);
      if (!isMicro) {
        ctx.scene.background = labBg;
        ctx.scene.environmentIntensity = labEnv;
      }
      const c = ctx.controls;
      c.maxPolarAngle = isMicro ? Math.PI : Math.PI * 0.48;
      c.minPolarAngle = isMicro ? 0 : 0.15;
      const dist = opt.distance ?? (isMicro ? (o.microDistance ?? 3.2) : (o.macroDistance ?? 4.8));
      c.minDistance = opt.minDistance ?? dist * (o.minDistanceFactor ?? 0.2);
      c.maxDistance = dist * 3.5;
      const dir = opt.dir ?? (isMicro ? (o.microDir ?? new THREE.Vector3(0.25, 0.2, 1)) : (o.macroDir ?? new THREE.Vector3(0.22, 0.5, 1)));
      const target = isMicro ? center.clone() : center.clone().add(o.macroOffset ?? new THREE.Vector3());
      tween.flyTo(target, dist, { dir, duration: opt.instant ? 0.001 : 1.2 });
      if (opt.instant) tween.update(1);
    },
    setMacroEnv(e) {
      if (e.background !== undefined) labBg = e.background === null || e.background instanceof THREE.Texture ? e.background : new THREE.Color(e.background);
      if (e.envIntensity !== undefined) labEnv = e.envIntensity;
      if (view === 'macro') {
        ctx.scene.background = labBg;
        ctx.scene.environmentIntensity = labEnv;
      }
    },
    update(dt) {
      tween.update(dt);
      micro.update(dt);
    },
  };
  return d;
}
