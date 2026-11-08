import * as THREE from 'three';
import { createLabelLayout } from './labelLayout';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { createLabelRenderer } from './labels';
import { detectQuality, readQualityPref, saveQualityPref, type Quality, type QualityPref } from './quality';
import { resetCamera, resetRenderer, resetScene } from './resetScene';
import { environmentFactory, stagePreset } from './stages/presets';
import type { RenderHook, SharedEnvName, StageKind } from './stages/types';

export type { RenderHook };

/** Thứ Engine vẽ mỗi frame: một scene + camera + controls + hàm cập nhật. */
export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** Gọi mỗi frame khi đang chạy; dt đã nhân tốc độ, elapsed = thời gian mô phỏng. */
  tick(dt: number, elapsed: number): void;
  /** Gọi mỗi frame kể cả khi tạm dừng (dt thực) – việc phụ thuộc camera (nhãn, bầu trời…). */
  frame?(realDt: number): void;
  /** Hook vẽ tuỳ biến (vd. EffectComposer của postprocessing); null/undefined = `renderer.render(scene, camera)`. */
  renderHook?: RenderHook | null;
}

/**
 * Engine dùng chung cho toàn bộ màn phải: một WebGLRenderer + CSS2DRenderer,
 * env map PMREM, vòng lặp RAF với pause/tốc độ và ResizeObserver.
 * Mỗi mô phỏng có Stage riêng (scene/camera/controls mới).
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  private readonly captures: ((blob: Blob | null) => void)[] = [];
  /** Đường nối, tránh chồng, ẩn khi bị che cho nhãn 3D (labelLayout.ts). */
  private readonly labelLayout: ReturnType<typeof createLabelLayout>;
  readonly host: HTMLElement;
  playing = true;
  speed = 1;
  /** Gọi sau mỗi frame (dùng cho đo FPS, debug…). */
  onAfterFrame: ((dt: number) => void) | null = null;

  private stage: Stage | null = null;
  private elapsed = 0;
  private last = 0;
  private width = 1;
  private height = 1;
  private readonly resizeObserver: ResizeObserver;
  /** Env map PMREM theo kiểu sân khấu (+ env phụ dùng chung, vd. 'lab-studio') – tạo lười, chỉ dispose cùng Engine. */
  private readonly envMaps = new Map<StageKind | SharedEnvName, THREE.Texture>();
  private readonly shared = new Set<THREE.Texture>();
  /** Chất lượng tự đoán theo renderer (SwiftShader/llvmpipe → 'low'). */
  readonly autoQuality: Quality;
  private qualityPref: QualityPref = readQualityPref();
  private readonly defaultPixelRatio = Math.min(window.devicePixelRatio, 2);

  constructor(host: HTMLElement) {
    this.host = host;
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(this.defaultPixelRatio);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    // r186: PCFSoftShadowMap đã bị bỏ; PCFShadowMap + shadow.radius cho bóng mềm.
    r.shadowMap.type = THREE.PCFShadowMap;
    r.domElement.className = 'engine-canvas';
    host.appendChild(r.domElement);
    this.renderer = r;
    this.labelRenderer = createLabelRenderer(host);
    this.labelLayout = createLabelLayout(host, this.labelRenderer.domElement);
    this.autoQuality = detectQuality(r);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.last = performance.now();
    r.setAnimationLoop((t) => this.frame(t));
  }
  /**
   * Scene + camera dùng lại cho mọi mô phỏng (được đặt lại về mặc định mỗi lần):
   * three giữ render target transmission theo từng scene/camera và không giải phóng khi chúng bị bỏ,
   * nên tạo mới mỗi lần sẽ rò rỉ bộ nhớ GPU.
   */
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);

  /** Chất lượng hiệu lực = lựa chọn người dùng (GUI / `?q=`) hoặc tự đoán. */
  get quality(): Quality {
    return this.qualityPref === 'auto' ? this.autoQuality : this.qualityPref;
  }
  get qualityPreference(): QualityPref {
    return this.qualityPref;
  }
  /** Đổi lựa chọn (lưu localStorage); áp dụng khi dựng sim kế tiếp – SimContext.setQuality tự nạp lại sim. */
  setQualityPref(pref: QualityPref): void {
    this.qualityPref = pref;
    saveQualityPref(pref);
  }

  /** Env map dùng chung của một kiểu sân khấu hoặc env phụ có tên (tạo ở lần đầu). */
  envMap(kind: StageKind | SharedEnvName = 'lab'): THREE.Texture {
    let tex = this.envMaps.get(kind);
    if (!tex) {
      tex = environmentFactory(kind)(this.renderer);
      this.envMaps.set(kind, tex);
      this.shared.add(tex);
    }
    return tex;
  }

  /** Texture thuộc Engine (env map) – phiên sim không được dispose. Tập "sống": env tạo lười sau vẫn có mặt. */
  sharedTextures(): ReadonlySet<THREE.Texture> {
    return this.shared;
  }

  /** Đặt lại scene/camera về mặc định của kiểu sân khấu và tạo OrbitControls mới cho một Stage mới. */
  prepareStage(kind: StageKind = 'lab'): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls } {
    const preset = stagePreset(kind);
    const scene = resetScene(this.scene, this.envMap(kind));
    if (preset.background !== null) scene.background = new THREE.Color(preset.background);
    scene.environmentIntensity = preset.environmentIntensity;
    const camera = resetCamera(this.camera, preset, this.width / this.height);
    resetRenderer(this.renderer, this.defaultPixelRatio, preset.exposure);
    const controls = new OrbitControls(camera, this.host);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.copy(preset.camera.target);
    controls.update();
    return { scene, camera, controls };
  }

  setStage(stage: Stage | null): void {
    this.stage = stage;
    this.elapsed = 0;
    if (stage) {
      stage.camera.aspect = this.width / this.height;
      stage.camera.updateProjectionMatrix();
      stage.renderHook?.setSize?.(this.width, this.height);
    } else {
      this.labelRenderer.domElement.replaceChildren();
      this.labelLayout.clear();
    }
  }

  setPlayback(playing: boolean, speed: number): void {
    this.playing = playing;
    this.speed = speed;
  }
  resetClock(): void { this.elapsed = 0; }
  get time(): number { return this.elapsed; }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    if (this.stage) {
      this.stage.camera.aspect = w / h;
      this.stage.camera.updateProjectionMatrix();
      this.stage.renderHook?.setSize?.(w, h);
    }
  }

  private frame(now: number): void {
    const realDt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const s = this.stage;
    if (!s) {
      this.renderer.clear();
      return;
    }
    if (this.playing) {
      const dt = realDt * this.speed;
      this.elapsed += dt;
      try {
        s.tick(dt, this.elapsed);
      } catch (err) {
        console.error('[engine] sim update failed', err);
        this.playing = false;
      }
    }
    s.controls.update(realDt);
    s.frame?.(realDt);
    if (s.renderHook) s.renderHook.render(realDt);
    else this.renderer.render(s.scene, s.camera);
    this.labelRenderer.render(s.scene, s.camera);
    this.labelLayout.update(s.scene, s.camera, realDt);
    // Chụp ảnh khung: toBlob lấy ảnh ngay lúc gọi – phải gọi cùng khung vừa vẽ (canvas WebGL không giữ bộ đệm vẽ).
    if (this.captures.length) {
      const waiting = this.captures.splice(0);
      this.renderer.domElement.toBlob((blob) => waiting.forEach((done) => done(blob)), 'image/png');
    }
    this.onAfterFrame?.(realDt);
  }

  /** Ảnh PNG của cảnh ở khung kế tiếp (không gồm nhãn HTML / lớp giao diện). */
  capture(): Promise<Blob | null> {
    return new Promise((resolve) => this.captures.push(resolve));
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.stage = null;
    for (const tex of this.envMaps.values()) tex.dispose();
    this.envMaps.clear();
    this.shared.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
    this.labelLayout.dispose();
  }
}
