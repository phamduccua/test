import * as THREE from 'three';
import {
  BloomEffect,
  BrightnessContrastEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import type { SimContext } from '../../sim/types';

export interface LabPostOptions {
  /** Cường độ bloom cho điểm sáng (đèn, ngọn lửa, vệt softbox trên kính); 0 = tắt. */
  bloom?: number;
  /** Tương phản thêm (−1…1), mặc định 0,1. */
  contrast?: number;
  /** Độ tối 4 góc 0…1, mặc định 0,3. */
  vignette?: number;
  /** Bão hoà thêm (−1…1), mặc định 0. */
  saturation?: number;
}

export interface LabPost {
  composer: EffectComposer;
  bloom: BloomEffect | null;
  dispose(): void;
}

/**
 * Hậu kỳ nhẹ cho sân khấu 'lab' (chỉ khi ctx.quality ≥ medium): render HDR → bloom (ngưỡng cao, chỉ điểm thật sáng) →
 * tone mapping Neutral (giữ đúng màu dung dịch, không ngả tím/xám như ACES) → tương phản/bão hoà nhẹ → vignette → khử răng cưa
 * (high: MSAA 4×; medium: SMAA). Gắn qua `ctx.setRenderHook`, tự `ctx.track`. Trả null khi 'low'.
 */
export function createLabPost(ctx: SimContext, o: LabPostOptions = {}): LabPost | null {
  if (ctx.quality === 'low') return null;
  const high = ctx.quality === 'high';
  const composer = new EffectComposer(ctx.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: high ? 4 : 0 });
  composer.addPass(new RenderPass(ctx.scene, ctx.camera));
  const effects = [];
  let bloom: BloomEffect | null = null;
  if ((o.bloom ?? 0.35) > 0) {
    bloom = new BloomEffect({ mipmapBlur: true, intensity: o.bloom ?? 0.35, luminanceThreshold: 0.92, luminanceSmoothing: 0.12, radius: 0.55 });
    effects.push(bloom);
  }
  effects.push(new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }));
  effects.push(new BrightnessContrastEffect({ contrast: o.contrast ?? 0.1 }));
  if (o.saturation) effects.push(new HueSaturationEffect({ saturation: o.saturation }));
  if ((o.vignette ?? 0.3) > 0) effects.push(new VignetteEffect({ offset: 0.32, darkness: o.vignette ?? 0.3 }));
  composer.addPass(new EffectPass(ctx.camera, ...effects));
  if (!high) composer.addPass(new EffectPass(ctx.camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
  ctx.track(composer);
  ctx.setRenderHook({ render: (dt) => composer.render(dt), setSize: (w, h) => composer.setSize(w, h) });
  return {
    composer,
    bloom,
    dispose() {
      ctx.setRenderHook(null);
      composer.dispose();
    },
  };
}
