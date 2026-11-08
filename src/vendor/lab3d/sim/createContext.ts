import * as THREE from 'three';
import GUI from 'lil-gui';
import { frameTo } from '../engine/cameraRig';
import { disposeAny, disposeObject } from '../engine/dispose';
import type { Engine, Stage } from '../engine/Engine';
import type { StageKind } from '../engine/stages/types';
import { makeLabel } from '../engine/labels';
import { createSimAudio } from '../audio/simAudio';
import { exposeAudioDevHook } from '../audio/dev';
import { exposeOverlapDevHook } from '../lab/geometry/overlapProbe';
import { hudApi } from './hudStore';
import { setupQuietDefaults } from './guiMode';
import { createSafeFraming, measureInsets } from './safeArea';
import { useSim } from './simStore';
import type { SimContext, Simulation } from './types';
import { labText } from '../text';

/** Một phiên mô phỏng: SimContext mới + Stage cho Engine + hàm huỷ toàn bộ. */
export interface SimSession {
  ctx: SimContext;
  stage: Stage;
  /** Gắn Simulation sau khi create() xong. */
  attach(sim: Simulation): void;
  sim: Simulation | null;
  /** Nút góc nhìn của thanh công cụ (kế hoạch nâng cấp P1-2): về tư thế lúc vào bài / bay lại gần tâm quay – camera trượt mượt ~0,9 s. */
  view(kind: 'home' | 'close'): void;
  dispose(): void;
}

export interface SimSessionOptions {
  /** Khung hẹp hơn (px) → lil-gui luôn bắt đầu thu gọn kể cả khi đã mở trong phiên (mặc định 1000; `subject.layout.guiCollapseWidth`). */
  guiCollapseWidth?: number;
}

export function createSimSession(engine: Engine, guiContainer: HTMLElement, stageKind: StageKind = 'lab', opts: SimSessionOptions = {}): SimSession {
  const { scene, camera, controls } = engine.prepareStage(stageKind);
  const gui = new GUI({ container: guiContainer, title: labText('t_176162d98b16'), width: 236 });
  gui.domElement.classList.add('sim-gui');
  const root = guiContainer.parentElement ?? engine.host;
  // Bảng Tham số thu gọn mặc định (chip), nhãn 3D gọn – mở được, nhớ trong phiên.
  const quiet = setupQuietDefaults(gui, root, engine.host, engine.labelRenderer.domElement, opts.guiCollapseWidth);
  const overlay = document.createElement('div');
  overlay.className = 'sim-overlay';
  // Kéo/bấm trên widget HTML của sim không xoay camera (OrbitControls nghe trên engine.host).
  overlay.addEventListener('pointerdown', (e) => e.stopPropagation());
  overlay.addEventListener('wheel', (e) => e.stopPropagation());
  engine.host.appendChild(overlay);
  const framing = createSafeFraming(camera, root, gui.domElement);
  const tracked: unknown[] = [];
  const keep = engine.sharedTextures();
  const audio = createSimAudio(camera);
  exposeAudioDevHook();
  exposeOverlapDevHook(scene);
  let disposed = false;
  // Tư thế "toàn cảnh" = camera + tâm quay ngay sau create(); hoạt cảnh chạy trong frame() (thời gian thực, cả khi tạm dừng).
  const home = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const fly = { t: 1, fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toPos: new THREE.Vector3(), toTarget: new THREE.Vector3() };
  const flyTo = (pos: THREE.Vector3, target: THREE.Vector3) => {
    fly.fromPos.copy(camera.position);
    fly.fromTarget.copy(controls.target);
    fly.toPos.copy(pos);
    fly.toTarget.copy(target);
    fly.t = 0;
  };
  const stepFly = (dt: number) => {
    if (fly.t >= 1) return;
    fly.t = Math.min(1, fly.t + dt / 0.9);
    const e = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
    controls.target.lerpVectors(fly.fromTarget, fly.toTarget, e);
    camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
  };

  const session: SimSession = {
    sim: null,
    ctx: {
      scene,
      camera,
      renderer: engine.renderer,
      controls,
      gui,
      hud: hudApi,
      caption: (text) => useSim.setState({ caption: text }),
      warn: (text, opts) =>
        useSim.setState({ warning: text, warningTitle: opts?.title ?? null, warningTone: opts?.tone ?? 'warn' }),
      notice: (text, opts) =>
        useSim.setState({ warning: text, warningTitle: opts?.title ?? labText('t_7a62ab00d8cf'), warningTone: opts?.tone ?? 'info' }),
      setHudPlacement: (hudPlacement) => useSim.setState({ hudPlacement }),
      labels: { add: (obj, text, opts) => makeLabel(obj, text, opts) },
      track<T>(obj: T): T {
        if (disposed) disposeAny(obj, keep);
        else tracked.push(obj);
        return obj;
      },
      frameTo: (target, distance) => frameTo(camera, controls, target, distance),
      overlay,
      viewInsets: () => measureInsets(root),
      fitSafeArea: (on = true, o) => framing.set(on, o),
      quality: engine.quality,
      qualityPref: engine.qualityPreference,
      setQuality(pref) {
        engine.setQualityPref(pref);
        useSim.setState((s) => ({ qualityRev: s.qualityRev + 1 }));
      },
      sharedEnvironment: (name) => engine.envMap(name),
      audio,
      setRenderHook(hook) {
        session.stage.renderHook = hook;
        hook?.setSize?.(Math.max(1, engine.host.clientWidth), Math.max(1, engine.host.clientHeight));
      },
    },
    stage: {
      scene,
      camera,
      controls,
      tick: (dt, elapsed) => session.sim?.update(dt, elapsed),
      frame: (dt) => {
        stepFly(dt);
        session.sim?.frame?.(dt);
      },
    },
    attach(sim) {
      session.sim = sim;
      home.pos.copy(camera.position);
      home.target.copy(controls.target);
      quiet.attach(scene, labText('t_b9623eaf6cc7'));
    },
    view(kind) {
      if (kind === 'home') return flyTo(home.pos, home.target);
      const dir = camera.position.clone().sub(controls.target);
      flyTo(controls.target.clone().addScaledVector(dir, 0.5), controls.target);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        session.sim?.dispose?.();
      } catch (err) {
        console.error('[sim] dispose failed', err);
      }
      session.sim = null;
      audio.dispose();
      session.stage.renderHook = null;
      framing.dispose();
      for (let i = tracked.length - 1; i >= 0; i--) disposeAny(tracked[i], keep);
      tracked.length = 0;
      // Scene/camera dùng chung: dọn con (và nền) nhưng không tách khỏi Engine.
      for (const child of [...scene.children, ...camera.children]) disposeObject(child, keep);
      if (scene.background instanceof THREE.Texture && !keep.has(scene.background)) scene.background.dispose();
      if (scene.environment && !keep.has(scene.environment)) scene.environment.dispose();
      scene.clear();
      camera.clear();
      quiet.dispose();
      gui.destroy();
      overlay.replaceChildren();
      overlay.remove();
      controls.dispose();
      hudApi.clear();
      useSim.setState({ caption: '', warning: null, warningTitle: null, warningTone: 'warn', hudPlacement: 'left' });
      engine.labelRenderer.domElement.replaceChildren();
      engine.renderer.renderLists.dispose();
    },
  };
  return session;
}
