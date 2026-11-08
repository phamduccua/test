import type * as THREE from 'three';
import type GUI from 'lil-gui';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { LabelOptions } from '../engine/labels';
import type { Quality, QualityPref } from '../engine/quality';
import type { RenderHook, SharedEnvName, StageKind } from '../engine/stages/types';
import type { SimAudio } from '../audio/simAudio';

export type SimView = 'macro' | 'micro';

export interface SimMeta {
  id: string;
  title: string;
  views?: SimView[];
  /** Kiểu sân khấu (mặc định = `stage` của môn): 'lab' phòng thí nghiệm, 'globe' vũ trụ/địa cầu. */
  stage?: StageKind;
}

/** Hợp đồng một mô phỏng: `features/<môn>/bNN/sNN-<tên>/index.ts` export default SimModule. */
export interface SimModule {
  meta: SimMeta;
  create(ctx: SimContext): Simulation | Promise<Simulation>;
}

export interface Simulation {
  /** Gọi mỗi frame khi đang chạy (dt đã nhân tốc độ, elapsed = thời gian mô phỏng). */
  update(dt: number, elapsed: number): void;
  /** Tuỳ chọn: gọi MỖI frame kể cả khi tạm dừng (dt thực) – cập nhật phụ thuộc camera (nhãn khuất, sao bám camera…). */
  frame?(realDt: number): void;
  reset?(): void;
  setView?(view: SimView): void;
  /** Phần còn lại do ctx.track tự dọn. */
  dispose?(): void;
}

export interface SimHud {
  set(key: string, label: string, value: string): void;
  remove(key: string): void;
  clear(): void;
}

export interface SimLabels {
  add(obj: THREE.Object3D, text: string, opts?: LabelOptions): CSS2DObject;
}

/** Vùng khung bị UI chung che (px, tính từ mép canvas): toolbar trên, lil-gui phải, caption dưới. */
export interface ViewInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** Kích thước canvas (px). */
  width: number;
  height: number;
  /**
   * Cột UI trái (toolbar + HUD + thẻ cảnh báo) – px, tính từ mép trái/trên canvas. KHÔNG cộng vào `left`/`top`
   * (giữ hành vi cũ); panel trái của sim nên đặt `top ≥ leftColumn.bottom + 8` để không bị HUD che.
   */
  leftColumn?: { width: number; bottom: number };
  /**
   * Đáy của khung nhìn an toàn (px từ mép dưới): `bottom` + thanh bước `.ix-proc` đang hiện (+ 8 px hở). `bottom` giữ nghĩa cũ
   * (sim tự cộng `procLift()`); đặt khung camera thì dùng cái này (`fitSafeArea(true, { aboveSteps: true })`, `fitPose` `aboveSteps`).
   */
  safeBottom?: number;
}

/** Tuỳ chọn của `ctx.fitSafeArea`. */
export interface SafeFramingOptions {
  /**
   * Chừa đáy cho thanh bước + dải đáy (`safeBottom`): khung hình như cũ thu nhỏ đều, đặt sát trên thanh bước – vật ở đáy khung
   * không nằm dưới thanh. Mặc định false (chỉ lệch tâm ngang theo bảng tham số như cũ).
   */
  aboveSteps?: boolean;
}

/** Tông thẻ thông báo: 'warn' (cam ⚠, mặc định của ctx.warn) | 'info' (xanh ℹ, mặc định của ctx.notice). */
export type WarnTone = 'warn' | 'info';

export interface WarnOptions {
  /** Tiêu đề thẻ (mặc định: `warnTitle` của môn – Hoá "An toàn", Địa "Lưu ý"; ctx.notice: "Lưu ý"). */
  title?: string;
  tone?: WarnTone;
}

/**
 * Vị trí HUD (ctx.hud): 'left' (mặc định, dưới toolbar), 'bottom-left' / 'bottom-right' (trên caption),
 * 'top-right' (dưới bảng tham số khi thu gọn), 'hidden'.
 */
export type HudPlacement = 'left' | 'bottom-left' | 'bottom-right' | 'top-right' | 'hidden';

export interface SimContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  /** lil-gui, đã gắn vào khung mô phỏng. */
  gui: GUI;
  hud: SimHud;
  /** Dòng thuyết minh/bước hiện tại. */
  caption(text: string): void;
  /** Cảnh báo (null = ẩn). Tiêu đề mặc định theo môn (`SubjectDef.warnTitle`), đổi bằng `opts.title`. */
  warn(text: string | null, opts?: WarnOptions): void;
  /** Thông tin kiểu "Lưu ý" (thẻ xanh ℹ, cùng chỗ với ctx.warn; null = ẩn). */
  notice(text: string | null, opts?: WarnOptions): void;
  /** Đặt vị trí HUD cho sim này (đặt lại 'left' khi huỷ sim). */
  setHudPlacement(placement: HudPlacement): void;
  labels: SimLabels;
  /** Đăng ký để tự dispose khi huỷ mô phỏng (Object3D, material, texture, hàm cleanup, …). */
  track<T>(obj: T): T;
  frameTo(target: THREE.Vector3, distance: number): void;
  /**
   * Lớp HTML phủ lên canvas (position absolute, inset 0, pointer-events none – phần tử con tự đặt `pointer-events: auto`).
   * Nằm trên nhãn CSS2D, dưới toolbar/lil-gui; mọi phần tử con bị xoá khi huỷ mô phỏng. Kéo/bấm trên phần tử con không xoay camera.
   */
  overlay: HTMLElement;
  /** Đo vùng bị UI che hiện tại (để đặt khung cảnh lệch vào phần trống). */
  viewInsets(): ViewInsets;
  /**
   * Bật/tắt tự lệch tâm chiếu (camera.setViewOffset) theo `viewInsets()` – cảnh nằm giữa phần canvas không bị che,
   * tự cập nhật khi mở/thu gọn bảng tham số hoặc đổi kích thước. Mặc định tắt. `camera.view` được đặt lại mỗi mô phỏng.
   * `{ aboveSteps: true }`: cả khung co đều để nằm trên thanh bước + dải đáy (`safeBottom`).
   */
  fitSafeArea(on?: boolean, o?: SafeFramingOptions): void;
  /**
   * Chất lượng hình ảnh hiệu lực ('low' tự bật khi renderer là SwiftShader/llvmpipe; `?q=` hoặc GUI đổi được).
   * Sim tự chọn texture/hậu kỳ theo giá trị này (kit địa cầu: `kit/lab3d/geo/globe` → `qualityProfile`; Hoá: `createLabPost`).
   */
  quality: Quality;
  /** Lựa chọn của người dùng ('auto' = tự đoán). */
  qualityPref: QualityPref;
  /** Đổi chất lượng: lưu lựa chọn rồi nạp lại sim hiện tại. */
  setQuality(pref: QualityPref): void;
  /**
   * Thay `renderer.render(scene, camera)` bằng hook riêng (vd. EffectComposer) – null = mặc định.
   * Nhãn CSS2D vẫn do Engine vẽ; `setSize(w, h)` (px CSS) được gọi ngay khi gắn và mỗi lần khung đổi kích thước.
   * Hook tự bỏ khi huỷ sim (vẫn phải `ctx.track` composer để giải phóng render target).
   */
  setRenderHook(hook: RenderHook | null): void;
  /**
   * Env map phụ dùng chung của Engine (vd. 'lab-studio' – phòng tối có softbox cho thuỷ tinh); tạo lười, KHÔNG dispose.
   * Gán vào `scene.environment` (Engine đặt lại env mặc định của sân khấu mỗi sim).
   */
  sharedEnvironment(name: SharedEnvName): THREE.Texture;
  /**
   * Âm thanh của sim (`kit/lab3d/audio`): `sfx(id, {at})`, `loop(id)`, `ambient([...])` – tạo AudioContext lười,
   * tôn trọng nút loa/âm lượng chung, mọi âm tự tắt dần khi huỷ sim. Sim không dùng thì không tốn gì.
   */
  audio: SimAudio;
}
